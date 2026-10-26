"""Install the optional, CPU-only Chinese voice locally. Never downloads on npm start."""
from pathlib import Path
import hashlib, os, shutil, subprocess, sys, tarfile, urllib.request

ROOT = Path(__file__).resolve().parent.parent
MODEL = 'kokoro-int8-multi-lang-v1_1'
URL = f'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/{MODEL}.tar.bz2'
SHA256 = 'a1e94694776049035c4f2c6529f003aaece993c76aae9a78995831c3c4dcafc6'
ARCHIVE_BYTES = 147031220
TARGET = ROOT / 'models/companion-tts'

def main():
    venv = ROOT / '.venv-tts'
    python = venv / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    uv = shutil.which('uv')
    if not python.exists():
        if uv:
            subprocess.run([uv, 'venv', '--python', '3.12', str(venv)], check=True)
        elif (3, 10) <= sys.version_info[:2] <= (3, 13):
            subprocess.run([sys.executable, '-m', 'venv', str(venv)], check=True)
        else:
            raise SystemExit('请先安装 Python 3.10–3.13 或 uv，再运行 npm run setup:voice。')
    installer = [uv, 'pip', 'install', '--python', str(python)] if uv else [str(python), '-m', 'pip', 'install']
    subprocess.run(installer + ['sherpa-onnx==1.12.40', 'numpy>=1.26,<3'], check=True)
    TARGET.mkdir(parents=True, exist_ok=True)
    ready = TARGET / MODEL / '.ready'
    if not ready.exists():
        archive = TARGET / (MODEL + '.tar.bz2')
        if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
            if archive.exists() and archive.stat().st_size >= ARCHIVE_BYTES:
                archive.unlink()  # A complete, corrupt archive cannot be resumed.
            print('下载中文语音模型，约 147 MB；仅首次需要联网。', flush=True)
            # Keep each retry bounded and resume a partial download when curl exists.
            curl = shutil.which('curl')
            if curl:
                for _ in range(12):
                    result = subprocess.run([curl, '-fL', '-C', '-', '--connect-timeout', '15', '--max-time', '55', URL, '-o', str(archive)])
                    if result.returncode == 0:
                        break
                else:
                    raise SystemExit('下载中断，部分文件已保留。稍后重新运行同一命令即可继续。')
            else:
                with urllib.request.urlopen(URL, timeout=45) as response, archive.open('wb') as output:
                    shutil.copyfileobj(response, output)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
            archive.unlink(missing_ok=True)
            raise SystemExit('模型 SHA-256 不匹配，未解压，请重试。')
        with tarfile.open(archive) as bundle:
            if hasattr(tarfile, 'data_filter'):
                bundle.extractall(TARGET, filter='data')
            else:
                # Python 3.10 installations predating extraction filters.
                for member in bundle.getmembers():
                    if not (TARGET / member.name).resolve().is_relative_to(TARGET.resolve()) or not (member.isfile() or member.isdir()):
                        raise SystemExit('模型归档包含无效路径，未解压。')
                bundle.extractall(TARGET)
        ready.write_text(SHA256 + '\n')
        archive.unlink()
    print('小猫本机中文语音安装完成。重启 npm start 后，点击“听这句”试听。')

if __name__ == '__main__':
    main()
