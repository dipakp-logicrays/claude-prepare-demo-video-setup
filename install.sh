#!/usr/bin/env bash
# install.sh — install the demo-video skill into Claude Code.
#
# Copies skills/demo-video/ into ~/.claude/skills/, checks dependencies, then runs the
# skill's setup.sh (playwright-core + Piper voice) unless --no-setup is given.
# Safe to re-run: an existing install is backed up before being replaced.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/skills/demo-video"
DEST_ROOT="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
DEST="$DEST_ROOT/demo-video"
FILES=(SKILL.md render.js kit.js setup.sh example.scenes.js)
RUN_SETUP=1
for a in "$@"; do [ "$a" = "--no-setup" ] && RUN_SETUP=0; done

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; }

[ -d "$SRC" ] || { bad "Cannot find $SRC — run this script from inside the cloned repo."; exit 1; }

bold "Checking dependencies"
MISSING=0

CHROME=""
for c in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
done
[ -z "$CHROME" ] && [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ] && CHROME="Google Chrome.app"
[ -z "$CHROME" ] && [ -n "${CHROME_PATH:-}" ] && CHROME="$CHROME_PATH"
if [ -n "$CHROME" ]; then ok "Chrome/Chromium found ($CHROME)"; else
  bad "No Chrome/Chromium found — used to record every scene."
  echo "     Debian/Ubuntu : sudo apt install chromium-browser"
  echo "     Fedora        : sudo dnf install chromium"
  echo "     macOS         : brew install --cask google-chrome"
  MISSING=1
fi

if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then ok "ffmpeg found"; else
  bad "ffmpeg missing — used to encode, narrate and stitch the video."
  echo "     Debian/Ubuntu : sudo apt install ffmpeg"
  echo "     Fedora        : sudo dnf install ffmpeg"
  echo "     macOS         : brew install ffmpeg"
  MISSING=1
fi

if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]; then ok "Node.js $(node -v) found"; else
  bad "Node.js 20+ missing — the renderer is a Node script."
  echo "     https://nodejs.org or: brew install node / sudo apt install nodejs"
  MISSING=1
fi

if command -v python3 >/dev/null 2>&1 && python3 -m venv --help >/dev/null 2>&1; then ok "python3 + venv found (narration enabled)"; else
  warn "python3 with venv missing — silent videos still work, but --audio narration needs it."
  echo "     Debian/Ubuntu : sudo apt install python3 python3-venv"
  echo "     macOS         : brew install python"
  RUN_SETUP_TTS=0
fi

echo
bold "Installing skill"

if [ -d "$DEST" ]; then
  BACKUP="$DEST.backup-$(date +%Y%m%d-%H%M%S)"
  mv "$DEST" "$BACKUP"
  warn "Existing install moved to $BACKUP"
fi

mkdir -p "$DEST"
for f in "${FILES[@]}"; do cp "$SRC/$f" "$DEST/"; done
chmod +x "$DEST/render.js" "$DEST/setup.sh"
ok "Installed to $DEST"

if [ "$MISSING" = "1" ]; then
  echo
  bad "Install the missing dependencies above, then run: bash $DEST/setup.sh"
  exit 1
fi

if [ "$RUN_SETUP" = "1" ]; then
  echo
  bold "Installing runtime (playwright-core, Piper TTS, default voice ~120 MB)"
  if [ "${RUN_SETUP_TTS:-1}" = "0" ]; then
    warn "Skipping — python3 venv missing. Run later: bash $DEST/setup.sh"
  else
    bash "$DEST/setup.sh" | sed 's/^/  /'
  fi
else
  echo
  warn "Skipped runtime setup (--no-setup). Run later: bash $DEST/setup.sh"
fi

echo
bold "Done"
echo "  Restart Claude Code (or run /doctor) so it picks up the new skill."
echo "  Then just ask: \"make a demo video of <your product> with audio\""
echo
echo "  Videos are saved to: ${CLAUDE_VIDEO_DIR:-$HOME/Documents/claude-videos}/<path>/"
echo "  Change that by exporting CLAUDE_VIDEO_DIR in your shell profile."
