#!/usr/bin/env bash
# Local Marp renderer. Installs tooling into /tmp, without changing project deps.
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
build_dir="$(mktemp -d /tmp/radar-marp-XXXXXX)"
trap 'rm -rf "$build_dir"' EXIT
export TMPDIR=/tmp
export npm_config_cache=/tmp/opportunity-radar-npm
export XDG_CONFIG_HOME="$build_dir/config"
export XDG_CACHE_HOME="$build_dir/cache"
cat > "$build_dir/chrome" <<'WRAPPER'
#!/bin/sh
exec /usr/bin/google-chrome --no-sandbox --disable-dev-shm-usage "$@"
WRAPPER
chmod +x "$build_dir/chrome"
export CHROME_PATH="$build_dir/chrome"
cd "$repo_dir"
npm exec --yes --package=@marp-team/marp-cli@4.5.1 -- marp SUBMISSION-SLIDES.md -o SUBMISSION-SLIDES.html
npm exec --yes --package=@marp-team/marp-cli@4.5.1 -- marp SUBMISSION-SLIDES.md --pdf -o SUBMISSION-SLIDES.pdf
