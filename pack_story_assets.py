"""Losslessly preserve model data; resize/encode web textures for mobile delivery."""
from pathlib import Path
import json,base64,io
from PIL import Image

root=Path(__file__).resolve().parent
folder=root/'assets3d-v2/quaternius-stylized-nature-megakit'
manifest=json.loads((folder/'manifest.json').read_text())
models={};files={}
for entries in manifest['recommended'].values():
    for entry in entries:
        path=folder/entry['file'];data=json.loads(path.read_text())
        models[path.stem]=data
        for buf in data.get('buffers',[]):
            name=buf['uri']
            if name not in files:files[name]='data:application/octet-stream;base64,'+base64.b64encode((path.parent/name).read_bytes()).decode()
        for img in data.get('images',[]):
            name=img['uri']
            if name in files:continue
            im=Image.open(path.parent/name)
            limit=1024 if 'Normal' not in name else 768
            im.thumbnail((limit,limit),Image.Resampling.LANCZOS)
            stream=io.BytesIO();im.save(stream,format='WEBP',quality=90,method=6)
            files[name]='data:image/webp;base64,'+base64.b64encode(stream.getvalue()).decode()
            img['mimeType']='image/webp'
out={'models':models,'files':files}
(root/'assets3d-v2/embedded.json').write_text(json.dumps(out,separators=(',',':')))
print(f'Packed {len(models)} textured models, {len(files)} shared resources: {(root/"assets3d-v2/embedded.json").stat().st_size/1024/1024:.2f} MB')
