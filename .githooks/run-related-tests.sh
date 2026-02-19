#!/usr/bin/env bash
set -euo pipefail

staged_files="$(git diff --cached --name-only --diff-filter=ACMR)"

if [ -z "${staged_files}" ]; then
  echo "No staged files. Skipping related tests."
  exit 0
fi

declare -a js_files=()
declare -a ruby_tests=()

while IFS= read -r file; do
  [ -z "${file}" ] && continue

  case "${file}" in
    *.js|*.jsx|*.ts|*.tsx)
      js_files+=("${file}")
      ;;
  esac

  case "${file}" in
    test/**/*_test.rb|test/*_test.rb|spec/**/*_spec.rb|spec/*_spec.rb)
      ruby_tests+=("${file}")
      ;;
  esac

  if [[ "${file}" == app/*.rb ]]; then
    rel="${file#app/}"
    base="${rel%.rb}"
    ruby_tests+=("test/${base}_test.rb")
  fi

  if [[ "${file}" == lib/*.rb ]]; then
    rel="${file#lib/}"
    base="${rel%.rb}"
    ruby_tests+=("test/lib/${base}_test.rb")
  fi
done <<< "${staged_files}"

if [ ${#js_files[@]} -gt 0 ]; then
  echo "Running Vitest related tests..."
  yarn vitest related --run "${js_files[@]}"
fi

if [ ${#ruby_tests[@]} -gt 0 ]; then
  declare -A uniq=()
  declare -a existing=()
  for t in "${ruby_tests[@]}"; do
    if [ -f "${t}" ] && [ -z "${uniq[$t]+x}" ]; then
      uniq["$t"]=1
      existing+=("${t}")
    fi
  done

  if [ ${#existing[@]} -gt 0 ]; then
    echo "Running related Ruby tests..."
    bundle exec rails test "${existing[@]}"
  else
    echo "No matching Ruby test files found for staged Ruby changes."
  fi
fi
