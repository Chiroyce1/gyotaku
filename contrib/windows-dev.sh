#!/bin/sh
# Builds the Windows version on Linux and publishes it as the rolling `dev`
# pre-release, for trying a change on a Windows machine without waiting for
# CI. On that machine, in PowerShell:
#
#   $env:GYOTAKU_CHANNEL = 'dev'; irm https://raw.githubusercontent.com/xevrion/gyotaku/main/install.ps1 | iex
#
# Needs: rustup target add x86_64-pc-windows-msvc, cargo install cargo-xwin,
# clang and lld (for clang-cl and lld-link), and gh, signed in. The first run
# downloads Microsoft's build libraries (~1 GB, cached by cargo-xwin).
#
#   contrib/windows-dev.sh            build, package, publish
#   contrib/windows-dev.sh --no-push  build and package only (dist/windows-dev)
#
# These builds compile gpui's shaders when the app starts (see the wintest
# profile in Cargo.toml), from shader sources shipped in the zip that the dev
# installer puts in place. Releases are still built by CI, on Windows, with
# the shaders compiled ahead of time.

set -eu

repo_dir=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo_dir"
target=x86_64-pc-windows-msvc
out="target/$target/wintest"
dist=dist/windows-dev
cache="${XDG_CACHE_HOME:-$HOME/.cache}/gyotaku-windows-dev"
name=gyotaku-x86_64-windows

# llvm-rc looks for files a resource script names relative to where the
# script is, and the one gpui embeds gets preprocessed into another folder
# first, so it can't find its own manifest. Microsoft's rc.exe looks in the
# folder it was started from instead. This points llvm-rc at the crate too.
tools="target/windows-dev-tools"
mkdir -p "$tools"
cat >"$tools/llvm-rc" <<'EOF'
#!/bin/sh
exec /usr/bin/llvm-rc /I "${CARGO_MANIFEST_DIR:-.}" "$@"
EOF
chmod +x "$tools/llvm-rc"
PATH="$repo_dir/$tools:$PATH"
export PATH

echo "building"
cargo xwin build --profile wintest --target "$target" -p gyotaku -p gyotaku-app

# onnxruntime.dll and the Visual C++ runtime DLLs it needs come from the
# latest release's zip, fetched once.
if [ ! -f "$cache/onnxruntime.dll" ]; then
    echo "fetching onnxruntime.dll and the Visual C++ runtime from the latest release"
    mkdir -p "$cache"
    gh release download --repo xevrion/gyotaku --pattern "$name.zip" --dir "$cache" --clobber
    unzip -oq "$cache/$name.zip" 'onnxruntime.dll' 'msvcp140*.dll' 'vcruntime140*.dll' -d "$cache"
    rm "$cache/$name.zip"
fi

echo "packaging"
rm -rf "$dist" && mkdir -p "$dist/gyotaku/shaders"
cp "$out/gyotaku.exe" "$out/gyotaku-app.exe" "$dist/gyotaku/"
cp "$cache"/*.dll "$dist/gyotaku/"
cp LICENSE "$dist/gyotaku/LICENSE.txt"
cp contrib/windows-readme.txt "$dist/gyotaku/README.txt"
# Where this build will look for the shader sources: gpui's folder on this
# machine, which Windows reads as the same path on the system drive.
gpui_windows=$(cargo metadata --format-version 1 --filter-platform "$target" |
    python3 -c 'import json,sys; print(next(p["manifest_path"] for p in json.load(sys.stdin)["packages"] if p["name"]=="gpui_windows"))' |
    xargs dirname)
cp "$gpui_windows"/src/*.hlsl "$dist/gyotaku/shaders/"
printf '%s\n' "$gpui_windows/src" >"$dist/gyotaku/shaders/where.txt"
(cd "$dist/gyotaku" && rm -f "../$name.zip" && zip -qr "../$name.zip" .)
(cd "$dist" && sha256sum "$name.zip" >"$name.zip.sha256")
ls -l "$dist"

if [ "${1:-}" = "--no-push" ]; then
    exit 0
fi
echo "publishing to the dev pre-release"
if ! gh release view dev --repo xevrion/gyotaku >/dev/null 2>&1; then
    gh release create dev --repo xevrion/gyotaku --prerelease --latest=false \
        --title "dev build" --notes "Rolling test build."
fi
gh release upload dev "$dist/$name.zip" "$dist/$name.zip.sha256" --clobber --repo xevrion/gyotaku
gh release edit dev --repo xevrion/gyotaku --prerelease --latest=false --notes \
    "Rolling Windows test build of $(git rev-parse --short HEAD)$(git diff --quiet || echo ' plus local changes'), built on Linux. Not for everyday use: install a [release](https://github.com/xevrion/gyotaku/releases/latest) instead."
echo "done. on the Windows machine:"
echo "  \$env:GYOTAKU_CHANNEL = 'dev'; irm https://raw.githubusercontent.com/xevrion/gyotaku/main/install.ps1 | iex"
