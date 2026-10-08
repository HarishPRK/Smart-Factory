#!/usr/bin/env bash
# Local filesystem fixtures only: no Nginx service, SSH or EC2 connection.
set -Eeuo pipefail
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
fixture=$(mktemp -d /tmp/smart-factory-frontend-test.XXXXXXXX)
cleanup() {
  [[ "$fixture" == /tmp/smart-factory-frontend-test.* && -d "$fixture" ]] || return
  rm -rf -- "$fixture"
}
trap cleanup EXIT
mkdir -p "$fixture/bin"
cat > "$fixture/bin/nginx" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat > "$fixture/bin/curl" <<'STUB'
#!/usr/bin/env bash
if [[ "${FRONTEND_TEST_FAIL_ALWAYS:-0}" == 1 ]] ||
   { [[ "${FRONTEND_TEST_FAIL_NEW:-0}" == 1 ]] && grep -q new-entry "$FRONTEND_TEST_ROOT/index.html"; }; then
  echo 'Mismatched served frontend'
else
  cat "$FRONTEND_TEST_ROOT/index.html"
fi
STUB
chmod +x "$fixture/bin/nginx" "$fixture/bin/curl"
export PATH="$fixture/bin:$PATH"

prepare() {
  local scenario=$1
  local root="$fixture/$scenario/web/smart-factory"
  local release="$fixture/$scenario/release"
  mkdir -p "$root/assets" "$root/widgets" "$release/frontend/assets"
  printf 'old-entry\n' > "$root/index.html"
  printf 'old hashed asset\n' > "$root/assets/old.js"
  printf 'deployment specific public widget\n' > "$root/widgets/keep.txt"
  printf 'new-entry\n' > "$release/frontend/index.html"
  printf 'new hashed asset\n' > "$release/frontend/assets/new.js"
  printf '{}\n' > "$release/release.json"

  # Run the exact installer/rollback logic against private temporary roots.
  # Only the fixed production path and privilege gate are adapted for this
  # non-root fixture. The production scripts contain no test bypass switch.
  python3 - "$source_dir" "$root" "$release" <<'PY'
from pathlib import Path
import sys
source, root, release = map(Path, sys.argv[1:])
for name, output, gate in [
    ('frontend-only-install.sh', 'install.sh', "if [[ $EUID -ne 0 ]]; then echo 'Run this installer with sudo bash.' >&2; exit 1; fi\n"),
    ('frontend-only-rollback.sh', 'rollback.sh', "if [[ $EUID -ne 0 ]]; then echo 'Run rollback with sudo bash.' >&2; exit 1; fi\n"),
]:
    text = (source / name).read_text()
    assert text.count(gate) == 1
    assert text.count('web_root=/var/www/smart-factory\n') == 1
    assert text.count('web_parent=/var/www\n') == 1
    text = text.replace(gate, '').replace('web_root=/var/www/smart-factory\n', f'web_root={root}\n').replace('web_parent=/var/www\n', f'web_parent={root.parent}\n')
    (release / output).write_text(text)
PY
  (cd "$release" && sha256sum frontend/index.html frontend/assets/new.js install.sh rollback.sh release.json > SHA256SUMS)
  export FRONTEND_TEST_ROOT="$root"
  export FRONTEND_TEST_RELEASE="$release"
}

prepare success
bash "$FRONTEND_TEST_RELEASE/install.sh" --web-root "$FRONTEND_TEST_ROOT" > "$fixture/success.log"
grep -q new-entry "$FRONTEND_TEST_ROOT/index.html"
test -s "$FRONTEND_TEST_ROOT/assets/old.js"
test -s "$FRONTEND_TEST_ROOT/assets/new.js"
test -s "$FRONTEND_TEST_ROOT/widgets/keep.txt"
backup=$(find "$(dirname "$FRONTEND_TEST_ROOT")/.smart-factory-frontend-backups" -mindepth 1 -maxdepth 1 -type d -print)
test -s "$backup/original/index.html"
bash "$backup/rollback.sh" "$backup" > "$fixture/rollback.log"
grep -q old-entry "$FRONTEND_TEST_ROOT/index.html"
test -s "$FRONTEND_TEST_ROOT/assets/new.js"
test -s "$backup/original/index.html"

prepare failed-verification
export FRONTEND_TEST_FAIL_NEW=1
if bash "$FRONTEND_TEST_RELEASE/install.sh" --web-root "$FRONTEND_TEST_ROOT" > "$fixture/failure.log" 2>&1; then
  echo 'Expected installation to fail on a mismatched served frontend.' >&2
  exit 1
fi
grep -q old-entry "$FRONTEND_TEST_ROOT/index.html"
test ! -e "$FRONTEND_TEST_ROOT/assets/new.js"
unset FRONTEND_TEST_FAIL_NEW

prepare failed-preflight
export FRONTEND_TEST_FAIL_ALWAYS=1
if bash "$FRONTEND_TEST_RELEASE/install.sh" --web-root "$FRONTEND_TEST_ROOT" > "$fixture/preflight.log" 2>&1; then
  echo 'Expected installation to stop before changing a different served frontend.' >&2
  exit 1
fi
grep -q old-entry "$FRONTEND_TEST_ROOT/index.html"
test ! -e "$(dirname "$FRONTEND_TEST_ROOT")/.smart-factory-frontend-backups"
unset FRONTEND_TEST_FAIL_ALWAYS

prepare wrong-root
if bash "$FRONTEND_TEST_RELEASE/install.sh" --web-root /var/www/other-app > "$fixture/wrong-root.log" 2>&1; then
  echo 'Expected installation to refuse an unconfirmed frontend root.' >&2
  exit 1
fi
grep -q old-entry "$FRONTEND_TEST_ROOT/index.html"
echo 'Frontend install, asset retention, rollback, failed-verification recovery, preflight and explicit-root checks passed using local fixtures.'
