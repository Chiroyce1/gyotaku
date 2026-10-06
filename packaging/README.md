# Packaging

Every way gyotaku is packaged for Linux, one folder each, so each format can
be built, tested and published on its own. All of them start from the same
prebuilt binaries the release workflow makes (built on Ubuntu 22.04, so they
need glibc 2.35 or newer), and none of them builds from source yet.

| Folder | What | State |
|---|---|---|
| [linux](linux) | Menu entry, icons and AppStream metadata, shared by every format below and by `install.sh` | Done |
| [nfpm](nfpm) | `.deb` and `.rpm`, attached to every release | Built and tested in `release.yml` |
| [aur](aur) | `gyotaku-bin` on the AUR | PKGBUILD ready, not published |
| [flatpak](flatpak) | Flathub | Draft manifest, needs app changes first |

The app ID everywhere is `dev.xevrion.gyotaku`. The window's Wayland app ID
stays `gyotaku`, and the menu entry's `StartupWMClass=gyotaku` ties the two
together.

The background reader isn't part of any package. The app sets it up for
each user the first time they open it (a systemd user service, or an XDG
autostart entry without systemd), pointing at whichever `gyotaku` sits next
to the `gyotaku-app` that was opened, so a packaged install and a
`~/.local/bin` one each run their own.

## Releasing

`release.yml` builds the tarballs, `.deb` and `.rpm` for x86_64 and
aarch64, then installs each package in a clean container (Ubuntu 22.04,
Debian 12, Ubuntu 24.04 on arm, Fedora on both, and the AUR package built
with makepkg on Arch), runs the window's library check and reads a real
screenshot before anything is published. Run it by hand on a branch without
a tag for a dry run that publishes nothing:

    gh workflow run release.yml --ref <branch>

## Still to do

### Fedora COPR

A COPR project `xevrion/gyotaku` serving the same `.rpm` gives Fedora users
`dnf copr enable xevrion/gyotaku` and updates through `dnf upgrade`. COPR
builds from a source RPM, so the plan is a `gyotaku.spec` that repackages
the release tarball (like the AUR package) rather than building with cargo
offline, which would need every crate vendored. A webhook or a step in
`release.yml` (`copr-cli build`, with an API token as a secret) starts a
build on each release.

### openSUSE OBS

The Open Build Service can build the same spec for openSUSE Tumbleweed and
Leap, and also host the `.deb` repository for Debian and Ubuntu, which
saves running an apt repository by hand. Package names differ on openSUSE
(`libxkbcommon0`, `libxcb1`, `libvulkan1`), so the spec needs
`%if 0%{?suse_version}` blocks for its dependencies. Trigger it from
`release.yml` with `osc` and an OBS token.

### An apt repository

Until OBS hosts one, Debian and Ubuntu users download the `.deb` from the
release page and get no updates through apt. Running the one-line installer
again updates either kind of install.
