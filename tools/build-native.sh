#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../services/engine"
: "${VCPKG_ROOT:?Set VCPKG_ROOT to the installed VCPKG directory}"
: "${EMSDK:?Set EMSDK to the installed Emscripten SDK directory}"
: "${FMOD_WEB_ROOT:?Set FMOD_WEB_ROOT; lib/w32/fmodP_wasm.a must exist below it}"
: "${FMOD_LINUX_ROOT:?Set FMOD_LINUX_ROOT to the Linux FMOD SDK}"
for executable in cmake ninja cargo; do command -v "$executable" >/dev/null || { echo "Missing $executable" >&2; exit 1; }; done
if [[ ! -f "$FMOD_WEB_ROOT/lib/w32/fmodP_wasm.a" ]]; then echo "Missing FMOD Emscripten library" >&2;exit 1;fi
export FMOD_HTML5_ROOT="$FMOD_WEB_ROOT"
cmake --preset emscripten-release -DFMOD_ROOT="$FMOD_WEB_ROOT"
cmake --build build/emscripten-release --target UniversalClient --parallel
cmake --preset linux-rcc-release -DCMAKE_C_COMPILER_LAUNCHER= -DCMAKE_CXX_COMPILER_LAUNCHER=
cmake --build build/linux-rcc-release --target RCCService --parallel
cd ../arbiter
cargo build --release
printf '%s\n' 'Native targets built. Install the generated client output directory with tools/install-webclient.py.'
