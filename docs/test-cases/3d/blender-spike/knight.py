"""Gothic chess knight, 9 cm tall, base on z=0, head facing +X. Usage: blender -b -P knight.py -- <outdir>"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bmesh
from mathutils import Vector
from od_blender import *

reset()
OUT = out_dir()
ivory = material('ivory', (0.86, 0.80, 0.68), rough=0.32, clearcoat=0.4)

# Base: a turned Staunton foot with a bead and a collar.
base = lathe('base', [(0, 0), (0.0205, 0), (0.021, 0.0015), (0.0205, 0.004), (0.018, 0.0062), (0.0168, 0.0085),
                      (0.0182, 0.0105), (0.0182, 0.0125), (0.0155, 0.0148), (0.0135, 0.019), (0.0128, 0.023),
                      (0.0145, 0.0248), (0.0145, 0.0275), (0.011, 0.029), (0, 0.029)], 72, ivory)

# Head: side silhouette (x forward, y up), Bezier with auto handles.
sil = [(-0.0118, 0.026), (-0.0142, 0.036), (-0.0146, 0.047), (-0.0128, 0.06), (-0.0092, 0.0715), (-0.0045, 0.0805),
       (0.001, 0.0852), (0.0062, 0.0842), (0.0108, 0.0798), (0.0172, 0.0712), (0.0238, 0.0628), (0.0284, 0.0566),
       (0.0292, 0.0518), (0.0268, 0.0482), (0.0222, 0.0478), (0.0196, 0.0458), (0.0148, 0.0472), (0.0088, 0.0498),
       (0.0038, 0.0482), (0.0006, 0.0438), (0.0012, 0.0392), (0.0068, 0.0338), (0.0102, 0.0292), (0.0096, 0.026)]
cu = bpy.data.curves.new('head', 'CURVE')
cu.dimensions = '2D'
cu.fill_mode = 'BOTH'
cu.extrude = 0.0044
cu.bevel_depth = 0.0032
cu.bevel_resolution = 6
cu.resolution_u = 10
sp = cu.splines.new('BEZIER')
sp.bezier_points.add(len(sil) - 1)
for bp, (x, y) in zip(sp.bezier_points, sil):
    bp.co = (x, y, 0)
    bp.handle_left_type = bp.handle_right_type = 'AUTO'
sp.use_cyclic_u = True
head = link(bpy.data.objects.new('head', cu))
head.rotation_euler = (math.pi / 2, 0, 0)  # curve y -> world z; extrude along world y
bpy.context.view_layer.objects.active = head
head.select_set(True)
bpy.ops.object.convert(target='MESH')
bpy.ops.object.transform_apply(rotation=True)
head.select_set(False)

# Shape the head: narrow muzzle, wide jowls, a chest that flares into the collar.
def ss(e0, e1, x):  # smoothstep
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)

for v in head.data.vertices:
    x, y, z = v.co
    k = 1 - 0.34 * ss(0.008, 0.028, x)          # muzzle taper
    k *= 1 + 0.08 * ss(0.056, 0.072, z) * (1 - ss(0.008, 0.02, x))  # broad forehead
    k *= 1 + 0.6 * (1 - ss(0.026, 0.044, z))    # neck flares into the collar
    v.co.y = y * k
    d = 1 - ((x - 0.007) / 0.009) ** 2 - ((z - 0.057) / 0.014) ** 2  # cheek bulge
    if d > 0:
        v.co.y += math.copysign(0.0018 * d * d, y)

parts = [base, head]

# Ears: two leaf cones, pricked and tilted back.
for s in (1, -1):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.0034, radius2=0.0008, depth=0.0105, location=(0.0028, s * 0.0045, 0.0885))
    ear = bpy.context.object
    ear.scale = (0.6, 1, 1)
    ear.rotation_euler = (s * math.radians(-12), math.radians(-22), 0)
    parts.append(ear)

# Mane: a row of carved locks down the back of the neck, alternating sides.
mane_path = [(-0.0028, 0.0832), (-0.0068, 0.0778), (-0.0099, 0.0718), (-0.0122, 0.0652), (-0.0139, 0.0585), (-0.0148, 0.0515),
             (-0.015, 0.0445), (-0.0146, 0.0375), (-0.0138, 0.031)]
for i, (x, z) in enumerate(mane_path):
    for s in (1, -1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.0038,
                                             location=(x - 0.0012, s * 0.0028 * (1 if i % 2 else 0.4), z))
        lock = bpy.context.object
        lock.scale = (0.62, 0.5, 1.15)
        lock.rotation_euler = (0, math.radians(-30 + i * 6), s * math.radians(14))
        parts.append(lock)

# Brow ridges over the eyes.
for s in (1, -1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.0026, location=(0.0105, s * 0.0068, 0.0755))
    brow = bpy.context.object
    brow.scale = (1.3, 0.55, 0.6)
    brow.rotation_euler = (0, math.radians(35), 0)
    parts.append(brow)

knight = join(parts, 'knight')
# Fuse into one carved solid.
mod(knight, 'REMESH', mode='VOXEL', voxel_size=0.00028, adaptivity=0.0)
mod(knight, 'SMOOTH', factor=0.5, iterations=3)
apply_all(knight)

# Carving: eyes, nostrils, mouth, a groove between the mane and the neck.
def cutter(fn, **kw):
    fn(**kw)
    return bpy.context.object

for s in (1, -1):
    eye = cutter(bpy.ops.mesh.primitive_uv_sphere_add, segments=16, ring_count=10, radius=0.0019, location=(0.0122, s * 0.0081, 0.0718))
    eye.scale = (1.25, 0.7, 0.85)
    boolean(knight, eye)
    nos = cutter(bpy.ops.mesh.primitive_uv_sphere_add, segments=12, ring_count=8, radius=0.0013, location=(0.0278, s * 0.0034, 0.0548))
    nos.scale = (0.8, 0.8, 1.3)
    boolean(knight, nos)
    groove = cutter(bpy.ops.mesh.primitive_cylinder_add, vertices=12, radius=0.0006, depth=0.045, location=(-0.0078, s * 0.0062, 0.058))
    groove.rotation_euler = (0, math.radians(-21), 0)
    boolean(knight, groove)
mouth = cutter(bpy.ops.mesh.primitive_cube_add, size=1, location=(0.0275, 0, 0.0496))
mouth.scale = (0.008, 0.02, 0.0007)
mouth.rotation_euler = (0, math.radians(8), 0)
boolean(knight, mouth)

mod(knight, 'DECIMATE', ratio=1.0)
before = tris([knight])
knight.modifiers['decimate'].ratio = min(1.0, 24000 / before)
apply_all(knight)
mod(knight, 'WEIGHTED_NORMAL', keep_sharp=False)
smooth(knight, 60)
knight.data.materials.clear()
knight.data.materials.append(ivory)

preview(os.path.join(OUT, 'knight-preview.png'), cam_dirs=((0, -1, 0.2), (0.9, -0.7, 0.45)))
export(os.path.join(OUT, 'knight.glb'), {'triangles_before_decimate': before})
