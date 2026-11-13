from pathlib import Path
import json, zipfile, argparse
root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--server', required=True, help='Permanent HTTPS server origin')
args = parser.parse_args()
from urllib.parse import urlsplit
u = urlsplit(args.server)
if u.scheme != 'https' or not u.netloc or u.path not in ('','/') or u.query or u.fragment or u.username:
    parser.error('Expected HTTPS origin without path or credentials')
origin = f'https://{u.netloc}'
dist = root / 'dist'
dist.mkdir(exist_ok=True)
version = json.loads((root / 'extension/manifest.json').read_text())['version']
archive = dist / f'gr-vasya-{version}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted((root / 'extension').iterdir()):
        if path.is_file():
            content = path.read_bytes()
            if path.name == 'config.js': content = ('globalThis.GR_DEFAULT_SERVER = '+json.dumps(origin)+';\n').encode()
            if path.name == 'manifest.json':
                manifest = json.loads(content)
                manifest['optional_host_permissions'] = [origin+'/*']
                manifest['host_permissions'] = [origin+'/*']
                content = json.dumps(manifest,ensure_ascii=False,indent=2).encode()
            z.writestr(path.name,content)
print(archive)
