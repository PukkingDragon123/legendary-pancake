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

## Outfits (`public/models/outfits/*.glb`)

The 39 pieces keep their owl3 geometry (owl3's own pieces and the ten borrowed from Gacha Garage's wearables, credited
in `docs/credits/owl3.md`, CC BY 4.0, attribution kept there). `art/blender/owls/outfits.py --finish` refinished them
in place: smooth normals, repainted atlases with procedural material detail (knit, weave, felt, fur, metal, glass,
leather, wood), a normal map and a roughness / metalness map. No new third-party assets.
