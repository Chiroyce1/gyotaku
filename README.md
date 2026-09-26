<h1 align="center">gyotaku</h1>

<p align="center">
  search every screenshot you've ever taken by the text inside it.<br>
  native on linux, fully offline, runs on any laptop, with or without a gpu.
</p>

<h4 align="center">
  <a href="#install">Install</a> |
  <a href="docs/usage.md">Usage</a> |
  <a href="docs/troubleshooting.md">Troubleshooting</a> |
  <a href="CONTRIBUTING.md">Contributing</a>
</h4>

<p align="center">
  <a href="https://github.com/xevrion/gyotaku/actions/workflows/ci.yml"><img src="https://github.com/xevrion/gyotaku/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="GPL-3.0 licensed" /></a>
  <img src="https://img.shields.io/badge/platform-linux-blue.svg" alt="Linux" />
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
</p>

hit a key, type a few letters of anything you remember seeing, and every screenshot that says it shows up, with the words you typed lit up where they sit in the image. enter opens one, and from there you can copy its text or the image.

| | |
|---|---|
| **1 to 10 ms** | to search 5,000+ screenshots, on every keystroke |
| **0.77 s** | from a screenshot being saved to it being searchable |
| **~120 ms** | to summon the search window |
| **144 fps** | on a gpu, and it still runs with **no gpu at all** |
| **37 MB** | while it sits hidden, waiting for the key |
| **~28 MB** | of disk per 1,000 screenshots |

all measured on real screenshots, [performance](docs/performance.md) has the rest.

gyotaku (魚拓) is the old japanese way fishermen kept a record of a catch: ink the fish, press paper on it, and you've got a print that lasts. this does the same with your screen. you catch something, and it stays findable because every word in it got read and indexed.

## install

gyotaku runs on linux, on x86_64 (64 bit ARM should work too, but nobody has tried it yet). you build it from source, which takes four steps, once. steps 1 to 3 are run from a clean image of Ubuntu 22.04, Debian 12, Kali, Arch, Fedora and openSUSE on every push ([ci](https://github.com/xevrion/gyotaku/actions/workflows/ci.yml)), so the package lists below are known to be enough.

### 1. the build tools

pick your distro:

```sh
# Ubuntu, Debian, Kali, Mint, Pop!_OS
sudo apt install git curl build-essential pkg-config libfontconfig-dev libxkbcommon-x11-dev libwayland-dev libx11-xcb-dev
```

```sh
# Arch, Manjaro, EndeavourOS
sudo pacman -S --needed git curl base-devel fontconfig libxkbcommon-x11 wayland libxcb
```

```sh
# Fedora
sudo dnf install git curl gcc gcc-c++ make pkgconf-pkg-config fontconfig-devel libxkbcommon-x11-devel wayland-devel libxcb-devel
```

```sh
# openSUSE
sudo zypper install git curl gcc gcc-c++ make pkg-config fontconfig-devel libxkbcommon-x11-devel wayland-devel libxcb-devel
```

optional but worth it: `wl-clipboard` on wayland, or `xclip` on X11. copying text works without them, copying an image doesn't.

### 2. rust

skip this if you already have rust from rustup. if you don't, install it with rustup rather than your distro's rust package, which is usually too old (gyotaku needs 1.95, and rustup fetches the right version on its own):

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

then open a new terminal so `cargo` is on your PATH.

### 3. build it

```sh
git clone https://github.com/xevrion/gyotaku && cd gyotaku
cargo install --locked --path crates/cli     # `gyotaku`, reads your screenshots in the background
cargo install --locked --path crates/app     # `gyotaku-app`, the search window
```

both land in `~/.cargo/bin`. the first build takes a while because it compiles the ui toolkit from source, and it needs about 3 GB of free disk while it runs (the build folder is deleted afterwards).

### 4. bind a key

`gyotaku-app` is the search window. bind it to a key and that key opens it, and pressing it again closes it. Super+S is a good pick if it's free.

some desktops don't search the same PATH your terminal does, so if the key does nothing, use the full path. `which gyotaku-app` prints it, something like `/home/you/.cargo/bin/gyotaku-app`.

- **GNOME**: Settings > Keyboard > View and Customize Shortcuts > Custom Shortcuts > +. set the command to the full path and pick a key.
- **KDE Plasma**: System Settings > Keyboard > Shortcuts > Add New > Command or Script. use the full path and pick a key.
- **sway or i3**: `bindsym $mod+s exec gyotaku-app`
- **Hyprland**: `bind = SUPER, S, exec, gyotaku-app`
- **niri**: `Mod+S { spawn "gyotaku-app"; }` in the `binds` block
- **anything else**: whatever your desktop calls "run a command on a shortcut". running `gyotaku-app` in a terminal works too.

### the first launch

press the key. the first time, gyotaku asks two things:

1. **which folders your screenshots are in.** it suggests where your screenshot tool saves (it knows flameshot, spectacle, ksnip, grim, hyprshot and niri), plus `~/Pictures/Screenshots`, `~/Pictures` and `~/Desktop`, and shows how many images each one has.
2. **whether to keep reading new screenshots in the background.** say yes, and it sets up a systemd user service (or an autostart entry, on distros without systemd) so new screenshots are searchable a moment after you take them.

then it starts reading, newest first, and you can search while it works through the rest. it runs at idle priority, so anything else you're doing comes first.

be online for the very first read: it downloads the two OCR models and the runtime once (46 MB on disk). after that it never touches the network.

gyotaku doesn't take screenshots itself. keep using whatever tool you have.

### updating

```sh
cd gyotaku && git pull
cargo install --locked --path crates/cli
cargo install --locked --path crates/app
systemctl --user restart gyotaku-watch     # restart the background reader on the new version
pkill -x gyotaku-app                        # the window stays running hidden between uses, this closes the old one
```

your index, settings and thumbnails carry over.

### uninstalling

```sh
systemctl --user disable --now gyotaku-watch
rm -f ~/.config/systemd/user/gyotaku-watch.service ~/.config/autostart/gyotaku-watch.desktop
pkill -x gyotaku-app
cargo uninstall gyotaku gyotaku-app
rm -rf ~/.config/gyotaku ~/.local/share/gyotaku ~/.cache/gyotaku
```

then remove the key binding. your screenshots are never touched, gyotaku doesn't change or delete them.

something not working? [troubleshooting](docs/troubleshooting.md) covers the common problems.

## using it

- **type** to search. partial words work: `nutsmp` finds `donutsmp.net`. every word you type has to be somewhere in the shot, not necessarily on the same line.
- **arrows** to move, **enter** to open a shot.
- on an open shot, **ctrl c** copies its text, **ctrl shift c** copies the image, and dragging a box copies just the lines inside it.
- **escape** clears the search, then closes.
- **ctrl ,** opens settings: folders, theme, background reading, and how many cores it may use.

there's a command line too, `gyotaku search invoice march` prints every screenshot with both words in it. [usage](docs/usage.md) has every key, setting and command.

## privacy

nothing leaves your machine. the only network use is that one-time download: the OCR models from ModelScope and Microsoft's official ONNX Runtime from GitHub, each checked against a sha256 before it's used. no telemetry, no accounts.

## docs

| | |
|---|---|
| [usage](docs/usage.md) | every key, the mouse, settings, the command line, where files live |
| [troubleshooting](docs/troubleshooting.md) | when the build, the key, the search or the background reader doesn't work |
| [compatibility](docs/compatibility.md) | the desktops, gpus, distros and cpus it runs on, and the text it can't read |
| [performance](docs/performance.md) | what it costs your machine, with a gpu, without one, and on 2 or 4 cores |
| [how it works](docs/how-it-works.md) | the OCR, the index, the window, and why each is built the way it is |
| [notes.md](notes.md) | the build log: every measurement, what turned out wrong, and the bugs that cost the most time |

## contributing

bug reports, fixes and ideas are all welcome. [CONTRIBUTING.md](CONTRIBUTING.md) explains how to build it for development and what a good pull request looks like. if you're reporting a security problem, see [SECURITY.md](SECURITY.md) instead of opening an issue.

## license

GPL-3.0-or-later. IBM Plex Sans is bundled under the SIL Open Font License (`crates/app/fonts/OFL.txt`). the PaddleOCR models are Apache-2.0 and aren't in this repo, they're downloaded.
