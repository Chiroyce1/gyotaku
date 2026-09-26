# compatibility

what gyotaku runs on, what's been tested, and what it can't do yet. "not yet" means nobody has tried it, not that it's known to break. if you run it somewhere marked "not yet", an issue saying how it went (good or bad) is really useful.

- [desktops](#desktops)
- [graphics](#graphics)
- [distros](#distros)
- [cpus](#cpus)
- [what it can't read](#what-it-cant-read)
- [other limits](#other-limits)

## desktops

| | what happens | tested |
|---|---|---|
| wayland with layer shell (KDE Plasma, sway, Hyprland, niri, river, Wayfire) | floats over everything, like a launcher | niri |
| GNOME on wayland | a normal window | not yet |
| X11 | a normal window | yes, through Xwayland |

## graphics

| | what happens | tested |
|---|---|---|
| a dedicated gpu | draws with vulkan | RTX 4060, Nvidia 580 driver |
| an integrated gpu or APU (Intel, AMD) | vulkan or opengl through Mesa, the same path as a dedicated gpu | not yet |
| no gpu at all | Mesa's software renderer, with calmer motion | yes, vulkan and opengl, on 2, 4 and 28 cores |

without a gpu it notices on its own, and swaps the flying tile and the ink press animation for short fades, since every animated frame drawn on the cpu costs real battery.

## distros

| | what happens | tested |
|---|---|---|
| Ubuntu 22.04, Debian 12, Kali, Arch, Fedora, openSUSE | built from a clean image and tested on every push | [ci](https://github.com/xevrion/gyotaku/actions/workflows/ci.yml) |
| older glibc distros | the ONNX Runtime it downloads runs on anything from Ubuntu 18.04 and Debian 10 on | not yet |
| systemd | background reading as a user service | yes |
| no systemd (Void, Artix and so on) | background reading from an XDG autostart entry | not yet |
| musl based (Alpine, Void musl) | Microsoft ships no musl build of ONNX Runtime | not supported yet |

## cpus

| | what happens | tested |
|---|---|---|
| x86_64 | ONNX Runtime is downloaded automatically | yes |
| 64 bit ARM | ONNX Runtime is downloaded automatically | not yet |
| anything else (RISC-V, 32 bit) | install ONNX Runtime yourself, see below | no |

for a cpu Microsoft doesn't publish ONNX Runtime for, build or install it yourself, then point gyotaku at it:

```sh
export ORT_DYLIB_PATH=/path/to/libonnxruntime.so
```

set it for the background reader too, for example with `systemctl --user edit gyotaku-watch` and an `Environment=ORT_DYLIB_PATH=...` line.

## what it can't read

the OCR model's alphabet is about 18,700 characters of chinese, latin, japanese kana and greek, and nothing else. that means:

- **not read:** devanagari (hindi, marathi), cyrillic (russian, ukrainian), hangul (korean), arabic, hebrew, thai, and other scripts.
- **only tested with english.** chinese and japanese should work, since the model was trained on them, but haven't been checked.
- **rotated or vertical text isn't found.** the text finder only looks for upright lines, on purpose, since nearly all screenshot text is upright.

a model with devanagari is on the list.

## other limits

- **linux only, for now.** the index, the OCR and the ui toolkit all run on mac and windows. the background reader and the floating window don't yet.
- **huge images are skipped.** anything bigger than about 64 megapixels isn't loaded, so one giant scan can't push a small laptop into swap. images under 16 px on a side are skipped too.
- **it won't read your whole home folder or `/`.** pick the folders your screenshots are actually in.
