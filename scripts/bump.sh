#!/bin/bash
# Bump version in package.json + tauri.conf.json + Cargo.toml, commit and push.
# CI (.github/workflows/release.yml) will detect the bump and build+publish the release.
#
# Usage: bash scripts/bump.sh [patch|minor|major|X.Y.Z]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUMP="${1:-patch}"
CURRENT=$(node -p "require('./package.json').version")

if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  VERSION="$BUMP"
else
  VERSION=$(node -e "
    const v = '$CURRENT'.split('.').map(Number);
    const bump = process.argv[1];
    if (bump === 'major') { v[0]++; v[1]=0; v[2]=0; }
    else if (bump === 'minor') { v[1]++; v[2]=0; }
    else { v[2]++; }
    console.log(v.join('.'));
  " "$BUMP")
fi

echo "🚢 Bumping $CURRENT → $VERSION"

node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  p.version = '$VERSION';
  fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  p.version = '$VERSION';
  fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(p, null, 2) + '\n');
"
/usr/bin/sed -i '' "s/^version = \".*\"$/version = \"$VERSION\"/" src-tauri/Cargo.toml

# Cargo.lock also embeds the version of the local crate — refresh it so the workflow's version check is happy.
if command -v cargo >/dev/null 2>&1; then
  ( cd src-tauri && cargo update -p tugboat --precise "$VERSION" >/dev/null 2>&1 || true )
fi

git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock 2>/dev/null || true

if git diff --cached --quiet; then
  echo "⚠️  No changes staged. Version files may already be at $VERSION."
  exit 1
fi

git commit -m "chore: bump version to $VERSION"

echo ""
echo "✅ Committed. Push to trigger release:"
echo "   git push origin main"
