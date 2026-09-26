# troubleshooting

if your problem isn't here, [open an issue](https://github.com/xevrion/gyotaku/issues/new/choose) with your distro, your desktop, and what `gyotaku-app` prints when you run it from a terminal.

- [building](#building)
- [opening the window](#opening-the-window)
- [searching](#searching)
- [the background reader](#the-background-reader)
- [copying](#copying)
- [speed](#speed)

## building

**the build fails with an error mentioning `cold_path`, or asking for a newer rustc.**
your rust is too old. gyotaku needs 1.95. install rust with [rustup](https://rustup.rs) rather than your distro's package, and run `cargo install` from inside the cloned folder, so the `rust-toolchain.toml` there picks the right version.

**the build fails looking for `fontconfig`, `xkbcommon`, `wayland` or `xcb`.**
one of the packages from [step 1 of the install](../README.md#1-the-build-tools) is missing. run your distro's line again.

**the build fails with `linker cc not found`.**
the C compiler is missing, which is also in step 1 (`build-essential`, `base-devel`, or `gcc`).

**the build dies partway with a bus error, or "no space left on device".**
the disk filled up. the build needs about 3 GB free while it runs.

## opening the window

**`gyotaku-app: command not found`.**
`~/.cargo/bin` isn't on your PATH yet. open a new terminal, or log out and back in after installing rustup.

**the key does nothing.**
run `RUST_LOG=warn gyotaku-app --once` in a terminal. if that opens the window, your desktop can't find it by name, so give the key binding the full path from `which gyotaku-app`. if it prints an error, that error is what to put in an issue.

**on GNOME it opens as a normal window, not over everything.**
that's expected. GNOME doesn't let apps float above other windows the way KDE, sway, Hyprland and other wlroots desktops do, so there it opens as a regular window.

**after updating, the old version still opens.**
the window stays running in the background between uses, so it has to be closed once: `pkill -x gyotaku-app`.

## searching

**nothing gets found.**
run `gyotaku stats` to see how many screenshots are searchable and where the index lives. if it's zero:

- check your folders in settings (ctrl ,) are the ones your screenshots are really saved to.
- check background reading is on, and the reader is running: `systemctl --user status gyotaku-watch`.
- or read everything once by hand with `gyotaku index`.

**one particular screenshot isn't found.**
see what gyotaku actually reads out of it with `gyotaku ocr path/to/shot.png`. if the text there is wrong or missing, that's the OCR, and an issue with the screenshot attached (if it's nothing private) helps a lot.

**text in hindi, russian, korean, arabic and so on isn't found.**
the OCR model can't read those scripts yet. see [compatibility](compatibility.md#what-it-cant-read).

**rotated or vertical text isn't found.**
the text finder only looks for upright lines. same page, same section.

## the background reader

**it isn't reading new screenshots.**

```sh
systemctl --user status gyotaku-watch      # is it running
journalctl --user -u gyotaku-watch -e      # the last thing it said
```

on a distro without systemd, check `~/.config/autostart/gyotaku-watch.desktop` exists and your desktop runs autostart entries. you can always start it by hand with `gyotaku watch`.

**the first read failed while offline.**
the models couldn't download. connect to the internet, and it tries again (the systemd service retries every 30 seconds).

**your cpu isn't x86_64 or ARM, or your distro uses musl (Alpine, Void musl).**
Microsoft doesn't publish an ONNX Runtime gyotaku can download for these. see [compatibility](compatibility.md#cpus).

## copying

**"couldn't copy the image, is wl-copy installed?"**
install `wl-clipboard` (wayland) or `xclip` (X11).

**copied text is gone after the window closes.**
on wayland, the clipboard belongs to the app that set it, so it disappears with that app. install `wl-clipboard` and gyotaku hands the clipboard to `wl-copy`, which keeps it alive.

## speed

**the window is slow or stutters.**
check the numbers in [performance](performance.md) for what to expect. if your gpu driver isn't working, gyotaku draws on the cpu instead, which is slower, and on purpose it swaps the flying and pressing animations for short fades.

**reading screenshots slows everything else down.**
it already runs at idle priority, but on a small laptop you can lower "cores per screenshot" in settings.
