# Flatpak

`dev.xevrion.gyotaku.yml` is a draft. It hasn't been built (there's no
flatpak-builder here yet) and can't be submitted to Flathub until the
sandbox problems below are solved in the app.

It packages the prebuilt release tarball for x86_64 and aarch64, plus
`wl-clipboard`, which the app runs to copy images and the runtime lacks.
The `x-checker-data` blocks let Flathub's bot open a pull request for each
new release. The `sha256` lines are filled in from the release's `.sha256`
files.

## Building it

    flatpak install flathub org.freedesktop.Platform//25.08 org.freedesktop.Sdk//25.08
    flatpak-builder --user --install --force-clean build packaging/flatpak/dev.xevrion.gyotaku.yml
    flatpak run dev.xevrion.gyotaku

## What the sandbox breaks

- **Folders outside Pictures.** The manifest only grants `xdg-pictures`.
  Screenshots saved anywhere else need
  `flatpak override --user --filesystem=/that/folder dev.xevrion.gyotaku`.
  A folder picked through the file chooser portal arrives as a
  `/run/user/…/doc/` path, where inotify doesn't see new files, so the
  picker alone isn't enough. Flathub reviewers will ask about any broader
  `--filesystem`.
- **The background reader.** The app writes a systemd user unit or an
  autostart entry, but inside the sandbox `~/.config` is the app's own
  folder, so the host never sees either. The reader needs to ask the
  Background portal (`org.freedesktop.portal.Background`, with autostart)
  to run `gyotaku watch` instead.
- **The trash.** The trash code writes to `$XDG_DATA_HOME/Trash`, which in
  the sandbox is the app's private folder, not the real trash. Inside
  Flatpak it should go through the Trash portal
  (`org.freedesktop.portal.Trash`), which has no undo, so restoring needs
  more thought.
- **The shortcut.** On Linux the desktop's own shortcut opens gyotaku,
  and that keeps working: bind the key to `flatpak run dev.xevrion.gyotaku`.
  The GlobalShortcuts portal would let the app register the key itself, but
  only GNOME 48+, KDE and Hyprland implement it.
- **ONNX Runtime and the models** download on first run like everywhere
  else, which is why the manifest asks for the network. Flathub prefers
  everything in the build, so a later version should bundle them as
  sources.

## The app ID

`dev.xevrion.gyotaku` needs the xevrion.dev domain verified on Flathub (a
token served at `https://xevrion.dev/.well-known/org.flathub.VerifiedApps.txt`).
`io.github.xevrion.gyotaku` would verify through GitHub instead, but the
desktop file, icons and metainfo would all have to be renamed with it.
