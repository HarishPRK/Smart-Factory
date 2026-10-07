# Paste this entire file into the existing EC2 Instance Connect terminal.
sudo python3 - <<'PY_METER_WATTS'

# Updates only the already-installed Aituzero widget. No AWS calls or service restarts.
# The compressed data contains byte edits for the exact tested release, not executable Python.
import base64, hashlib, json, os, shutil, sys, tempfile, urllib.request, zlib
from pathlib import Path

PATCH_DATA = """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"""
raw = zlib.decompress(base64.b64decode(PATCH_DATA))
if hashlib.sha256(raw).hexdigest() != '1c3c4a528880a1b45b5aabbe58c6bb1c2a5608f6827a55350d07bdbdc625ed43':
    raise SystemExit('Patch text is incomplete or corrupted. No files changed.')
PATCHES = json.loads(raw)

def sha(content):
    return hashlib.sha256(content).hexdigest()

def atomic_write(path, content, owner):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix='.meter-watts-', dir=path.parent, delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o644)
        if os.name != 'nt':
            os.chown(temporary, owner.st_uid, owner.st_gid)
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()

def install(widget, backups, verify_http=True):
    widget = widget.resolve(strict=True)
    index_patch = next(p for p in PATCHES if p['target'] == 'index.html')
    if sha((widget / 'index.html').read_bytes()) == index_patch['after']:
        for patch in PATCHES:
            if sha((widget / patch['target']).read_bytes()) != patch['after']:
                raise RuntimeError('Installed index exists but an asset is missing or different.')
        print('Watts update is already installed. Refresh the dashboard with Ctrl+Shift+R.')
        return
    prepared = []
    for patch in PATCHES:
        source = widget / patch['source']
        target = widget / patch['target']
        if os.path.commonpath([str(widget), str(source.resolve())]) != str(widget) or os.path.commonpath([str(widget), str(target.resolve())]) != str(widget):
            raise RuntimeError('Unsafe widget file path. No files changed.')
        before = source.read_bytes()
        if sha(before) != patch['before']:
            raise RuntimeError('Unexpected installed version: ' + patch['source'] + '. No files changed.')
        after = before
        for start, end, replacement in reversed(patch['edits']):
            if not 0 <= start <= end <= len(before):
                raise RuntimeError('Invalid patch offsets. No files changed.')
            after = after[:start] + replacement.encode('utf-8') + after[end:]
        if sha(after) != patch['after']:
            raise RuntimeError('Patched file checksum failed. No files changed.')
        if target != source and target.exists() and sha(target.read_bytes()) != patch['after']:
            raise RuntimeError('Target asset already exists with different content. No files changed.')
        prepared.append((patch, target, after, source.stat()))
    backup = Path(tempfile.mkdtemp(prefix='smart-meter-watts.', dir=backups))
    for patch, _, _, _ in prepared:
        destination = backup / patch['source']
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(widget / patch['source'], destination)
    try:
        # New hashed assets first; atomically switch the entry document last.
        for patch, target, content, owner in sorted(prepared, key=lambda row: row[0]['target'] == 'index.html'):
            atomic_write(target, content, owner)
        if verify_http:
            request = urllib.request.Request('http://127.0.0.1/widgets/aituzero-meter/', headers={'Cache-Control': 'no-cache'})
            with urllib.request.urlopen(request, timeout=10) as response:
                if sha(response.read()) != index_patch['after']:
                    raise RuntimeError('HTTP verification returned an unexpected widget version.')
    except Exception:
        original = backup / 'index.html'
        atomic_write(widget / 'index.html', original.read_bytes(), (widget / 'index.html').stat())
        print('Verification failed. Previous widget entry restored. Backup:', backup)
        raise
    print('Installed meter watts update. Backup:', backup)
    print('JSON and protobuf now calculate V x I x PF; register, card and trend display W.')
    print('Refresh the dashboard with Ctrl+Shift+R. No service restart was needed.')
    print("Rollback: sudo cp -a '" + str(backup / 'index.html') + "' '" + str(widget / 'index.html') + "'")

if __name__ == '__main__':
    if os.geteuid() != 0:
        raise SystemExit('Run the complete supplied block, including sudo python3.')
    try:
        install(Path('/var/www/smart-factory/widgets/aituzero-meter'), Path('/var/backups'))
    except Exception as error:
        raise SystemExit(str(error))

PY_METER_WATTS
