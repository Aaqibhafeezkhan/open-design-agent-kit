"""Wrought-iron tripod brazier with a hammered bowl and glowing coals, 1.2 m tall, base on z=0.
Procedural iron is baked into textures (color+AO, roughness, normal) so glTF/three.js can use it.
Usage: blender -b -P brazier.py -- <outdir>"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bmesh, random
import numpy as np
from mathutils import Vector, Matrix
from od_blender import *

reset()
OUT = out_dir()
random.seed(7)
H = 1.2          # overall height
BOWL_Z = 0.86    # bowl bottom

# Bowl: hammered iron with a rolled rim, a thick outer lip and a foot ring.
bowl = lathe('bowl', [(0, BOWL_Z), (0.09, BOWL_Z), (0.11, BOWL_Z - 0.03), (0.15, BOWL_Z - 0.03), (0.17, BOWL_Z + 0.01),
                      (0.27, BOWL_Z + 0.08), (0.36, BOWL_Z + 0.2), (0.4, BOWL_Z + 0.27), (0.425, BOWL_Z + 0.285),
                      (0.43, BOWL_Z + 0.3), (0.415, BOWL_Z + 0.31), (0.39, BOWL_Z + 0.285), (0.34, BOWL_Z + 0.21),
                      (0.25, BOWL_Z + 0.1), (0.15, BOWL_Z + 0.045), (0, BOWL_Z + 0.035)], 96)
parts = [bowl]

def bar(name, pts, radius, square=False):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = 1 if square else 4
    cu.resolution_u = 12
    cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = link(bpy.data.objects.new(name, cu))
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o.select_set(False)
    return o

def spiral(cx, cz, r0, turns, start_angle, n=18, sign=1):
    """Points of a flat scroll in the (radial, z) plane, centred on (cx, cz), shrinking inward."""
    pts = []
    for i in range(n + 1):
        t = i / n
        a = start_angle + sign * t * turns * math.tau
        r = r0 * (1 - 0.72 * t)
        pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts

# Three S-scroll legs: from under the rim, out and down to a scrolled foot.
for k in range(3):
    a = k * math.tau / 3
    R = Matrix.Rotation(a, 3, 'Z')
    path2d = [(0.33, BOWL_Z + 0.2), (0.4, BOWL_Z + 0.06), (0.42, BOWL_Z - 0.12), (0.36, 0.5), (0.3, 0.32), (0.32, 0.17), (0.4, 0.09)]
    path2d += spiral(0.47, 0.11, 0.075, 0.85, math.radians(200), 14, sign=1)[1:]
    leg = bar(f'leg{k}', [R @ Vector((x, 0, z)) for x, z in path2d], 0.018)
    parts.append(leg)
    # Upper scroll tucked under the bowl.
    up = spiral(0.36, BOWL_Z - 0.05, 0.07, 0.9, math.radians(80), 14, sign=-1)
    parts.append(bar(f'scroll{k}', [R @ Vector((x, 0, z)) for x, z in up], 0.012))
    # Foot pad.
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.045, depth=0.02, location=R @ Vector((0.42, 0, 0.01)))
    parts.append(bpy.context.object)
    # Rivets around the rim.
    for j in range(8):
        b = a + j * math.tau / 24
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.011,
                                             location=(0.408 * math.cos(b), 0.408 * math.sin(b), BOWL_Z + 0.268))
        parts.append(bpy.context.object)

# A brace ring tying the legs together at knee height.
bpy.ops.mesh.primitive_torus_add(major_radius=0.315, minor_radius=0.013, major_segments=96, minor_segments=10, location=(0, 0, 0.42))
parts.append(bpy.context.object)
# A short twisted central spindle under the bowl.
parts.append(lathe('spindle', [(0, 0.42), (0.03, 0.42), (0.02, 0.5), (0.035, 0.62), (0.02, 0.74), (0.04, BOWL_Z - 0.02), (0, BOWL_Z - 0.02)], 24))

for o in parts:
    smooth(o, 50)
iron = join(parts, 'brazier')

# UVs for baking.
bpy.ops.object.select_all(action='DESELECT')
iron.select_set(True)
bpy.context.view_layer.objects.active = iron
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')

# Procedural hammered iron: soot-dark base with rust in the hollows, hammer dents as bump.
src = bpy.data.materials.new('iron_src'); src.use_nodes = True
nt = src.node_tree; N = nt.nodes; L = nt.links
bsdf = N['Principled BSDF']
coord = N.new('ShaderNodeTexCoord')
vor = N.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 38; vor.feature = 'SMOOTH_F1'
noise = N.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 9; noise.inputs['Detail'].default_value = 8
ramp = N.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.38; ramp.color_ramp.elements[0].color = (0.028, 0.025, 0.022, 1)
ramp.color_ramp.elements[1].position = 0.72; ramp.color_ramp.elements[1].color = (0.16, 0.075, 0.035, 1)
rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = 0.38; rr.inputs['To Max'].default_value = 0.78
bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35; bump.inputs['Distance'].default_value = 0.004
L.new(coord.outputs['Object'], vor.inputs['Vector']); L.new(coord.outputs['Object'], noise.inputs['Vector'])
L.new(noise.outputs['Fac'], ramp.inputs['Fac']); L.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
L.new(noise.outputs['Fac'], rr.inputs['Value']); L.new(rr.outputs['Result'], bsdf.inputs['Roughness'])
L.new(vor.outputs['Distance'], bump.inputs['Height']); L.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
bsdf.inputs['Metallic'].default_value = 0.75
iron.data.materials.clear(); iron.data.materials.append(src)

s = bpy.context.scene
s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = 16
SZ = 1024
def bake(kind, colorspace='sRGB', **kw):
    img = bpy.data.images.new(f'brazier_{kind.lower()}', SZ, SZ, float_buffer=False)
    img.colorspace_settings.name = colorspace
    node = N.new('ShaderNodeTexImage'); node.image = img
    N.active = node
    for n in N: n.select = False
    node.select = True
    bpy.ops.object.bake(type=kind, margin=8, **kw)
    N.remove(node)
    return img

t0 = __import__('time').time()
s.render.bake.use_pass_direct = False; s.render.bake.use_pass_indirect = False; s.render.bake.use_pass_color = True
col = bake('DIFFUSE', pass_filter={'COLOR'})
rough = bake('ROUGHNESS', 'Non-Color')
nor = bake('NORMAL', 'Non-Color', normal_space='TANGENT')
ao = bake('AO', 'Non-Color')
# Fold AO into the colour so crevices stay dark under any light.
c = np.array(col.pixels[:]).reshape(-1, 4); a = np.array(ao.pixels[:]).reshape(-1, 4)
c[:, :3] *= (0.35 + 0.65 * a[:, :1])
col.pixels = c.ravel().tolist()
bake_s = round(__import__('time').time() - t0, 1)
for img in (col, rough, nor):
    img.file_format = 'PNG'; img.filepath_raw = os.path.join(OUT, img.name + '.png'); img.save()

# Export material: the baked images only.
out = bpy.data.materials.new('iron'); out.use_nodes = True
on = out.node_tree.nodes; ol = out.node_tree.links; ob = on['Principled BSDF']
def tex(img):
    n = on.new('ShaderNodeTexImage'); n.image = img; return n
ol.new(tex(col).outputs['Color'], ob.inputs['Base Color'])
ol.new(tex(rough).outputs['Color'], ob.inputs['Roughness'])
nm = on.new('ShaderNodeNormalMap'); ol.new(tex(nor).outputs['Color'], nm.inputs['Color']); ol.new(nm.outputs['Normal'], ob.inputs['Normal'])
ob.inputs['Metallic'].default_value = 0.75
iron.data.materials.clear(); iron.data.materials.append(out)

# Coals: a heap of glowing lumps in the bowl (separate mesh, emissive).
coal = material('coal', (0.02, 0.015, 0.012), rough=0.9, emission=(1.0, 0.32, 0.06), strength=3.0)
lumps = []
for i in range(70):
    r = 0.29 * math.sqrt(random.random()); b = random.random() * math.tau
    # Rest on the bowl's inner surface, heaped toward the middle.
    z = BOWL_Z + float(np.interp(r, [0, 0.15, 0.25, 0.34], [0.035, 0.045, 0.1, 0.21])) + 0.035 + 0.07 * (1 - r / 0.29) + random.random() * 0.02
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.03 + random.random() * 0.025, location=(r * math.cos(b), r * math.sin(b), z))
    o = bpy.context.object
    o.rotation_euler = (random.random() * 3, random.random() * 3, random.random() * 3)
    o.scale = (1, 0.8 + random.random() * 0.4, 0.6 + random.random() * 0.3)
    lumps.append(o)
coals = join(lumps, 'coals'); coals.data.materials.clear(); coals.data.materials.append(coal)

preview(os.path.join(OUT, 'brazier-preview.png'), cam_dirs=((0.9, -1, 0.45),))
export(os.path.join(OUT, 'brazier.glb'), {'bake_seconds': bake_s})
