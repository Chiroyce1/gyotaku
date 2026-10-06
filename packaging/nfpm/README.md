# .deb and .rpm

Built by [nfpm](https://nfpm.goreleaser.com) from the binaries in
`target/release`, in the `linux` job of `release.yml`, and published with
every release under names that don't change between versions:

    gyotaku-x86_64-linux.deb    gyotaku-x86_64-linux.rpm
    gyotaku-aarch64-linux.deb   gyotaku-aarch64-linux.rpm

so `https://github.com/xevrion/gyotaku/releases/latest/download/gyotaku-x86_64-linux.deb`
always points at the newest.

They install the two programs in `/usr/bin`, plus the menu entry, icons and
AppStream metadata from [`../linux`](../linux). The window's hard
dependencies are libxcb and libxkbcommon(-x11); Vulkan, EGL and Wayland are
loaded at runtime and only recommended, so `gyotaku watch` still installs on
a server. `postinstall.sh` refreshes the menu and icon caches and never
starts or kills anything: the background reader belongs to each user.

## Building one locally

    cargo build --release --locked
    GYOTAKU_VERSION=0.1.2 GYOTAKU_ARCH=amd64 \
        nfpm package -f packaging/nfpm/nfpm.yaml -p rpm -t dist/

`GYOTAKU_ARCH` is `amd64` or `arm64`.
