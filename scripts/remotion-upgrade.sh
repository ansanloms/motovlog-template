#!/usr/bin/env bash
# Upgrade Remotion, align the pinned remotion-dev/skills commit, and re-run apm install.
#
# Usage: scripts/remotion-upgrade.sh [version]
#   version - optional Remotion version to upgrade to (defaults to latest)
#
# Remotion is pinned with exact npm: specifiers in the root deno.json (imports and
# the remotion task) and in the workspace member deno.json files (ADR-0016,
# ADR-0017). All of them must carry the same version, so this script rewrites
# every pin, then runs deno install to refresh node_modules and deno.lock.

set -euo pipefail

cd "$(dirname "$0")/.."

for cmd in apm gh deno curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required command not found: $cmd" >&2
    exit 1
  fi
done

target="${1:-}"
if [ -z "$target" ]; then
  target="$(curl -fsSL https://registry.npmjs.org/remotion/latest | jq -r .version)"
fi
if ! printf '%s\n' "$target" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'; then
  echo "error: invalid Remotion version: $target" >&2
  exit 1
fi
echo "target Remotion version: $target"

manifests=(deno.json modules/*/deno.json)
pin_pattern='npm:/?(@remotion/[^@/" ]+|remotion)@[^/" ]+'

# Prints "<file>:<pin>" for every Remotion pin whose version is not $target.
list_mismatches() {
  grep -HoE "$pin_pattern" "${manifests[@]}" |
    awk -v target="$target" '{ n = split($0, parts, "@"); if (parts[n] != target) print }'
}

mismatches="$(list_mismatches)"
if [ -n "$mismatches" ]; then
  echo "aligning Remotion pins to $target:"
  printf '%s\n' "$mismatches" | sed 's/^/  /'
  sed -i -E "s#npm:(/?)(@remotion/[^@/\" ]+|remotion)@[^/\" ]+#npm:\\1\\2@${target}#g" "${manifests[@]}"

  mismatches="$(list_mismatches)"
  if [ -n "$mismatches" ]; then
    echo "error: version mismatch remains after alignment:" >&2
    echo "$mismatches" >&2
    exit 1
  fi
fi

deno install

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

deno task remotion versions

deno task lint
deno task check
deno task fmt:check
deno task test
deno task bundle

echo "Remotion ${target}, skills ${found_sha}"
