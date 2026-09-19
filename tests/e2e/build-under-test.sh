#!/usr/bin/env bash
# Builds the exact artifacts the E2E suite launches, from this checkout,
# every time. Never reuses a possibly-stale `primo` binary or
# internal/build output left over from a previous run or a different
# branch — deletes them first so a broken build fails loudly here instead
# of the suite silently exercising old code.
#
# The CLI under test is NOT built from a sibling checkout: it's the
# "primo-cli" devDependency pinned to an exact version in package.json
# (installed by `npm install`, resolved by helpers/paths.ts's CLI_ENTRY),
# so `primo-cli`'s own source/build state elsewhere on disk is irrelevant.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

echo "==> Removing any existing build output"
rm -f primo
rm -rf internal/build internal/common/index.cjs

echo "==> Building frontend (internal/build)"
NODE_OPTIONS=--max_old_space_size=16384 npm run build

echo "==> Building internal/common bundle (internal/common/index.cjs)"
npx vite --config common.config.js build

echo "==> Building primo binary"
go build -o primo .

echo "==> Verifying pinned primo-cli devDependency is installed"
if [ ! -f node_modules/primo-cli/dist/index.js ]; then
	echo "node_modules/primo-cli/dist/index.js not found — run 'npm install' first (primo-cli is a pinned devDependency in package.json)." >&2
	exit 1
fi
node node_modules/primo-cli/dist/index.js --version

echo "==> Build complete"
