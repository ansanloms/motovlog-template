#!/usr/bin/env bash
# Upgrade Remotion, align the pinned remotion-dev/skills commit, and re-run apm install.
#
# Usage: scripts/remotion-upgrade.sh [version]
#   version - optional Remotion version to upgrade to (defaults to latest)

set -euo pipefail

cd "$(dirname "$0")/.."

for cmd in apm gh npx; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required command not found: $cmd" >&2
    exit 1
  fi
done

version="${1:-}"

upgrade_args=(remotion upgrade --skip-skills)
if [ -n "$version" ]; then
  upgrade_args+=(--version "$version")
fi
npx "${upgrade_args[@]}"

target="$(node -p "const p=require('./package.json'); p.devDependencies?.remotion ?? p.dependencies?.remotion ?? ''")"
if [ -z "$target" ]; then
  echo "error: remotion is not listed in package.json" >&2
  exit 1
fi
echo "target Remotion version: $target"

list_mismatches() {
  # shellcheck disable=SC2016 # single quotes are intentional: this is JavaScript, not shell expansion
  TARGET="$target" node -e '
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const target = process.env.TARGET;
    const sections = ["dependencies", "devDependencies", "peerDependencies"];
    const mismatches = [];
    for (const section of sections) {
      const deps = pkg[section] || {};
      for (const [name, ver] of Object.entries(deps)) {
        if ((name === "remotion" || name.startsWith("@remotion/")) && ver !== target) {
          mismatches.push(`${section}.${name}`);
        }
      }
    }
    console.log(mismatches.join("\n"));
  '
}

mismatches="$(list_mismatches)"
if [ -n "$mismatches" ]; then
  echo "aligning Remotion-related versions to $target:"
  while IFS= read -r entry; do
    [ -n "$entry" ] || continue
    echo "  $entry -> $target"
    npm pkg set "$entry=$target"
  done <<<"$mismatches"
  npm install --no-fund --no-audit

  mismatches="$(list_mismatches)"
  if [ -n "$mismatches" ]; then
    echo "error: version mismatch remains after alignment:" >&2
    echo "$mismatches" >&2
    exit 1
  fi
fi

found_sha=""
checked=0
while IFS= read -r sha; do
  [ -n "$sha" ] || continue
  checked=$((checked + 1))
  content="$(gh api "repos/remotion-dev/skills/contents/skills/remotion-docs/SKILL.md?ref=${sha}" --jq .content | base64 -d)"
  sha_version="$(printf '%s\n' "$content" | sed -n -E 's/^version:[[:space:]]*"?([^"[:space:]]+)"?[[:space:]]*$/\1/p' | head -n1)"
  if [ "$sha_version" = "$target" ]; then
    found_sha="$sha"
    break
  fi
done < <(gh api "repos/remotion-dev/skills/commits?path=skills/remotion-docs/SKILL.md&per_page=30" --jq '.[].sha')

echo "checked $checked commit(s) in remotion-dev/skills"

if [ -z "$found_sha" ]; then
  echo "error: no commit in remotion-dev/skills matches Remotion $target" >&2
  exit 1
fi
echo "matched remotion-dev/skills commit: $found_sha"

if grep -q "remotion-dev/skills#${found_sha}" apm.yml; then
  echo "apm.yml already pins remotion-dev/skills#${found_sha}"
else
  sed -i -E "s|remotion-dev/skills#[0-9a-f]{40}|remotion-dev/skills#${found_sha}|" apm.yml
  grep -q "remotion-dev/skills#${found_sha}" apm.yml || { echo "error: failed to update remotion-dev/skills pin in apm.yml" >&2; exit 1; }
fi

apm install

installed_version="$(sed -n -E 's/^version:[[:space:]]*"?([^"[:space:]]+)"?[[:space:]]*$/\1/p' .claude/skills/remotion-docs/SKILL.md | head -n1)"
if [ "$installed_version" != "$target" ]; then
  echo "error: installed remotion-docs skill version ($installed_version) does not match target ($target)" >&2
  exit 1
fi

npx remotion versions

npm run lint
npm test
npm run build

echo "Remotion ${target}, skills ${found_sha}"
