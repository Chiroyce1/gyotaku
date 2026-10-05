<p align="center">
  <img src="docs/banner.png" alt="gyotaku: search every screenshot by the text inside it" width="100%" />
</p>

<p align="center">
  Search every screenshot you have ever taken by the text inside it.<br>
  Native on Linux and Windows, fully offline, and fast on any hardware, with or without a GPU.
</p>

<h4 align="center">
  <a href="#installation">Installation</a> |
  <a href="docs/usage.md">Usage</a> |
  <a href="docs/troubleshooting.md">Troubleshooting</a> |
  <a href="CONTRIBUTING.md">Contributing</a>
</h4>

<p align="center">
  <a href="https://github.com/xevrion/gyotaku/actions/workflows/ci.yml"><img src="https://github.com/xevrion/gyotaku/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="GPL-3.0 licensed" /></a>
  <img src="https://img.shields.io/badge/platform-linux%20%7C%20windows-blue.svg" alt="Linux and Windows" />
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
</p>

gyotaku reads the text in every screenshot you take and makes it searchable. Press a shortcut, type a few letters of anything you remember seeing, and every matching screenshot appears with the matched words highlighted in place. Open one to copy its text, a selection of lines, or the image itself.

All processing happens locally. gyotaku does not take screenshots itself; it indexes the folders your existing screenshot tool saves to.

## Highlights

| Metric | Result |
|---|---|
| Search latency, 5,000+ screenshots | 1 to 10 ms per keystroke |
| Screenshot saved to searchable | 0.77 s |
| Window summon time | ~120 ms |
| Frame rate with a GPU | 144 fps (display refresh rate) |
| Memory while idle in the background | 37 MB |
| Disk usage | ~28 MB per 1,000 screenshots |

It also runs without a GPU, using software rendering. All figures were measured on real hardware; see [Performance](docs/performance.md) for the full results and methodology.

## Installation

### Linux

```sh
curl -fsSL https://raw.githubusercontent.com/xevrion/gyotaku/main/install.sh | sh
```

The script downloads the latest release for your machine, verifies its SHA-256 checksum and installs `gyotaku` and `gyotaku-app` to `~/.local/bin`. It needs no root access and changes nothing outside your home directory. On a first install it opens gyotaku so you can choose your screenshot folders, then shows how to add a keyboard shortcut for your desktop.

Release builds run on x86_64 and ARM64 with glibc 2.35 or newer: Ubuntu 22.04, Debian 12, Fedora 36, Linux Mint 21, Pop!_OS 22.04 and later, as well as Kali, Arch Linux and openSUSE Tumbleweed. Anything else can [build from source](#build-from-source).

### Windows

Windows support is a preview. In PowerShell:

```powershell
irm https://raw.githubusercontent.com/xevrion/gyotaku/main/install.ps1 | iex
```

This installs to `%LOCALAPPDATA%\Programs\gyotaku`, adds gyotaku to the Start menu and opens it. Press **Alt+Shift+S** anywhere to open or close the search window. No administrator rights are needed. Windows 10 and 11 on x64 are supported; ARM64 runs the x64 build through emulation.

### macOS

Not supported yet. It is on the [roadmap](#roadmap).

### Keyboard shortcut (Linux)

`gyotaku-app` opens the search window, and pressing the same shortcut again closes it. Bind it in your desktop's keyboard settings, using the full path `~/.local/bin/gyotaku-app`, since some desktops do not use your shell's `PATH`:

| Environment | Configuration |
|---|---|
| GNOME | Settings > Keyboard > View and Customize Shortcuts > Custom Shortcuts > Add |
| KDE Plasma | System Settings > Keyboard > Shortcuts > Add New > Command or Script |
| Xfce | Settings > Keyboard > Application Shortcuts > Add |
| Cinnamon | System Settings > Keyboard > Shortcuts > Custom Shortcuts > Add custom shortcut |
| sway, i3 | `bindsym $mod+s exec ~/.local/bin/gyotaku-app` |
| Hyprland | `bind = SUPER, S, exec, ~/.local/bin/gyotaku-app` |
| niri | `Mod+S { spawn "~/.local/bin/gyotaku-app"; }` in the `binds` block |
| Other | Any "run a command" shortcut. `gyotaku-app` can also be run from a terminal. |

### First run

On first launch, gyotaku asks:

1. **Which folders contain your screenshots.** It suggests the save locations of common screenshot tools (Flameshot, Spectacle, ksnip, grim, Hyprshot, niri) along with `~/Pictures/Screenshots`, `~/Pictures` and `~/Desktop`, with the number of images in each. On Windows it suggests `Pictures\Screenshots`, where Win+PrtScn and the Snipping Tool save.
2. **Whether to index new screenshots in the background.** On Linux this installs a systemd user service, or an XDG autostart entry on systems without systemd. On Windows it starts gyotaku when you sign in.

Indexing starts immediately, newest screenshots first, at idle CPU and I/O priority. Search is available while it runs.

Before the first screenshot is read, gyotaku downloads the OCR models once (22 MB), and on Linux ONNX Runtime as well (24 MB). No network access is needed after that.

### Updating

Run the install command again. It replaces the programs and restarts the background indexer; the index, settings and thumbnails are kept.

### Uninstalling

Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/xevrion/gyotaku/main/install.sh | sh -s -- --uninstall
```

Windows, in PowerShell:

```powershell
$env:GYOTAKU_UNINSTALL = 1; irm https://raw.githubusercontent.com/xevrion/gyotaku/main/install.ps1 | iex
```

Both stop the background indexer and remove the programs, and print how to also remove the index and settings. Remove the keyboard shortcut yourself. gyotaku never modifies or deletes your screenshots unless you move them to the trash yourself.

### Build from source

Building needs Rust and a C compiler. The steps below are verified in [CI](https://github.com/xevrion/gyotaku/actions/workflows/ci.yml) from a clean image of Ubuntu 22.04, Debian 12, Kali, Arch Linux, Fedora and openSUSE Tumbleweed.

#### 1. Install build dependencies

**Ubuntu, Debian, Kali, Linux Mint, Pop!_OS**

```sh
sudo apt install git curl build-essential pkg-config libfontconfig-dev libxkbcommon-x11-dev libwayland-dev libx11-xcb-dev
```

**Arch Linux, Manjaro, EndeavourOS**

```sh
sudo pacman -S --needed git curl base-devel fontconfig libxkbcommon-x11 wayland libxcb
```

**Fedora**

```sh
sudo dnf install git curl gcc gcc-c++ make pkgconf-pkg-config fontconfig-devel libxkbcommon-x11-devel wayland-devel libxcb-devel
```

**openSUSE**

```sh
sudo zypper install git curl gcc gcc-c++ make pkg-config fontconfig-devel libxkbcommon-x11-devel wayland-devel libxcb-devel
```

Optional: install `wl-clipboard` (Wayland) or `xclip` (X11) to enable copying images. Copying text works without them.

#### 2. Install Rust

gyotaku requires Rust 1.95 or newer. Install it with [rustup](https://rustup.rs) rather than your distribution's package manager, whose version is usually older:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Open a new terminal afterwards so that `cargo` is on your `PATH`. The repository's `rust-toolchain.toml` selects the correct version automatically.

#### 3. Build and install

```sh
git clone https://github.com/xevrion/gyotaku && cd gyotaku
cargo install --locked --path crates/cli     # gyotaku: the indexer and command-line interface
cargo install --locked --path crates/app     # gyotaku-app: the search window
```

Both binaries are installed to `~/.cargo/bin`; use `~/.cargo/bin/gyotaku-app` for the [keyboard shortcut](#keyboard-shortcut-linux). The first build compiles the UI toolkit from source and takes several minutes. It requires about 3 GB of free disk space while running; the build directory is removed afterwards.

To update a source build, `git pull` and run both `cargo install` commands again, then `systemctl --user restart gyotaku-watch` and `pkill -x gyotaku-app` so the new version is used. To remove it, run the uninstall command above, then `cargo uninstall gyotaku gyotaku-app`.

If anything does not work as described, see [Troubleshooting](docs/troubleshooting.md).

## Usage

| Key | Action |
|---|---|
| Type | Search. Partial words match: `nutsmp` finds `donutsmp.net`. |
| Arrow keys | Move between results |
| Enter | Open the selected screenshot |
| Ctrl+C | Copy the screenshot's text, or the selected lines |
| Ctrl+Shift+C | Copy the image |
| Ctrl+, | Open settings |
| Ctrl+Shift+A, Ctrl+Delete | Mark every result, then move them to the trash. Ctrl+Z puts them back. |
| Escape | Clear the search, then close |

Every word in a query must appear somewhere in the screenshot, not necessarily on the same line. On an open screenshot, drag a box to copy only the lines inside it.

A command-line interface is also available:

```sh
gyotaku search invoice march
```

See the [usage guide](docs/usage.md) for all keys, settings and commands.

## Privacy

gyotaku runs entirely on your machine. It has no telemetry, accounts or update checks. Its only network access is the one-time download of the OCR models (from ModelScope) and ONNX Runtime (Microsoft's official build, from GitHub), each verified against a pinned SHA-256 checksum before use.

## Roadmap

- [x] Move screenshots to the trash in bulk: search, mark the results, move them to the system trash, with undo
- [ ] Simple installation on every supported OS: prebuilt releases and a one-command install, no Rust toolchain needed
- [ ] A landing page with a demo, the measured numbers and the install commands
- [ ] Windows support
- [ ] macOS support
- [ ] Optional classification of screenshots (one-time codes, receipts, chats) with Jev, to find and clear out the throwaway ones. Opt-in and off by default; only the recognized text is sent, never the image
- [ ] Typo-tolerant search for OCR misreads: look-alike characters (`0` and `O`, `rn` and `m`, `l` and `1`) and words the OCR split apart (`ord er` for `order`). Exact matches always rank first, and near matches are labelled as such, with the text exactly as it was read, so an error code is never silently "corrected". Substring matching already works through the trigram index
- [ ] Search by what a screenshot shows, not only the text in it ("the one with a cat"), using a small local image embedding model such as CLIP. Optional, offline, and fast enough without a GPU
- [x] A keyboard shortcuts page in settings that lists every shortcut and lets each one be rebound by pressing the new keys
- [ ] Screenshots that only ever go to the clipboard: an opt-in setting that saves images copied to the clipboard into a folder of their own, so they become searchable like any other screenshot
- [ ] Group bursts of near-identical screenshots
- [ ] Search filters such as `app:`, `in:` and dates like `yesterday`
- [ ] More scripts, starting with Devanagari, and vertical text

Suggestions are welcome as [feature requests](https://github.com/xevrion/gyotaku/issues/new?template=feature_request.yml).

## Documentation

| Document | Contents |
|---|---|
| [Usage](docs/usage.md) | Keys, mouse controls, settings, the command-line interface, file locations |
| [Troubleshooting](docs/troubleshooting.md) | Build, launch, search, indexing and clipboard problems |
| [Compatibility](docs/compatibility.md) | Supported desktops, GPUs, distributions and CPUs, and known limitations |
| [Performance](docs/performance.md) | Measured CPU, memory, frame time and disk usage |
| [Architecture](docs/architecture.md) | How OCR, indexing and the search window work, and why |
| [Development log](notes.md) | Measurements, rejected approaches and notable bugs from development |

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup and pull request guidelines. Questions belong in [Discussions](https://github.com/xevrion/gyotaku/discussions). Report security issues as described in [SECURITY.md](SECURITY.md), not in public issues.

Testing on untested configurations is particularly valuable. GNOME, KDE Plasma, integrated GPUs, ARM and non-systemd distributions have not been verified yet. Please [submit a compatibility report](https://github.com/xevrion/gyotaku/issues/new?template=compatibility_report.yml) whether it works or not.

## Built with

- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) PP-OCRv6 models, run on [ONNX Runtime](https://onnxruntime.ai) via [`ort`](https://crates.io/crates/ort)
- SQLite FTS5 with the trigram tokenizer, via [`rusqlite`](https://crates.io/crates/rusqlite)
- [GPUI](https://gpui.rs), the UI framework behind the Zed editor

Text detection post-processing, line extraction, batching and decoding are implemented in this repository.

## About the name

Gyotaku (魚拓) is a traditional Japanese method of recording a catch: the fish is inked and pressed onto paper to make a lasting print. The search window borrows the idea. While you search, every screenshot is inked dark and only the matching words remain lit.

## Star history

<a href="https://star-history.com/#xevrion/gyotaku&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=xevrion/gyotaku&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=xevrion/gyotaku&type=Date" />
    <img alt="Star history for xevrion/gyotaku" src="https://api.star-history.com/svg?repos=xevrion/gyotaku&type=Date" />
  </picture>
</a>

## License

gyotaku is licensed under the [GNU General Public License v3.0 or later](LICENSE).

IBM Plex Sans is bundled under the SIL Open Font License 1.1 ([`crates/app/fonts/OFL.txt`](crates/app/fonts/OFL.txt)). The PaddleOCR models are licensed under Apache-2.0; they are downloaded at runtime and not distributed with this repository.
