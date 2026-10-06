# AUR: gyotaku-bin

The release tarball repackaged for Arch, with the menu entry and icons. The
first version that can be published is the first release whose tarball has
`share/` in it (the release after 0.1.2). `release.yml` builds and installs
this PKGBUILD with makepkg on Arch before every release, using the tarball it
just built.

## Publishing, the first time

It needs an AUR account with an SSH key.

    git clone ssh://aur@aur.archlinux.org/gyotaku-bin.git aur-gyotaku-bin
    packaging/aur/update.sh 0.1.3
    cp packaging/aur/PKGBUILD packaging/aur/.SRCINFO aur-gyotaku-bin/
    cd aur-gyotaku-bin && git add PKGBUILD .SRCINFO && git commit -m "0.1.3" && git push

## Each release after

    packaging/aur/update.sh <version>

then copy, commit and push the two files as above. `update.sh` takes the
checksums from the `.sha256` files on the release and needs `makepkg` for
`.SRCINFO`, so run it on Arch or in an `archlinux` container.

Later, `release.yml` can do this itself with the AUR SSH key as a secret.
