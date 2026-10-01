#!/usr/bin/env bash
# Regenerates lib/api/generated from ../api/openapi.json (run `pnpm openapi` at the
# repository root first when the API changed). The output is committed.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf lib/api/generated
dart run swagger_parser
dart run build_runner build --delete-conflicting-outputs
dart format lib/api/generated >/dev/null
