#!/bin/sh
# Points the PKGBUILD at a published release and regenerates .SRCINFO.
#
#   packaging/aur/update.sh 0.1.3
#
# The checksums come from the .sha256 files published beside each tarball.
# Needs makepkg, so run it on Arch (or in an archlinux container).

set -eu

version=${1:?usage: update.sh <version, like 0.1.3>}
here=$(cd "$(dirname "$0")" && pwd)
base="https://github.com/xevrion/gyotaku/releases/download/v$version"

sum() {
    curl -fsSL "$base/gyotaku-$1-linux.tar.gz.sha256" | cut -d' ' -f1
}

x86_64=$(sum x86_64)
aarch64=$(sum aarch64)

sed -i \
    -e "s/^pkgver=.*/pkgver=$version/" \
    -e "s/^pkgrel=.*/pkgrel=1/" \
    -e "s/^sha256sums_x86_64=.*/sha256sums_x86_64=('$x86_64')/" \
    -e "s/^sha256sums_aarch64=.*/sha256sums_aarch64=('$aarch64')/" \
    "$here/PKGBUILD"

(cd "$here" && makepkg --printsrcinfo >.SRCINFO)
echo "PKGBUILD and .SRCINFO now at $version"
