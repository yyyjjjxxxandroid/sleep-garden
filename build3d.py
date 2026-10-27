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
else:
    from offline_modules import bundle_modules
    (root/'world3d.bundle.js').write_text(bundle_modules(root))
    print('Built with browser-native offline modules (esbuild unavailable).')
assets=json.loads((root/'assets3d-v2/embedded.json').read_text())
audio_manifest=json.loads((root/'audio/sources.json').read_text())
audio_assets={key:'data:audio/mpeg;base64,'+base64.b64encode((root/'audio'/item['file']).read_bytes()).decode() for key,item in audio_manifest.items()}
html=(root/'source.html').read_text()
html=html.replace("(()=>{'use strict';", "Promise.resolve(window.GARDEN_READY).then(()=>{'use strict';")
html=html.replace('})();\n</script>', '});\n</script>',1)
# source.html is the editable template; opening it should show the 3D product.
# Remove its redirect from the generated product to prevent a reload loop.
entry_start=html.index('<!-- source-entry-start -->')
entry_end=html.index('<!-- source-entry-end -->')+len('<!-- source-entry-end -->')
html=html[:entry_start]+html[entry_end:]
css=(root/'world.css').read_text()+(root/'world3d.css').read_text()+(root/'story-world.css').read_text()+(root/'garden-polish.css').read_text()
# Sprite sheets remain in the asset library as visual references. Production
# renders the bone-skinned mesh; don't embed unused 108-frame bitmap atlases.
script='window.GARDEN_AUDIO_ASSETS='+json.dumps(audio_assets,separators=(',',':'))+';\nwindow.STORY_ASSETS='+json.dumps(assets)+';\n'+(root/'world3d.bundle.js').read_text()
html=html.replace('<link rel="stylesheet" href="world.css">','<style>'+css+'</style>')
html=html.replace('<script src="world.js"></script>','<script>'+script+'</script>')
html=html.replace('拖动探索 · 双指缩放','拖动环绕花园 · 双指缩放与移动')
html=html.replace('手绘花园：垂柳、池塘、花簇和小猫','三维花园：垂柳、池塘、花簇和散步的小猫')
html=html.replace("weather:'rain',wind:35,light:40","weather:'clear',wind:35,light:65")
html=html.replace('细雨 · 轻风 · 一点点呼噜','微风 · 流水 · 一点点呼噜')
html=html.replace('今晚的声音，已经准备好了','花园的声音，已经准备好了')
html=html.replace('sun:10,wind:35,rain:60,bugs:16,cat:22,water:22','sun:10,wind:35,rain:0,bugs:16,cat:22,water:35')
html=html.replace('已经恢复为细雨、轻风和一点点呼噜。','已经恢复为微风、流水和一点点呼噜。')
html=html.replace('<title>眠境花园 · 把时间交给风</title>','<title>眠境花园 · 3D 陪伴世界</title>')
html=html.replace('</main>','<details class="asset-credits"><summary>素材</summary><p>猫：<a href="https://sketchfab.com/3d-models/bicolor-cat-e623a618ca344a8393d7ba4d63ec23cf" target="_blank" rel="noreferrer">Bicolor Cat / kenchoo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>，调整比例与材质。<br>植物与石头：Kenney Nature Kit · CC0。<br>Three.js · MIT。声音：Freesound CC0 自然实录与 Lo-fi 音乐，经频段、响度与循环处理；其余环境与天气为本 Demo 自制。</p></details></main>')
html=html.replace('猫：<a href="https://sketchfab.com/3d-models/bicolor-cat-e623a618ca344a8393d7ba4d63ec23cf" target="_blank" rel="noreferrer">Bicolor Cat / kenchoo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>，调整比例与材质。','猫：本 Demo 原创绘本造型与程序动画。').replace('Kenney Nature Kit · CC0','Quaternius Stylized Nature MegaKit · CC0')
# Keep new weather credits in the saved deliverable, outside the presentation UI.
notices="Third-party notices\n\nQuaternius Stylized Nature MegaKit — Quaternius\nhttps://quaternius.com/\nCC0-1.0: https://creativecommons.org/publicdomain/zero/1.0/\n\n"
notices+="Three.js — MIT\n"+(root/'vendor/three/LICENSE').read_text()+"\n\n"
notices+="Audio — loop, filtering, crossfade and loudness processing applied.\n"
for key,item in audio_manifest.items():
    notices+=item['title']+" — "+item['creator']+"\n"+item['sourcePage']+"\n"+item['license']+"\n\n"
notices+="Weather data by Open-Meteo: https://open-meteo.com/\nCC BY 4.0: https://creativecommons.org/licenses/by/4.0/\nWeather codes and solar times are mapped to stylized garden visuals.\n\nPlace names: BigDataCloud — https://www.bigdatacloud.com/\n"
(root/'THIRD_PARTY_NOTICES.txt').write_text(notices)
html=html.replace('</body>','<!--\n'+notices.replace('--','—')+'\n-->\n</body>')
html=html.replace('<script src="session-clock.js"></script>','<script>'+ (root/'session-clock.js').read_text()+'</script>')
html=html.replace('<script src="garden-audio.js"></script>','<script>'+ (root/'garden-audio.js').read_text()+'</script>')
html=html.replace('<script src="city-soundscape.js"></script>','<script>'+ (root/'city-soundscape.js').read_text()+'</script>')
for name in ['companion-plan.js','ai-companion.js','garden-personalization.js','garden-experience.js','garden-environment.js']:
    html=html.replace('<script src="'+name+'"></script>','<script>'+ (root/name).read_text()+'</script>')
html=html.replace('<link rel="stylesheet" href="garden-experience.css">','<style>'+ (root/'garden-experience.css').read_text()+'</style>')
html=html.replace('<link rel="stylesheet" href="city-world.css">','<style>'+ (root/'city-world.css').read_text()+'</style>')
html=html.replace('<link rel="stylesheet" href="pet-care.css">','<style>'+ (root/'pet-care.css').read_text()+'</style>')
html=html.replace('<script src="city-experience.js"></script>','<script>'+ (root/'city-experience.js').read_text()+'</script>')
html=html.replace('<link rel="stylesheet" href="ai-companion.css">','<style>'+ (root/'ai-companion.css').read_text()+'</style>')
(root/'index.html').write_text(html)
print('Built offline 3D HTML',round(len(html.encode())/1024/1024,2),'MB')
