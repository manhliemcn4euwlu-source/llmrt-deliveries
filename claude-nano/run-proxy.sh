#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export NANO_SEED="$(cat testseed.hex)"
export PROXY_KEY="ccproxy-test-key-0123456789"
export UPSTREAM="https://nano-gpt.com/api/x402"
export NANO_CAP="0.06"
export NANO_MAX_PER_CALL="0.05"
export STATE_FILE="$PWD/state.json"
export PORT="3402"
exec node inference-proxy.js
