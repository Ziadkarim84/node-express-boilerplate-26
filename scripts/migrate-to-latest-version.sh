#!/usr/bin/env bash

set -euo pipefail

_flags=""

while [ $# -ge 1 ]; do
  case "$1" in
    -z|--outOfOrder)
      _flags="${_flags} ${1}"
      shift 1
      ;;
    *)
      shift 1
      ;;
  esac
done

PATH=./node_modules/.bin:${PATH}

_config="--config=.synorrc.cjs"

current_version=$(npx synor current ${_config} --no-header --columns=version | tail -1 | sed -e 's/^[ \t]*//')
target_version=$(npx synor info ${_config} --no-header --columns=version --filter=state=pending | tail -1 | sed -e 's/^[ \t]*//')

if test "$target_version" = ''; then
  target_version="$current_version"
fi

NODE_ENV="${NODE_ENV:-""}"

if test "$NODE_ENV" = '' || test "$NODE_ENV" = 'development' || test "$NODE_ENV" = 'test'; then
  echo $ npx synor migrate ${_config} --from=${current_version} --to=${target_version} ${_flags}
  echo
  npx synor migrate ${_config} --from=${current_version} --to=${target_version} ${_flags}
else
  echo $ npx synor migrate ${_config} ${target_version} ${_flags}
  echo
  npx synor migrate ${_config} ${target_version} ${_flags}
fi
