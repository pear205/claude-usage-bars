#!/usr/bin/env bash
# 사용법: scripts/release.sh "커밋 메시지" [patch|minor|major]
# version 올리기 → validate → commit → push → 설치된 플러그인 update
set -euo pipefail
cd "$(dirname "$0")/.."

msg="${1:?커밋 메시지를 넣어주세요}"
part="${2:-patch}"
manifest=.claude-plugin/plugin.json

old=$(sed -n 's/.*"version": *"\([0-9.]*\)".*/\1/p' "$manifest")
IFS=. read -r major minor patch <<<"$old"
case "$part" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  *)     patch=$((patch + 1)) ;;
esac
new="$major.$minor.$patch"
sed -i "s/\"version\": *\"$old\"/\"version\": \"$new\"/" "$manifest"
echo "version: $old -> $new"

claude plugin validate .
git add -A
git commit -q -m "$msg (v$new)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
claude plugin marketplace update usage-bars
claude plugin update usage-bars@usage-bars
echo "v$new 배포 완료. Claude 앱을 재시작하면 반영돼요."
