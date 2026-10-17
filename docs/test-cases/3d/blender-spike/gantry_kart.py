"""Kart-track start gantry (truss towers, beam, checkered banner, start lights) and a racing kart with driver.
Real size in metres; the scene scales them to 1:87. Gantry spans x, kart faces +X. Base on z=0.
Usage: blender -b -P gantry_kart.py -- <outdir>"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bmesh
import numpy as np
from mathutils import Vector
from od_blender import *

OUT = out_dir()

def box(size, loc, mat, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod(o, 'BEVEL', width=bevel, segments=3)
        apply_all(o)
    o.data.materials.append(mat)
    smooth(o, 35)
    return o

def tube(a, b, r, mat, verts=10):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    o.data.materials.append(mat)
    smooth(o, 50)
    return o

def checker_image(name, nx, ny, px=32):
    img = bpy.data.images.new(name, nx * px, ny * px)
    yy, xx = np.mgrid[0:ny * px, 0:nx * px]
    v = (((xx // px) + (yy // px)) % 2).astype(np.float32) * 0.9 + 0.04
    rgba = np.stack([v, v, v, np.ones_like(v)], -1)
    img.pixels = rgba.ravel().tolist()
    img.file_format = 'PNG'; img.filepath_raw = os.path.join(OUT, name + '.png'); img.save()
    return img

def image_material(name, img, rough=0.7):
    m = bpy.data.materials.new(name); m.use_nodes = True
    n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = img; n.interpolation = 'Closest'
    m.node_tree.links.new(n.outputs['Color'], m.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = rough
    return m

def plane_uv(o):
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=1.0, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT'); o.select_set(False)

def text(body, loc, size, mat, extrude=0.02, rot=(math.pi / 2, 0, 0)):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    t = bpy.context.object
    t.data.body = body; t.data.size = size; t.data.extrude = extrude
    t.data.align_x = 'CENTER'; t.data.align_y = 'CENTER'
    bpy.ops.object.convert(target='MESH')
    t.data.materials.append(mat)
    return t

# ── Gantry ───────────────────────────────────────────────────────
reset()
steel = material('steel', (0.78, 0.8, 0.83), rough=0.32, metal=0.9)
red_paint = material('red_paint', (0.62, 0.05, 0.04), rough=0.35, clearcoat=0.6)
concrete = material('concrete', (0.55, 0.54, 0.51), rough=0.9)
lamp_off = material('lamp_glass', (0.08, 0.0, 0.0), rough=0.15, emission=(1, 0.06, 0.03), strength=6)
white = material('white_paint', (0.92, 0.92, 0.9), rough=0.4)
SPAN, HT, T = 5.6, 4.6, 0.5  # inner span, height, tower width

parts = []
def truss(p0, p1, axis_u, axis_v, w, bays):
    """Square lattice truss from p0 to p1 with corner chords and zig-zag diagonals."""
    p0, p1 = Vector(p0), Vector(p1)
    corners = [axis_u * (su * w / 2) + axis_v * (sv * w / 2) for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for c in corners:
        parts.append(tube(p0 + c, p1 + c, 0.045, red_paint))
    for i in range(bays):
        a = p0 + (p1 - p0) * (i / bays); b = p0 + (p1 - p0) * ((i + 1) / bays)
        for k in range(4):
            c0, c1 = corners[k], corners[(k + 1) % 4]
            parts.append(tube(a + c0, b + c1, 0.022, steel, 8) if i % 2 == 0 else tube(a + c1, b + c0, 0.022, steel, 8))
            parts.append(tube(a + c0, a + c1, 0.02, steel, 8))

X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
for s in (-1, 1):
    x = s * (SPAN / 2 + T / 2)
    parts.append(box((T + 0.4, T + 0.4, 0.35), (x, 0, 0.175), concrete, 0.03))
    truss((x, 0, 0.35), (x, 0, HT), X, Y, T, 8)
truss((-(SPAN / 2 + T), 0, HT - T / 2), ((SPAN / 2 + T), 0, HT - T / 2), Y, Z, T, 14)
# Header panel on the beam with START lettering, both faces.
parts.append(box((SPAN + 2 * T, 0.08, 0.7), (0, -T / 2 - 0.06, HT - T / 2), white, 0.02))
parts.append(text('START', (0, -T / 2 - 0.105, HT - T / 2), 0.55, red_paint, 0.02))
# Five start lights under the beam.
for i in range(5):
    x = (i - 2) * 0.55
    parts.append(box((0.42, 0.3, 0.42), (x, 0, HT - T - 0.24), material('pod', (0.03, 0.03, 0.03), rough=0.5), 0.04))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.13, location=(x, -0.13, HT - T - 0.24))
    lens = bpy.context.object; lens.scale = (1, 0.45, 1); lens.data.materials.append(lamp_off); smooth(lens); parts.append(lens)
# Checkered banner hanging below, with a slight sag.
chk = image_material('checker', checker_image('gantry_checker', 16, 2))
bpy.ops.mesh.primitive_grid_add(x_subdivisions=32, y_subdivisions=2, size=1, location=(0, 0.02, HT - T - 0.75))
ban = bpy.context.object
ban.rotation_euler = (math.pi / 2, 0, 0); ban.scale = (SPAN * 0.92, 0.55, 1)
bpy.ops.object.transform_apply(rotation=True, scale=True)
for v in ban.data.vertices:
    v.co.z -= 0.06 * (1 - (2 * v.co.x / (SPAN * 0.92)) ** 2)
mod(ban, 'SOLIDIFY', thickness=0.015); apply_all(ban)
ban.data.materials.append(chk); plane_uv(ban); parts.append(ban)
for s in (-1, 1):  # banner ties
    parts.append(tube((s * SPAN * 0.45, 0.02, HT - T - 0.5), (s * SPAN * 0.45, 0.02, HT - T), 0.012, steel, 6))
gantry = join(parts, 'gantry')
preview(os.path.join(OUT, 'gantry-preview.png'), cam_dirs=((0.6, -1, 0.35),))
export(os.path.join(OUT, 'gantry.glb'))

# ── Kart ────────────────────────────────────────────────────────
reset()
body_red = material('kart_red', (0.75, 0.04, 0.03), rough=0.25, clearcoat=1.0)
black = material('tyre', (0.02, 0.02, 0.022), rough=0.85)
rim = material('rim', (0.75, 0.76, 0.78), rough=0.25, metal=1.0)
frame_m = material('frame', (0.1, 0.1, 0.11), rough=0.4, metal=0.8)
suit = material('suit', (0.08, 0.2, 0.55), rough=0.7)
helmet_m = material('helmet', (0.95, 0.82, 0.1), rough=0.2, clearcoat=1.0)
visor = material('visor', (0.01, 0.01, 0.015), rough=0.05, metal=0.3)
num = material('number_plate', (0.95, 0.95, 0.93), rough=0.4)
parts = []
WB, TF, TR = 1.05, 1.0, 1.15  # wheelbase, front/rear track
# Tyres and rims.
for (x, track, w, R) in ((WB / 2, TF, 0.13, 0.135), (-WB / 2, TR, 0.2, 0.14)):
    for s in (-1, 1):
        prof = [(R * 0.62, -w / 2), (R * 0.92, -w / 2), (R, -w / 2 + 0.02), (R, w / 2 - 0.02), (R * 0.92, w / 2), (R * 0.62, w / 2)]
        t = lathe('tyre', prof, 40, black)
        t.rotation_euler = (math.pi / 2, 0, 0); t.location = (x, s * track / 2, R)
        parts.append(t)
        r = lathe('rim', [(0, -w / 2 + 0.01), (R * 0.64, -w / 2 + 0.01), (R * 0.64, w / 2 - 0.01), (0, w / 2 - 0.01)], 24, rim)
        r.rotation_euler = (math.pi / 2, 0, 0); r.location = (x, s * track / 2, R)
        parts.append(r)
    parts.append(tube((x, -track / 2, 0.135), (x, track / 2, 0.135), 0.02, frame_m))  # axle
# Chassis rails.
for s in (-1, 1):
    parts.append(tube((WB / 2 + 0.15, s * 0.22, 0.06), (-WB / 2 - 0.05, s * 0.3, 0.06), 0.016, frame_m))
# Floor tray, side pods, nose fairing, rear bumper.
parts.append(box((1.1, 0.5, 0.012), (0.0, 0, 0.05), frame_m, 0.004))
for s in (-1, 1):
    parts.append(box((0.6, 0.16, 0.13), (-0.02, s * 0.44, 0.12), body_red, 0.05))
nose = box((0.3, 0.95, 0.1), (WB / 2 + 0.33, 0, 0.1), body_red, 0.045)  # ahead of the front axle
for v in nose.data.vertices:  # taper the top toward the front
    if v.co.z > 0.1 and v.co.x > WB / 2 + 0.33: v.co.z -= 0.035
parts.append(nose)
parts.append(box((0.3, 0.5, 0.26), (0.32, 0, 0.2), body_red, 0.06))  # front panel / cowl
parts.append(box((0.03, 0.22, 0.17), (0.47, 0, 0.36), num, 0.012))  # number board
parts.append(text('7', (0.488, 0, 0.36), 0.15, frame_m, 0.005, rot=(math.pi / 2, 0, math.pi / 2)))
parts.append(box((0.12, 1.15, 0.08), (-WB / 2 - 0.2, 0, 0.12), frame_m, 0.03))
# Engine on the right rear, seat in the middle.
parts.append(box((0.24, 0.2, 0.24), (-0.38, -0.3, 0.24), material('engine', (0.45, 0.45, 0.47), rough=0.4, metal=0.7), 0.03))
seat = box((0.36, 0.36, 0.3), (-0.2, 0.03, 0.23), material('seat', (0.04, 0.04, 0.045), rough=0.5), 0.08)
parts.append(seat)
# Steering column + wheel.
parts.append(tube((0.38, 0, 0.1), (0.2, 0, 0.42), 0.014, frame_m))
bpy.ops.mesh.primitive_torus_add(major_radius=0.13, minor_radius=0.017, location=(0.2, 0, 0.43), rotation=(0, math.radians(-60), 0))
w = bpy.context.object; w.data.materials.append(black); parts.append(w)
# Driver: torso, arms to the wheel, helmet with visor.
torso = lathe('torso', [(0, 0), (0.16, 0), (0.19, 0.12), (0.17, 0.32), (0.11, 0.42), (0, 0.44)], 24, suit)
torso.scale = (0.75, 1, 1); torso.location = (-0.22, 0.03, 0.3); torso.rotation_euler = (0, math.radians(-14), 0)
parts.append(torso)
for s in (-1, 1):
    parts.append(tube((-0.16, s * 0.17, 0.62), (0.08, s * 0.13, 0.5), 0.045, suit))
    parts.append(tube((0.08, s * 0.13, 0.5), (0.18, s * 0.11, 0.46), 0.04, suit))
    parts.append(tube((0.2, s * 0.15, 0.1), (0.35, s * 0.12, 0.12), 0.05, suit))  # legs into the nose
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.14, location=(-0.08, 0.03, 0.87))
h = bpy.context.object; h.scale = (1.1, 0.95, 1); h.data.materials.append(helmet_m); smooth(h); parts.append(h)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.13, location=(-0.04, 0.03, 0.88))
v = bpy.context.object; v.scale = (1.06, 0.88, 0.42); v.data.materials.append(visor); smooth(v); parts.append(v)
kart = join(parts, 'kart')
preview(os.path.join(OUT, 'kart-preview.png'), cam_dirs=((1, -0.9, 0.55),))
export(os.path.join(OUT, 'kart.glb'))
