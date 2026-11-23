"""Which of furnB's items borrow a finished model, where from, who made it, and how it is restyled.

src: a GLB path relative to SOURCES (Gacha Garage world props, already low-poly with a hand-painted 512 atlas).
grade: colour grade (see borrow.grade): sat, shadow, light, tint, recolour [...].
yaw: turn the source so its front faces +z. fit: contain (default) | height | footprint.
extra: a lowpix spec (in this folder's recipes, key '<id>_extra') merged in: glowing flames and bulbs.
"""
from __future__ import annotations

from kit import P

GG = "refs3/gg/public/models/lowpix/world/"
CC0, CCBY = "CC0 1.0", "CC BY 4.0"

BORROW = {
    # ---- beds and seating
    "floor_futon": dict(src=GG + "futon_set.glb", yaw=90, title="Japanese futon/bed", author="nicolas_solo", lic=CCBY,
                        url="https://sketchfab.com/3d-models/japanese-futonbed-0d5590d1d2184aa98797c3d6382afd7e",
                        grade=dict(recolour=[dict(hue=[0.85, 0.08], sat=[0.12, 1], to=P["rose"], amount=0.6, keep_sat=0.7)])),
    "patch_sofa": dict(src=GG + "sofa_03.glb", title="Sofa 03", author="Fran Calvente", lic=CC0, url="https://polyhaven.com/a/sofa_03"),
    "rocking_chair": dict(src=GG + "chair_rocking.glb", title="Rockingchair 01", author="Jorge Camacho", lic=CC0, url="https://polyhaven.com/a/Rockingchair_01"),
    "window_seat": dict(src=GG + "sofa_wood.glb", title="Painted Wooden Sofa", author="Kirill Sannikov", lic=CC0, url="https://polyhaven.com/a/painted_wooden_sofa",
                        grade=dict(recolour=[dict(hue=[0, 1], sat=[0, 0.22], val=[0.35, 1], to=0x8fae9f, amount=1.0, keep_sat=0.55, val_mul=0.92)])),
    "wingback": dict(src=GG + "armchair.glb", target=[-8.4, 8.4, 0, 26.4, -6.7, 8.5], title="Arm Chair 01", author="Kirill Sannikov", lic=CC0, url="https://polyhaven.com/a/ArmChair_01",
                     grade=dict(recolour=[dict(hue=[0, 1], sat=[0, 0.2], val=[0.5, 1], to=P["berry"], amount=1.0, keep_sat=0.5, val_mul=0.82)])),
    # ---- tables and storage
    "writing_desk": dict(src=GG + "room_desk.glb", title="Japanese Study Desk", author="AFX/CGMotion 3DModel Maker", lic=CCBY,
                         url="https://sketchfab.com/3d-models/japanese-study-desk-18da6abd259441aea570168cc86bc0ef", grade=dict(sat=0.7)),
    "round_table": dict(src=GG + "table_round.glb", title="Round Wooden Table 01", author="Ulan Cabanilla", lic=CC0, url="https://polyhaven.com/a/round_wooden_table_01"),
    "bobbin_side_table": dict(src=GG + "table_side.glb", fit="height", title="Side Table 01", author="James Ray Cock", lic=CC0, url="https://polyhaven.com/a/side_table_01"),
    "toy_chest": dict(src=GG + "toy_box2.glb", title="Toy box", author="Wyme", lic=CCBY, url="https://sketchfab.com/3d-models/toy-box-e12493a7481548129179d926b9a15b35"),
    "cubby_shelf": dict(src=GG + "room_bookshelf.glb", title="LP Furniture - Cube Shelf Sq", author="c0ntra5t", lic=CCBY,
                        url="https://sketchfab.com/3d-models/lp-furniture-cube-shelf-sq-109368adc245432e93fbf8e0a2f86bda",
                        grade=dict(recolour=[dict(hue=[0, 1], sat=[0, 0.25], val=[0.3, 1], to=P["woodPale"], amount=1.0, keep_sat=0.8, val_mul=0.9)])),
    # ---- lights
    "fringe_floor_lamp": dict(src=GG + "floor_lamp.glb", title="Wooden Floor Lamp", author="Atalaya22", lic=CCBY,
                              url="https://sketchfab.com/3d-models/wooden-floor-lamp-4766a03aa796440598426f8d5e975fec",
                              grade=dict(recolour=[dict(hue=[0, 1], sat=[0, 0.2], val=[0.55, 1], to=P["honey"], amount=1.0, keep_sat=0.55)])),
    "iron_lantern": dict(src=GG + "lantern.glb", title="Lantern 01", author="Rajil Jose Macatangay", lic=CC0, url="https://polyhaven.com/a/Lantern_01"),
    # ---- plants
    "monstera": dict(src=GG + "plant_monstera.glb", title="Monstera Deliciosa Potted Mid-Century plant", author="Giora", lic=CCBY,
                     url="https://sketchfab.com/3d-models/monstera-deliciosa-potted-mid-century-plant-1ab9bf841df04c07b1819be596327629"),

}
