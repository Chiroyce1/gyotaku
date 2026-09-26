# Compatibility

This page lists the platforms gyotaku supports and their verification status. "Not yet verified" means the configuration has not been tested, not that it is known to fail. Reports from untested configurations are welcome; use the [compatibility report](https://github.com/xevrion/gyotaku/issues/new?template=compatibility_report.yml) template.

- [Desktop environments](#desktop-environments)
- [Graphics](#graphics)
- [Distributions](#distributions)
- [CPU architectures](#cpu-architectures)
- [Language support](#language-support)
- [Known limitations](#known-limitations)

## Desktop environments

| Environment | Behavior | Status |
|---|---|---|
| Wayland with layer-shell (KDE Plasma, sway, Hyprland, niri, river, Wayfire) | Overlay above all windows | Verified on niri |
| GNOME on Wayland | Regular window | Not yet verified |
| X11 | Regular window | Verified through Xwayland |

## Graphics

| Hardware | Renderer | Status |
|---|---|---|
| Dedicated GPU | Vulkan | Verified: NVIDIA RTX 4060, driver 580 |
| Integrated GPU or APU (Intel, AMD) | Vulkan or OpenGL through Mesa | Not yet verified |
| No GPU | Mesa software rendering (lavapipe or llvmpipe), reduced motion | Verified with Vulkan and OpenGL on 2, 4 and 28 cores |

When software rendering is detected, animated transitions are replaced with short fades to reduce CPU usage.

## Distributions

| Distribution | Notes | Status |
|---|---|---|
| Ubuntu 22.04, Debian 12, Kali, Arch Linux, Fedora, openSUSE Tumbleweed | Built and tested from a clean image on every commit | Verified in [CI](https://github.com/xevrion/gyotaku/actions/workflows/ci.yml) |
| Older glibc-based distributions | ONNX Runtime requires glibc 2.27 (Ubuntu 18.04, Debian 10 or newer) | Not yet verified |
| systemd | Background indexing as a user service | Verified |
| Non-systemd (Void, Artix and others) | Background indexing through an XDG autostart entry | Not yet verified |
| musl-based (Alpine, Void musl) | No ONNX Runtime build is published for musl | Not supported |

## CPU architectures

| Architecture | ONNX Runtime | Status |
|---|---|---|
| x86_64 | Downloaded automatically | Verified |
| aarch64 | Downloaded automatically | Not yet verified |
| Other (RISC-V, 32-bit) | Must be provided manually | Not supported |

On architectures without an official ONNX Runtime build, build or install it separately and set `ORT_DYLIB_PATH`:

```sh
export ORT_DYLIB_PATH=/path/to/libonnxruntime.so
```

The background indexer needs the same variable. With systemd, run `systemctl --user edit gyotaku-watch` and add:

```ini
[Service]
Environment=ORT_DYLIB_PATH=/path/to/libonnxruntime.so
```

## Language support

The recognition model's character set contains approximately 18,700 characters covering Chinese, Latin, Japanese kana and Greek.

| Script | Status |
|---|---|
| Latin (English) | Verified |
| Chinese, Japanese | Supported by the model, not yet verified |
| Devanagari, Cyrillic, Hangul, Arabic, Hebrew, Thai and others | Not supported |

Text detection only considers horizontal lines. Rotated and vertical text is not detected.

## Known limitations

- **Linux only.** The index, OCR engine and UI toolkit are portable to macOS and Windows; the background indexer and overlay window are not yet.
- **Image size limits.** Images larger than about 64 megapixels are skipped to bound memory usage. Images smaller than 16 pixels on either side are also skipped.
- **Folder restrictions.** The home directory and `/` cannot be selected as indexed folders.
