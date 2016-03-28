import bpy

stl_file = 'original.stl'
fbx_file = 'test.fbx'
new_stl_file = 'test.stl'

# Delete all existing objects
for ob in bpy.context.scene.objects:
    ob.select = True
bpy.ops.object.delete()

bpy.ops.import_mesh.stl(filepath=stl_file)
ob = bpy.context.object

while len(ob.data.polygons) > 8000:
    bpy.ops.object.modifier_add(type='DECIMATE')
    bpy.context.object.modifiers["Decimate"].ratio = 0.95
    bpy.ops.object.modifier_apply(apply_as='DATA', modifier="Decimate")

print('Vertices:', str(len(ob.data.vertices)))
print('Edges:', str(len(ob.data.edges)))
print('Polygons:', str(len(ob.data.polygons)))

bpy.ops.export_scene.fbx(filepath=fbx_file)
bpy.ops.export_mesh.stl(filepath=new_stl_file)
