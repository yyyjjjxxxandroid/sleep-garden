"""Bundle the 3D world, licensed GLB assets and existing product flow offline."""
from pathlib import Path
import base64,json,subprocess,shutil,os
root=Path(__file__).resolve().parent
bundler=os.environ.get('GARDEN_ESBUILD') or shutil.which('esbuild')
if not bundler and (root/'node_modules/.bin/esbuild').exists():
    bundler=str(root/'node_modules/.bin/esbuild')
if not bundler and Path('/private/tmp/garden-esbuild/bin/esbuild').exists():
    bundler='/private/tmp/garden-esbuild/bin/esbuild'
if bundler:
    subprocess.run([bundler,str(root/'story-world.js'),'--bundle','--format=iife','--minify','--alias:three='+str(root/'vendor/three/build/three.module.js'),'--outfile='+str(root/'world3d.bundle.js')],check=True)
elif (root/'world3d.bundle.js').exists() and (root/'world3d.bundle.js').stat().st_mtime >= (root/'world3d.js').stat().st_mtime:
    print('Using bundled 3D JavaScript; npm install to rebuild changed JavaScript.')
else:
    raise SystemExit('Run npm install first, or set GARDEN_ESBUILD to an esbuild executable.')
assets=json.loads((root/'assets3d-v2/embedded.json').read_text())
html=(root/'source.html').read_text()
css=(root/'world.css').read_text()+(root/'world3d.css').read_text()+(root/'story-world.css').read_text()
script='window.STORY_ASSETS='+json.dumps(assets)+';\n'+(root/'world3d.bundle.js').read_text()
html=html.replace('<link rel="stylesheet" href="world.css">','<style>'+css+'</style>')
html=html.replace('<script src="world.js"></script>','<script>'+script+'</script>')
html=html.replace('拖动探索 · 双指缩放','拖动环绕花园 · 双指缩放与移动')
html=html.replace('手绘花园：垂柳、池塘、花簇和小猫','三维花园：垂柳、池塘、花簇和散步的小猫')
html=html.replace("weather:'rain',wind:35,light:40","weather:'clear',wind:35,light:65")
html=html.replace('细雨 · 轻风 · 一点点呼噜','微风 · 流水 · 一点点呼噜')
html=html.replace('今晚的声音，已经准备好了','花园的声音，已经准备好了')
html=html.replace('sun:10,wind:35,rain:60,bugs:16,cat:22,water:22','sun:10,wind:35,rain:0,bugs:16,cat:22,water:35')
html=html.replace('已经恢复为细雨、轻风和一点点呼噜。','已经恢复为微风、流水和一点点呼噜。')
html=html.replace("function setWeather(kind){state.weather=kind;","function setWeather(kind){state.focused=false;state.weather=kind;")
html=html.replace("worldEngine.weatherChanged();worldEngine.home()}updateTitle()","worldEngine.weatherChanged();worldEngine.home()}showMode();updateTitle()")
html=html.replace('<title>眠境花园 · 把时间交给风</title>','<title>眠境花园 · 3D 声景世界</title>')
html=html.replace('</main>','<details class="asset-credits"><summary>素材</summary><p>猫：<a href="https://sketchfab.com/3d-models/bicolor-cat-e623a618ca344a8393d7ba4d63ec23cf" target="_blank" rel="noreferrer">Bicolor Cat / kenchoo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>，调整比例与材质。<br>植物与石头：Kenney Nature Kit · CC0。<br>Three.js · MIT。其余环境与天气为本 Demo 自制。</p></details></main>')
html=html.replace('猫：<a href="https://sketchfab.com/3d-models/bicolor-cat-e623a618ca344a8393d7ba4d63ec23cf" target="_blank" rel="noreferrer">Bicolor Cat / kenchoo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>，调整比例与材质。','猫：本 Demo 原创绘本造型与程序动画。').replace('Kenney Nature Kit · CC0','Quaternius Stylized Nature MegaKit · CC0')
(root/'index.html').write_text(html)
print('Built offline 3D HTML',round(len(html.encode())/1024/1024,2),'MB')
