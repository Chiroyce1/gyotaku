# Desktop integration

The files every Linux install puts in place, whatever installs them:

- `dev.xevrion.gyotaku.desktop`: the menu entry. It runs `gyotaku-app`;
  `install.sh` rewrites `Exec` to the full path, since `~/.local/bin` isn't
  on the PATH of every desktop's launcher.
- `dev.xevrion.gyotaku.metainfo.xml`: AppStream metadata, which software
  centers (GNOME Software, Discover) and Flathub read.
- `icons/hicolor/`: the mark from `assets/icon.svg`, as an SVG and as PNGs
  from 16 to 512 pixels.

The release tarball carries all three under `share/`, laid out like
`/usr/share`.

## Changing the icon

Edit `assets/icon.svg`, then regenerate the PNGs and copy the SVG over the
scalable one:

    for s in 16 24 32 48 64 128 256 512; do
        rsvg-convert -w $s -h $s assets/icon.svg \
            -o packaging/linux/icons/hicolor/${s}x${s}/apps/dev.xevrion.gyotaku.png
    done

## Checking

    desktop-file-validate packaging/linux/dev.xevrion.gyotaku.desktop
    appstreamcli validate --no-net packaging/linux/dev.xevrion.gyotaku.metainfo.xml

Add a `<release>` line to the metainfo with each version.
