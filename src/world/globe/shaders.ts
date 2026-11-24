// GLSL for the realistic Earth (see stage.ts): the planet (NASA Blue Marble day map, Black Marble city lights,
// ETOPO relief as a bump, sun glint on the seas, cloud shadows), the drifting cloud deck, a single-scattering
// atmosphere shell (Rayleigh + Mie with Schüler's Chapman approximation for the light's path), the Milky Way and
// stars, and the stage's own picture chain (bloom, tilt-shift blur, ACES, a warm grade, grain and dither).
// Units: the Earth's radius is 1; the atmosphere is drawn about ten times thicker than it is, with its optical
// depths kept true, so the limb glows the way it does in photographs from orbit.
// [globe] OWNED BY THE GLOBE BUILDER.

export const ATMO = /* glsl */ `
#define PI 3.14159265
const float RP = 1.0;
const float RA = 1.065;
const float HR = 0.0125;
const float HM = 0.0055;
const vec3 BR = vec3(3.6, 8.6, 21.0);
const float BM = 1.7;
const float SUN_I = 22.0;
float chH(float X, float h, float mu) {
  float c = sqrt(X + h);
  if (mu >= 0.0) return c / (c * mu + 1.0) * exp(-h);
  float x0 = sqrt(1.0 - mu * mu) * (X + h);
  float c0 = sqrt(x0);
  return 2.0 * c0 * exp(min(X - x0, 60.0)) - c / (1.0 - c * mu) * exp(-h);
}
// optical depth from a point at height h (radii) along a direction with cosine mu to the vertical, out to space
vec3 odTo(float h, float mu) {
  return BR * HR * chH(RP / HR, h / HR, mu) + BM * 1.1 * HM * chH(RP / HM, h / HM, mu);
}
vec2 hitSphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd), c = dot(ro, ro) - r * r, d = b * b - c;
  if (d < 0.0) return vec2(1e9, -1e9);
  d = sqrt(d);
  return vec2(-b - d, -b + d);
}
vec3 scatter(vec3 ro, vec3 rd, float t0, float t1, vec3 sun) {
  float ds = (t1 - t0) / 8.0;
  vec3 sR = vec3(0.0), sM = vec3(0.0);
  float oR = 0.0, oM = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 p = ro + rd * (t0 + ds * (float(i) + 0.5));
    float r = length(p), h = max(r - RP, 0.0);
    float dR = exp(-h / HR) * ds, dM = exp(-h / HM) * ds;
    oR += dR * 0.5; oM += dM * 0.5;
    vec3 att = exp(-(odTo(h, dot(p, sun) / r) + BR * oR + BM * 1.1 * oM));
    sR += dR * att; sM += dM * att;
    oR += dR * 0.5; oM += dM * 0.5;
  }
  float c = dot(rd, sun);
  float pR = 0.0597 * (1.0 + c * c);
  const float g = 0.76;
  float pM = 0.1193 * ((1.0 - g * g) * (1.0 + c * c)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * c, 1.5));
  return SUN_I * (sR * BR * pR + sM * BM * pM);
}
`;

export const earthVS = /* glsl */ `
varying vec2 vUv; varying vec3 vP;
void main() { vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const earthFS = /* glsl */ `
uniform sampler2D tDay; uniform sampler2D tCL; uniform sampler2D tTopo; uniform sampler2D tTile;
uniform vec4 uTileBox; uniform float uTileMix;
uniform vec3 uSun; uniform float uCloudU; uniform float uCloudAmt; uniform float uBump; uniform vec3 uTarget; uniform float uClear; uniform float uNear;
varying vec2 vUv; varying vec3 vP;
${ATMO}
void main() {
  vec3 n0 = normalize(vP);
  vec3 V = normalize(cameraPosition - vP);
  vec3 alb = texture2D(tDay, vUv).rgb;
  vec2 tu = (vUv - uTileBox.xy) / (uTileBox.zw - uTileBox.xy);
  vec3 tile = texture2D(tTile, clamp(tu, 0.0, 1.0)).rgb;
  float te = min(min(tu.x, 1.0 - tu.x), min(tu.y, 1.0 - tu.y));
  alb = mix(alb, tile, smoothstep(0.0, 0.1, te) * uTileMix);

  // relief: land height from ETOPO (0 = sea), a bump from its slopes
  float tp = texture2D(tTopo, vUv).r;
  float water = 1.0 - smoothstep(0.035, 0.085, tp);
  vec2 tx = vec2(1.0 / 4096.0, 1.0 / 2048.0);
  float hE = max(texture2D(tTopo, vUv + vec2(tx.x, 0.0)).r - 0.094, 0.0);
  float hW = max(texture2D(tTopo, vUv - vec2(tx.x, 0.0)).r - 0.094, 0.0);
  float hN = max(texture2D(tTopo, vUv + vec2(0.0, tx.y)).r - 0.094, 0.0);
  float hS = max(texture2D(tTopo, vUv - vec2(0.0, tx.y)).r - 0.094, 0.0);
  float cl = max(sqrt(1.0 - n0.y * n0.y), 0.12);
  vec3 east = normalize(vec3(n0.z, 0.0, -n0.x) + vec3(1e-5, 0.0, 0.0));
  vec3 north = cross(n0, east);
  float sE = (hE - hW) / (2.0 * tx.x * 2.0 * PI * cl), sN = (hN - hS) / (2.0 * tx.y * PI);
  vec3 n = normalize(n0 - uBump * (sE * east + sN * north));

  float mu0 = dot(n0, uSun);
  float NdL = max(dot(n, uSun), 0.0);
  float NdV = max(dot(n0, V), 0.02);
  vec3 Tsun = exp(-odTo(0.0005, mu0));
  float lit = smoothstep(-0.03, 0.06, mu0);

  // clouds over this spot (for shadows, the glint and dimming the town lights)
  vec2 cuv = vec2(vUv.x + uCloudU, 0.5 + vUv.y * 0.5);
  float clear = 1.0 - uClear * smoothstep(0.3, 0.04, distance(n0, uTarget));
  float cover = smoothstep(0.12, 0.8, texture2D(tCL, cuv).r) * uCloudAmt * clear;
  vec3 sT = uSun - n0 * mu0;
  vec2 sh = vec2(dot(sT, east) / (2.0 * PI * cl), dot(sT, north) / PI) * 0.010;
  float shade = smoothstep(0.12, 0.8, texture2D(tCL, cuv + sh).r) * uCloudAmt * clear;

  vec3 sunL = Tsun * SUN_I * 0.16;
  vec3 col = alb * sunL * NdL * lit * (1.0 - 0.55 * shade);
  col += alb * vec3(0.10, 0.16, 0.28) * 0.35 * smoothstep(-0.25, 0.4, mu0);          // blue sky light
  // moonlight: the night land still reads, more so down in the close view (a low moon from the north-west
  // so the relief shows)
  vec3 M = normalize(n0 * 0.75 + north * 0.45 - east * 0.35);
  float moon = (1.0 - lit) * (0.35 + 0.65 * max(dot(n, M), 0.0));
  col += alb * vec3(0.014, 0.02, 0.038) * (1.0 + 7.0 * uNear * moon) * (1.0 + 1.6 * (1.0 - water) * uNear);
  // the sea: a sharp sun glint and a broad sheen, dimmed under clouds
  vec3 H = normalize(uSun + V);
  float NdH = max(dot(n0, H), 0.0), VdH = max(dot(V, H), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - VdH, 5.0);
  float a2 = 0.009, D = a2 / (PI * pow(NdH * NdH * (a2 - 1.0) + 1.0, 2.0));
  float b2 = 0.16, D2 = b2 / (PI * pow(NdH * NdH * (b2 - 1.0) + 1.0, 2.0));
  col += water * sunL * (D * 1.4 + D2 * 0.12) * F * max(mu0, 0.0) / (4.0 * NdV) * (1.0 - cover) * lit;
  // town lights after dusk
  float L = texture2D(tCL, vec2(vUv.x, vUv.y * 0.5), uNear * 1.8).r;
  float night = 1.0 - smoothstep(-0.12, 0.05, mu0);
  col += pow(L, 1.7) * vec3(1.0, 0.62, 0.3) * 2.4 * (1.0 - 0.96 * uNear) * night * (1.0 - cover * 0.75);
  // looking down through the air: extinction (the shell adds the in-scattered light on top)
  col *= exp(-odTo(0.0, NdV));
  gl_FragColor = vec4(col, 1.0);
}`;

export const cloudFS = /* glsl */ `
uniform sampler2D tCL; uniform vec3 uSun; uniform float uCloudU; uniform float uCloudAmt; uniform vec3 uTarget; uniform float uClear;
varying vec2 vUv; varying vec3 vP;
${ATMO}
void main() {
  vec3 n0 = normalize(vP);
  vec3 V = normalize(cameraPosition - vP);
  float c = texture2D(tCL, vec2(vUv.x + uCloudU, 0.5 + vUv.y * 0.5)).r;
  float clear = 1.0 - uClear * smoothstep(0.3, 0.04, distance(n0, uTarget));
  float a = smoothstep(0.12, 0.8, c) * uCloudAmt * clear;
  if (a < 0.004) discard;
  float mu0 = dot(n0, uSun);
  vec3 Tsun = exp(-odTo(0.008, mu0));
  float lit = smoothstep(-0.08, 0.12, mu0);
  float k = (0.35 + 0.65 * max(mu0, 0.0)) * lit;
  vec3 col = vec3(0.92, 0.93, 0.95) * Tsun * SUN_I * 0.11 * k * (0.75 + 0.25 * c);
  col += vec3(0.10, 0.15, 0.24) * 0.14 * smoothstep(-0.25, 0.4, mu0);
  col += vec3(0.016, 0.022, 0.04);
  float NdV = max(dot(n0, V), 0.02);
  col *= exp(-odTo(0.008, NdV));
  gl_FragColor = vec4(col, a);
}`;

export const atmoVS = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
export const atmoFS = /* glsl */ `
uniform vec3 uSun; uniform float uGain;
varying vec3 vW;
${ATMO}
void main() {
  vec3 ro = cameraPosition, rd = normalize(vW - ro);
  vec2 a = hitSphere(ro, rd, RA);
  if (a.y <= 0.0) discard;
  vec2 g = hitSphere(ro, rd, RP);
  bool ground = g.x > 0.0 && g.x < 1e8;
  float t0 = max(a.x, 0.0), t1 = ground ? g.x : a.y;
  if (t1 <= t0) discard;
  // looking straight down the haze is thin (as in the Blue Marble photographs); towards the limb it thickens
  float k = 1.0;
  if (ground) { vec3 n = normalize(ro + rd * g.x); k = mix(1.0, 0.24, smoothstep(0.12, 0.65, dot(n, -rd))); }
  vec3 col = scatter(ro, rd, t0, t1, uSun) * uGain * k;
  gl_FragColor = vec4(col, 1.0);
}`;

export const skyVS = /* glsl */ `
varying vec3 vD;
void main() { vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
// direction (celestial, three axes: y = north pole, x = RA 0, RA growing towards -z) -> galactic -> the panorama
export const skyFS = /* glsl */ `
uniform sampler2D tSky; uniform float uSkyI; uniform vec3 uSun;
varying vec3 vD;
void main() {
  vec3 d = normalize(vD);
  vec3 e = vec3(d.x, -d.z, d.y);
  mat3 M = mat3(-0.0548755604, 0.4941094279, -0.8676661490, -0.8734370902, -0.4448296300, -0.1980763734, -0.4838350155, 0.7469822445, 0.4559837762);
  vec3 g = M * e;
  float l = atan(g.y, g.x), b = asin(clamp(g.z, -1.0, 1.0));
  vec2 uv = vec2(0.5 - l / 6.2831853, 0.5 + b / 3.14159265);
  vec3 col = textureLod(tSky, uv, 0.0).rgb * uSkyI;
  gl_FragColor = vec4(col, 1.0);
}`;

export const starVS = /* glsl */ `
attribute float aMag; attribute vec3 aCol; uniform float uPx; varying vec3 vCol; varying float vA;
void main() {
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
  float s = clamp(2.6 - aMag * 0.38, 0.9, 3.2) * uPx;
  gl_PointSize = s;
  vA = clamp(1.6 - aMag * 0.24, 0.12, 1.6);
  vCol = aCol;
}`;
export const starFS = /* glsl */ `
varying vec3 vCol; varying float vA;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q) * 2.0;
  float k = exp(-r * r * 4.0);
  if (k < 0.02) discard;
  gl_FragColor = vec4(vCol * vA * k, 1.0);
}`;

/** soft glowing markers on the ground (the places) and the flight path motes */
export const glowVS = /* glsl */ `
attribute vec3 aCol; attribute float aSize; uniform float uPx; uniform vec3 uCam; varying vec3 vCol; varying float vFace;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vec3 n = normalize(position);
  vFace = smoothstep(0.0, 0.12, dot(n, normalize(uCam - position)));
  gl_PointSize = aSize * uPx;
  vCol = aCol;
}`;
export const glowFS = /* glsl */ `
varying vec3 vCol; varying float vFace;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q) * 2.0;
  float k = exp(-r * r * 5.0) + 0.7 * smoothstep(0.32, 0.18, r);
  if (k * vFace < 0.01) discard;
  gl_FragColor = vec4(vCol * k * vFace, 1.0);
}`;

export const lineVS = /* glsl */ `
uniform vec3 uCam; uniform vec3 uSun; varying float vFace;
void main() {
  vec3 n = normalize(position);
  vFace = smoothstep(0.02, 0.3, dot(n, normalize(uCam - position))) * (0.35 + 0.65 * smoothstep(-0.15, 0.1, dot(n, uSun)));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
export const lineFS = /* glsl */ `
uniform vec3 uColor; uniform float uAlpha; varying float vFace;
void main() { gl_FragColor = vec4(uColor, uAlpha * vFace); }`;

export const sunVS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const sunFS = /* glsl */ `
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float core = smoothstep(0.075, 0.06, r) * 60.0;
  float glow = (exp(-r * 7.0) * 3.5 + exp(-r * 2.2) * 0.35) * smoothstep(1.0, 0.55, r);
  gl_FragColor = vec4(vec3(1.0, 0.92, 0.8) * (core + glow), 1.0);
}`;

// ------------------------------------------------------------------ the picture chain

export const quadVS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** bright pass + 2x downsample (13-tap, Karis-weighted so lone hot pixels don't flicker) */
export const brightFS = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh; varying vec2 vUv;
vec3 s(vec2 o) { return min(texture2D(tSrc, vUv + o * uTexel).rgb, vec3(60.0)); }
float w(vec3 c) { return 1.0 / (1.0 + max(c.r, max(c.g, c.b))); }
void main() {
  vec3 a = s(vec2(-1.0, -1.0)), b = s(vec2(1.0, -1.0)), c = s(vec2(-1.0, 1.0)), d = s(vec2(1.0, 1.0)), e = s(vec2(0.0));
  float wa = w(a), wb = w(b), wc = w(c), wd = w(d), we = w(e) * 2.0;
  vec3 m = (a * wa + b * wb + c * wc + d * wd + e * we) / (wa + wb + wc + wd + we);
  float l = max(m.r, max(m.g, m.b));
  float k = uThresh * 0.6;
  float sk = clamp(l - uThresh + k, 0.0, 2.0 * k);
  sk = sk * sk / (4.0 * k + 1e-4);
  gl_FragColor = vec4(m * max(sk, l - uThresh) / max(l, 1e-4), 1.0);
}`;
export const downFS = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 c = s(vec2(0.0)) * 0.25;
  c += (s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0))) * 0.125;
  c += (s(vec2(-2.0, 0.0)) + s(vec2(2.0, 0.0)) + s(vec2(0.0, -2.0)) + s(vec2(0.0, 2.0))) * 0.0625;
  gl_FragColor = vec4(c, 1.0);
}`;
export const upFS = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uK; varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 c = s(vec2(0.0)) * 4.0;
  c += (s(vec2(-1.0, 0.0)) + s(vec2(1.0, 0.0)) + s(vec2(0.0, -1.0)) + s(vec2(0.0, 1.0))) * 2.0;
  c += s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0));
  gl_FragColor = vec4(c / 16.0 * uK, 1.0);
}`;
/** plain 2x downsample of the whole picture (for the tilt-shift blur) */
export const halfFS = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv + vec2(-0.5, -0.5) * uTexel).rgb + texture2D(tSrc, vUv + vec2(0.5, -0.5) * uTexel).rgb
         + texture2D(tSrc, vUv + vec2(-0.5, 0.5) * uTexel).rgb + texture2D(tSrc, vUv + vec2(0.5, 0.5) * uTexel).rgb;
  gl_FragColor = vec4(min(c * 0.25, vec3(30.0)), 1.0);
}`;

export const compFS = /* glsl */ `
uniform sampler2D tColor; uniform sampler2D tBloom; uniform sampler2D tSoft;
uniform float uBloom; uniform float uExposure; uniform float uTilt; uniform vec2 uFocusY; uniform float uTime; uniform vec2 uRes; uniform float uFade;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec3 col = texture2D(tColor, vUv).rgb;
  // tilt-shift: the band round the subject stays sharp, the top and bottom of the frame soften
  float dy = max(0.0, abs(vUv.y - uFocusY.x) - uFocusY.y);
  float blur = clamp(dy * 3.2, 0.0, 1.0) * uTilt;
  col = mix(col, texture2D(tSoft, vUv).rgb, blur);
  col += texture2D(tBloom, vUv).rgb * uBloom;
  col *= uExposure;
  col = aces(col);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  // the Golden Diorama grade, gently: warm highlights, sapphire shadows, a little more colour
  col += vec3(0.035, 0.016, -0.02) * smoothstep(0.35, 0.95, l);
  col += vec3(-0.002, 0.0, 0.005) * (1.0 - smoothstep(0.0, 0.3, l));
  float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  col = max(mix(vec3(l), col, 1.1 + 0.12 * (1.0 - sat)), 0.0);
  vec2 cc = vUv - 0.5;
  col *= 1.0 - 0.22 * smoothstep(0.2, 0.75, dot(cc, cc) * 1.5);
  col = toSRGB(clamp(col, 0.0, 1.0));
  vec2 px = floor(vUv * uRes);
  col += (hash(px + floor(uTime * 24.0) * 7.0) - 0.5) * 0.012;
  col += (hash(px * 1.31 + 3.7) - 0.5) / 255.0;
  gl_FragColor = vec4(col * uFade, 1.0);
}`;
