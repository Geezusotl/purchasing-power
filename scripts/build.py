"""Create a static deployment directory from explicitly allowlisted public files."""
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def build():
    snapshot = json.loads((ROOT / 'data/snapshot.json').read_text(encoding='utf-8'))
    if snapshot.get('schemaVersion') != 1 or len(snapshot.get('series', {})) != 7:
        raise ValueError('Missing or invalid official data snapshot')
    target = ROOT / 'dist'
    target.mkdir(exist_ok=True)
    files = ['index.html', 'style.css', 'app.js', 'math.js', 'data.js', 'status.js', 'status.json', 'favicon.svg', 'data/snapshot.json']
    for name in files:
        source = ROOT / name
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    (target / '.nojekyll').touch()
    print('Built static dashboard: dist/')


if __name__ == '__main__':
    build()
