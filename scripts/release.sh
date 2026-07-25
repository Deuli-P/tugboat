#!/bin/bash
set -euo pipefail

RELEASES_REPO="Deuli-P/tugboat-releases"
KEY_PATH="$HOME/.tauri/tugboat_updater.key"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

if [ ! -f "$KEY_PATH" ]; then
  echo "❌ Signing key missing at $KEY_PATH"
  echo "   Run: pnpm tauri signer generate --password '' --ci -w $KEY_PATH"
  exit 1
fi

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

echo "🚢 Releasing $CURRENT → $VERSION"
echo ""

# Bump versions in all files
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

echo "📝 Versions bumped in package.json, tauri.conf.json, Cargo.toml"

# Build with signing (Tauri wants the KEY CONTENT, not the path)
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_PATH")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
export CARGO_TERM_PROGRESS_WHEN=never

echo ""
echo "🔨 Building release (signed)…"
pnpm tauri build

APP_TAR="src-tauri/target/release/bundle/macos/tugboat.app.tar.gz"
APP_SIG="src-tauri/target/release/bundle/macos/tugboat.app.tar.gz.sig"

if [ ! -f "$APP_TAR" ] || [ ! -f "$APP_SIG" ]; then
  echo "❌ Updater artifacts not found. Check tauri.conf.json: bundle.createUpdaterArtifacts must be true."
  exit 1
fi

SIGNATURE=$(cat "$APP_SIG")
PUB_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DOWNLOAD_URL="https://github.com/${RELEASES_REPO}/releases/download/v${VERSION}/tugboat_${VERSION}_aarch64.app.tar.gz"

VERSIONED_TAR="/tmp/tugboat_${VERSION}_aarch64.app.tar.gz"
cp "$APP_TAR" "$VERSIONED_TAR"

LATEST_JSON="/tmp/latest.json"
cat > "$LATEST_JSON" <<EOF
{
  "version": "$VERSION",
  "notes": "Tugboat v$VERSION",
  "pub_date": "$PUB_DATE",
  "platforms": {
    "darwin-aarch64": {
      "signature": "$SIGNATURE",
      "url": "$DOWNLOAD_URL"
    }
  }
}
EOF

echo "✅ latest.json generated:"
cat "$LATEST_JSON"
echo ""

# Commit version bump
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
if ! git diff --cached --quiet; then
  git commit -m "chore: bump version to $VERSION"
fi

# Tag
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "⚠️  Tag v$VERSION already exists locally, skipping tag creation."
else
  git tag "v$VERSION"
fi

# Push commit + tag to main repo
git push origin main --tags 2>&1 || true

# Ensure the releases repo has at least one commit (GitHub rejects releases on empty repos)
if ! gh api "/repos/$RELEASES_REPO/commits" --jq '.[0].sha' >/dev/null 2>&1; then
  echo "📝 Releases repo is empty — pushing initial README…"
  README_B64=$(printf "# tugboat-releases\n\nPublic release artifacts for [Tugboat](https://github.com/Deuli-P/tugboat).\n" | base64)
  gh api -X PUT "/repos/$RELEASES_REPO/contents/README.md" \
    -f message="Initial commit" \
    -f content="$README_B64" >/dev/null
fi

# Create GitHub release on the releases repo
echo "📤 Uploading release to $RELEASES_REPO…"
if gh release view "v$VERSION" --repo "$RELEASES_REPO" >/dev/null 2>&1; then
  echo "   Release v$VERSION already exists on $RELEASES_REPO — uploading assets only."
  gh release upload "v$VERSION" \
    --repo "$RELEASES_REPO" \
    --clobber \
    "$VERSIONED_TAR" \
    "$LATEST_JSON"
else
  gh release create "v$VERSION" \
    --repo "$RELEASES_REPO" \
    --title "v$VERSION" \
    --notes "Tugboat v$VERSION" \
    "$VERSIONED_TAR" \
    "$LATEST_JSON"
fi

# Cleanup
rm -f "$VERSIONED_TAR" "$LATEST_JSON"

echo ""
echo "🎉 v$VERSION released!"
echo "   Users on older versions will see the update when they click 'Vérifier les MAJ'."
