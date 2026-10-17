"""Shared helpers for the Blender spike: build in metres, Z up; export glTF (Y up) for three.js."""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector, Matrix


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    s.unit_settings.scale_length = 1.0


def material(name, color, rough=0.5, metal=0.0, clearcoat=0.0, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if clearcoat:
        b.inputs['Coat Weight'].default_value = clearcoat
    if emission:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_obj(name, bm, mat=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    if mat:
        o.data.materials.append(mat)
    return o


def lathe(name, profile, steps=64, mat=None):
    """profile: [(r, z), ...] from bottom to top; spun around Z."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=steps, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_obj(name, bm, mat)
    smooth(o)
    return o


def smooth(o, angle=40):
    for p in o.data.polygons:
        p.use_smooth = True
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        pass
    o.select_set(False)


def apply_all(o):
    bpy.context.view_layer.objects.active = o
    for o2 in bpy.context.selected_objects:
        o2.select_set(False)
    o.select_set(True)
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.select_set(False)


def mod(o, kind, **kw):
    m = o.modifiers.new(kind.lower(), kind)
    for k, v in kw.items():
        setattr(m, k, v)
    return m


def boolean(target, cutter, op='DIFFERENCE'):
    m = mod(target, 'BOOLEAN', operation=op, object=cutter, solver='EXACT')
    apply_all(target)
    bpy.data.objects.remove(cutter)


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def tris(objs=None):
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    for o in objs or bpy.context.scene.objects:
        if o.type != 'MESH':
            continue
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        n += len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
    return n


def bounds(objs=None):
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objs or bpy.context.scene.objects:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi


def export(path, report_extra=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              use_selection=False, export_cameras=False, export_lights=False)
    lo, hi = bounds()
    rep = {'file': path, 'bytes': os.path.getsize(path), 'triangles': tris(),
           'size_m': [round(hi[i] - lo[i], 4) for i in range(3)], 'meshes': [o.name for o in bpy.context.scene.objects if o.type == 'MESH']}
    if report_extra:
        rep.update(report_extra)
    print('OD_REPORT ' + json.dumps(rep))


def preview(path, cam_dirs=((1, -1.2, 0.6),), res=(700, 700), samples=48, hdri_strength=1.0):
    """Quick Cycles CPU render: a studio key/fill/rim on a grey sweep, camera fitted to bounds."""
    s = bpy.context.scene
    lo, hi = bounds()
    c = (lo + hi) / 2
    r = (hi - lo).length / 2
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = samples
    s.cycles.use_denoising = True
    s.render.resolution_x, s.render.resolution_y = res
    s.render.filepath = path
    w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.05, 0.055, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = hdri_strength
    bpy.ops.mesh.primitive_plane_add(size=r * 30, location=(c.x, c.y, lo.z))
    floor = bpy.context.object; floor.name = '_preview_floor'
    floor.data.materials.append(material('_floor', (0.35, 0.35, 0.36), 0.8))
    cam = bpy.data.objects.new('_cam', bpy.data.cameras.new('_cam')); link(cam)
    cam.data.lens = 70
    s.camera = cam
    s.view_settings.view_transform = 'AgX'
    for name, off, e, size in [('key', (1.2, -1, 1.6), 600, 1), ('fill', (-1.5, -0.6, 0.6), 150, 2), ('rim', (-0.3, 1.5, 1.2), 400, 1)]:
        L = bpy.data.objects.new('_' + name, bpy.data.lights.new('_' + name, 'AREA')); link(L)
        L.data.energy = e * (r / 0.05) ** 2 * 0.0035
        L.data.size = r * size
        L.location = c + Vector(off) * r * 4
        L.rotation_euler = (c - L.location).to_track_quat('-Z', 'Y').to_euler()
    dist = r / math.tan(math.radians(14)) * 1.15
    for i, cd in enumerate(cam_dirs):
        cam.location = c + Vector(cd).normalized() * dist
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        s.render.filepath = path.replace('.png', f'-{i}.png')
        bpy.ops.render.render(write_still=True)
    # Remove preview-only objects so a later export never includes them.
    for o in list(s.objects):
        if o.name.startswith('_'):
            bpy.data.objects.remove(o)


def out_dir():
    i = sys.argv.index('--') if '--' in sys.argv else None
    return sys.argv[i + 1] if i is not None and len(sys.argv) > i + 1 else os.getcwd()
