#!/bin/sh
# Claude Code over the Nano-paid Anthropic shim: no account, no API key, every model call paid
# on chain from the proxy wallet inside the cap set in run-proxy.sh.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
unset ALL_PROXY all_proxy
export HTTPS_PROXY=http://100.112.240.254:7890
export HTTP_PROXY=$HTTPS_PROXY
export https_proxy=$HTTPS_PROXY
export http_proxy=$HTTP_PROXY
export NO_PROXY=127.0.0.1,localhost
export no_proxy=127.0.0.1,localhost
export ANTHROPIC_BASE_URL=http://127.0.0.1:3403
export ANTHROPIC_AUTH_TOKEN=any
export ANTHROPIC_MODEL=openai/gpt-5-nano
export ANTHROPIC_DEFAULT_SONNET_MODEL=openai/gpt-5-nano
export ANTHROPIC_DEFAULT_OPUS_MODEL=openai/gpt-5-nano
export ANTHROPIC_DEFAULT_HAIKU_MODEL=openai/gpt-5-nano
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
mkdir -p "$HERE/cc_home"
export CLAUDE_CONFIG_DIR="$HERE/cc_home"
cd /home/ai/桌面/loop1/tmp/cc
exec ./native/claude "$@"
