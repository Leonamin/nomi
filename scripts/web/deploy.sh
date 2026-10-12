#!/usr/bin/env bash
# Nomi Web 한 줄 배포: 정확한 커밋을 클린 release worktree로 가져온 뒤 deploy-web-host.mjs 에 넘긴다.
#
#   scripts/web/deploy.sh --env /opt/nomi/deploy.env            # origin/main 최신
#   scripts/web/deploy.sh --env /opt/nomi/deploy.env <40-hex>   # 정확한 커밋
#
# 경로·포트·호스트는 전부 환경변수에서 읽는다(docs/personal-web.md). --env 로 지정한 파일을
# 먼저 source 하므로 호스트 설정 파일 하나만 있으면 된다. 데이터 루트는 절대 건드리지 않는다.
# 이전 release 산출물 정리는 `NOMI_WEB_KEEP_RELEASES`(deploy-web-host.mjs)가 맡는다.
set -euo pipefail

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
}

env_file=''
target=''
while [ $# -gt 0 ]; do
  case "$1" in
    --env) [ $# -ge 2 ] || { echo "deploy: --env 뒤에 파일이 필요합니다" >&2; exit 2; }; env_file=$2; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    --) shift; break ;;
    -*) echo "deploy: 모르는 옵션 $1" >&2; exit 2 ;;
    *) target=$1; shift ;;
  esac
done
[ $# -eq 0 ] || { echo "deploy: 인자가 너무 많습니다: $*" >&2; exit 2; }

if [ -n "$env_file" ]; then
  [ -f "$env_file" ] || { echo "deploy: 환경 파일이 없습니다: $env_file" >&2; exit 2; }
  # shellcheck disable=SC1090
  set -a; . "$env_file"; set +a
fi

release_root=${NOMI_WEB_RELEASE_DIR:?NOMI_WEB_RELEASE_DIR 이 필요합니다(--env 로 호스트 설정을 넘기세요)}
repository=$release_root/repository.git
[ -d "$repository" ] || { echo "deploy: release 저장소가 없습니다: $repository" >&2; exit 2; }

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
node_bin=${NOMI_WEB_NODE_BIN:-node}
default_branch=${NOMI_WEB_DEPLOY_BRANCH:-origin/main}

echo "deploy: $repository 에서 fetch" >&2
git -C "$repository" fetch --prune origin

ref=${target:-$default_branch}
sha=$(git -C "$repository" rev-parse --verify --quiet "${ref}^{commit}") \
  || { echo "deploy: $ref 를 커밋으로 풀 수 없습니다(먼저 fetch 하거나 40-hex 커밋을 넘기세요)" >&2; exit 2; }
case "$sha" in
  *[!0-9a-f]*|'') echo "deploy: 커밋 SHA 모양이 아닙니다: $sha" >&2; exit 2 ;;
esac
[ ${#sha} -eq 40 ] || { echo "deploy: 40자리 SHA 가 아닙니다: $sha" >&2; exit 2; }

release=$release_root/releases/$sha
if [ ! -e "$release" ]; then
  echo "deploy: 클린 release worktree 생성 $release" >&2
  git -C "$repository" worktree add --detach "$release" "$sha"
fi

echo "deploy: $sha -> $release" >&2
exec "$node_bin" "$script_dir/deploy-web-host.mjs" "$sha"
