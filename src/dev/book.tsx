// Dev page for Pip's diary: dev-book.html?art=1 shows the pixel art; otherwise the diary opens over a
// plain night background with a seeded save (see bookpage.tsx for the query params);
// dev-book.html?trans=<kind>&p=0.5&phase=in previews the pixel transitions (booktrans.ts).
import { showArt } from './bookart.ts';

const q = new URLSearchParams(location.search);
if (q.get('art')) showArt(document.getElementById('ui')!);
else if (q.get('trans')) void import('./booktrans.ts');
else void import('./bookpage.tsx');
