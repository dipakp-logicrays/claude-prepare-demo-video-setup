#!/usr/bin/env bash
# One-time setup for the demo-video skill. Idempotent — safe to re-run.
#   bash setup.sh            → playwright-core + Piper + the default "ryan" voice
#   bash setup.sh amy lessac → also fetch extra voices (en_US, high/medium quality)
set -euo pipefail
DATA="${CLAUDE_DEMO_VIDEO_DATA:-$HOME/.local/share/claude-demo-video}"
mkdir -p "$DATA/tts/voices"

command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null || { echo "✘ ffmpeg + ffprobe are required (apt install ffmpeg / brew install ffmpeg)"; exit 1; }
command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || { echo "✘ Node.js 20+ is required"; exit 1; }
command -v python3 >/dev/null || { echo "✘ python3 is required (for the Piper voice)"; exit 1; }
chrome_ok=""
for c in google-chrome google-chrome-stable chromium chromium-browser; do command -v "$c" >/dev/null && chrome_ok=1; done
[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ] && chrome_ok=1
[ -n "${CHROME_PATH:-}" ] && chrome_ok=1
[ -n "$chrome_ok" ] || { echo "✘ Chrome/Chromium not found (or set CHROME_PATH)"; exit 1; }

if [ ! -d "$DATA/node_modules/playwright-core" ]; then
  echo "• installing playwright-core"
  (cd "$DATA" && [ -f package.json ] || echo '{"private":true}' > package.json; npm install --silent --no-audit --no-fund playwright-core >/dev/null)
fi
echo "✔ playwright-core $(node -p "require('$DATA/node_modules/playwright-core/package.json').version")"

if [ ! -x "$DATA/tts/venv/bin/piper" ]; then
  echo "• installing Piper TTS"
  python3 -m venv "$DATA/tts/venv"
  "$DATA/tts/venv/bin/pip" install -q --disable-pip-version-check piper-tts
fi
echo "✔ piper"

# voice name → huggingface path (quality chosen per voice)
declare -A VOICES=(
  [ryan]="en/en_US/ryan/high/en_US-ryan-high"
  [amy]="en/en_US/amy/medium/en_US-amy-medium"
  [lessac]="en/en_US/lessac/high/en_US-lessac-high"
  [libritts]="en/en_US/libritts/high/en_US-libritts-high"
  [alan]="en/en_GB/alan/medium/en_GB-alan-medium"
  [jenny]="en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium"
)
want=("ryan" "$@")
for v in "${want[@]}"; do
  [ -n "${VOICES[$v]:-}" ] || { echo "✘ unknown voice '$v' (known: ${!VOICES[*]})"; exit 1; }
  if [ ! -f "$DATA/tts/voices/$v.onnx" ]; then
    echo "• downloading voice: $v"
    base="https://huggingface.co/rhasspy/piper-voices/resolve/main/${VOICES[$v]}"
    curl -sSLf -o "$DATA/tts/voices/$v.onnx" "$base.onnx?download=true"
    curl -sSLf -o "$DATA/tts/voices/$v.onnx.json" "$base.onnx.json?download=true"
  fi
  echo "✔ voice $v"
done
echo "Ready. Library: ${CLAUDE_VIDEO_DIR:-$HOME/Documents/claude-videos}"
