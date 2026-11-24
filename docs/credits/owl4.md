# Credits: the v4 owls and their refinished outfits (builder owl4)

## The owls (`public/models/owls/<id>.glb`, `<id>.face.webp`, `<id>.full.webp`)

Modelled and painted for Hoot Hollow from scratch by `art/blender/owls/owl.py` (parametric surfaces: body, head with a
dished facial disc and ruff, folded wings with a spread morph target, tail, feathered legs, toes and talons, bill, ear
tufts) and `art/blender/owls/plume.py` (every feather laid as its own shingled stroke; species markings as stroke
layers; relief normal map; ray-traced cavity using Blender's BVH from the owner's existing `gg-bpy` install). No
photographs, scans or third-party models are used. Plumage and proportions follow field-guide descriptions of the real
birds (Tawny Owl, Barn Owl, Snowy Owl, Burrowing Owl, Northern Saw-whet Owl, Great Horned Owl, Great Grey Owl,
Eurasian Eagle-Owl); no field-guide artwork was copied.

The Queen's model and stills (`queen.*`) are untouched (owl3).

The downy fluff is drawn at runtime by `src/owl/fur.ts` (instanced shells; a strand field generated in code).

## Outfits (`public/models/outfits/*.glb`)

All 39 pieces were remodelled from scratch for Hoot Hollow by `art/blender/owls/garments.py` (parametric garments
fitted to the v4 tawny, painted procedurally: knit, felt, velvet with embroidery, satin, cotton prints, fur trims,
engraved metal, gems, glass, leather, wood, petals and leaves). They no longer use any owl3 or Gacha Garage geometry,
so the CC BY attributions in `docs/credits/owl3.md` now cover only the history of those files. No new third-party
assets.
