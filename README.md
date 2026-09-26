# gyotaku

[![ci](https://github.com/xevrion/gyotaku/actions/workflows/ci.yml/badge.svg)](https://github.com/xevrion/gyotaku/actions/workflows/ci.yml)

search every screenshot you've ever taken by the text inside it. native on linux, fully offline, runs on any laptop, with or without a gpu.

| | |
|---|---|
| **1 to 10 ms** | to search 5,000+ screenshots, on every keystroke |
| **0.77 s** | from a screenshot being saved to it being searchable |
| **~120 ms** | to summon the search window |
| **144 fps** | on a gpu, as fast as the display refreshes, and it still runs with **no gpu at all** |
| **37 MB** | while it sits hidden, waiting for the key |
| **0.67 s** | to read a whole screenshot on 4 cores, 1.3 s on one |
| **99.5%** | of the words the full size OCR model finds, with a detector **4.6x faster** |
| **~28 MB** | of disk per 1,000 screenshots |

all measured on real screenshots, the tables below have the rest.

gyotaku (魚拓) is the old japanese way fishermen kept a record of a catch: ink the fish, press paper on it, and you've got a print that lasts. this does the same with your screen. you catch something, and it stays findable forever cuz every word in it got read and indexed.

you hit a key, type a few letters of anything you remember seeing, and every screenshot that says it shows up, dimmed like an ink print with just the words you typed still lit. enter opens one, and from there you can copy its text (all of it, one line, or whatever you drag a box over) or the image itself.

nothing leaves your machine. the only time it touches the network is the first time it reads a screenshot, to download the two OCR models and Microsoft's official ONNX Runtime build, once, each checked against a sha256.

## how it works

```
screenshot lands in a folder you picked
  -> gyotaku notices (inotify), at idle priority so you never feel it
  -> OCR reads every line of text and where it sits in the image
  -> lines go into sqlite, full text search with a trigram index
  -> you hit a key, type a few letters, the screenshot is right there
```

it doesn't take the screenshots itself, whatever tool you already use is fine, gyotaku watches the folder it saves to. the first time you open it, it asks which folders those are (it looks at where the common tools are set to save, and which folders are full of screenshot-looking files) and offers to keep reading new ones in the background. the backlog you already have gets read newest first, since this week's stuff is what you're most likely to go looking for.

### reading the text

the models are [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)'s PP-OCRv6 (tiny detector, small recognizer), running on [ONNX Runtime](https://onnxruntime.ai) through the [`ort`](https://crates.io/crates/ort) crate, all on the cpu. everything around them is written here: finding the text boxes in the detector's heat map, cutting each line out, batching them through the recognizer, and decoding what comes back.

ONNX Runtime is loaded at run time from Microsoft's official build instead of being linked in. the prebuilt one most rust projects link is built against a very new glibc, and CI showed it won't even link on Ubuntu 22.04 or Debian 12. Microsoft's needs glibc 2.27, so it runs on anything from Ubuntu 18.04 and Debian 10 on.

i tried tesseract and [ocrs](https://github.com/robertknight/ocrs) first on my own screenshots and both dropped exactly the small UI text you'd want to search for (sidebar labels, buttons, tab names). paddle read nearly all of it. then it got tuned for screenshots rather than photos of paper:

| | paddle's default | gyotaku | why |
|---|---|---|---|
| detector | small | tiny | 4.6x faster, kept 99.6% of the words |
| detection size | upscale to 736 px, never shrink | only shrink, to ~1 MP | screen text is already readable size, upscaling a small crop cost 330 MB for nothing |
| boxes | rotated rectangles | upright ones | screenshot text is upright, so plain connected components do the job |
| batches | 6 lines | by total width | the recognizer scores 18k characters per step, that output tensor is what eats memory |

### finding it

one sqlite file, full text search with the trigram tokenizer. that's why partial words work: `nutsmp` finds `donutsmp.net`, and a word the OCR got slightly wrong is still findable from the parts it got right. every word you type has to show up somewhere in the shot, not necessarily on the same line.

### the window

[gpui](https://gpui.rs), the ui framework zed is built on, drawing through wgpu on vulkan or opengl. a few things that took some doing:

- the ink press. while you search, each thumbnail darkens and only the lines you matched stay lit, outlined in shu, the vermilion of a hanko seal. what you *selected* is always ink, what the search *found* is always shu.
- opening a shot grows it out of its tile with a spring. springs can be interrupted, so escape halfway turns it around from wherever it is instead of snapping.
- it stays resident. most of a cold start is the gpu driver waking up, so after the first launch the process stays around and the key just asks it to show the window. it opens exactly where you left it: same search, same selection, same shot open.
- without a gpu it notices, and swaps the flying tile and the ink press animation for short fades, since every animated frame drawn on the cpu costs real battery.
- copying goes through `wl-copy` when it's there. a wayland clipboard dies with the app that set it, so without that, copy then escape then paste would paste nothing.

## what it costs your machine

measured on an i7-14700HX laptop (28 threads) with an RTX 4060, Fedora 43. "no gpu" means every gpu driver hidden so it draws with Mesa's software renderer, the way a machine without one would, and "4 cores" or "2 cores" means the process pinned to that many with `taskset`.

### the search window

one scripted session each: open it, type a word, open a shot and close it, page down 15 times.

| | gpu | no gpu, 28 threads | no gpu, 4 cores | no gpu, 2 cores |
|---|---|---|---|---|
| first launch to window | 0.5 to 0.7 s | 0.4 s | 0.4 s | 0.4 s |
| every launch after that | ~120 ms | | | |
| frame while scrolling, typical | 7 ms (144 fps) | 41 to 45 ms | 78 ms | |
| frame while scrolling, slowest 5% | 31 to 39 ms | 74 to 80 ms | 98 ms | 98 ms |
| building a frame (gyotaku's own code) | 0.04 ms | 0.05 ms | 0.04 ms | 0.03 ms |
| cpu time for the whole session | 3.1 s | 28 to 31 s | 17 to 20 s | 12 to 14 s |
| memory of its own, after the session | 123 MB | 145 MB | 142 to 160 MB | 140 to 164 MB |
| memory counting shared libraries | 245 MB | 405 MB | 410 MB | 400 MB |
| memory while hidden | 37 MB | | | |
| escape to closed | | | 124 ms | 122 ms |

it only draws when something changes, so sitting open and idle costs nothing in any of these. empty cells weren't measured.

### reading screenshots (the watcher)

25 real screenshots, the process pinned to n cores:

| cores | 1 | 2 | 4 |
|---|---|---|---|
| time per screenshot | 1.32 s | 1.21 s | 0.67 s |
| peak memory | 278 MB | 311 MB | 289 MB |

between screenshots the watcher sits at about 60 MB. it runs at idle cpu and io priority, so anything else you do comes first, and on battery it slows its way through an old backlog to one screenshot every few seconds (new ones are still read straight away). the systemd unit caps it at 400 MB. my library of 5,159 screenshots took 43 minutes to read on 6 threads.

### disk

| | |
|---|---|
| the text index | ~4.6 MB per 1,000 screenshots |
| grid thumbnails | ~23 MB per 1,000 (24 KB each, safe to delete, redrawn as needed) |
| OCR models | 22 MB, once |
| ONNX Runtime | 24 MB, once (Microsoft's own build, fetched on first use) |
| the two programs | 8 MB and 34 MB |

## runs on

| | what happens | tested |
|---|---|---|
| wayland with layer shell (KDE Plasma, sway, Hyprland, niri, river, Wayfire) | floats over everything like a launcher | niri |
| GNOME on wayland | a normal window | not yet |
| X11 | a normal window | yes, through Xwayland |
| a dedicated gpu | vulkan | RTX 4060, Nvidia 580 driver |
| an integrated gpu or APU (Intel, AMD) | vulkan or opengl through Mesa, the same path as a dedicated gpu | not measured yet |
| no gpu at all | Mesa's software renderer, with calm motion | yes, vulkan and opengl, on 2, 4 and 28 cores |
| systemd | background reading as a user service | yes |
| no systemd (Void, Artix, Alpine and so on) | background reading from an XDG autostart entry | not yet |
| Ubuntu 22.04, Debian 12, Kali, Arch, Fedora, openSUSE | built from scratch and tested on every push | [ci](https://github.com/xevrion/gyotaku/actions/workflows/ci.yml) |
| x86_64 and 64 bit ARM | Microsoft publishes ONNX Runtime for both, fetched automatically | x86_64 |
| other cpus (RISC-V, 32 bit) | install onnxruntime yourself and set `ORT_DYLIB_PATH` to its `libonnxruntime.so` | no |
| musl based distros (Alpine, Void musl) | ONNX Runtime ships no musl build | not supported yet |

## install

you need rust (rustup picks the right version from `rust-toolchain.toml` on its own, [get rustup here](https://rustup.rs)), a C compiler and a few libraries for the window:

| distro | packages |
|---|---|
| Ubuntu, Debian, Kali, Mint, Pop | `sudo apt install build-essential pkg-config libfontconfig-dev libxkbcommon-x11-dev libwayland-dev libx11-xcb-dev` |
| Arch, Manjaro, EndeavourOS | `sudo pacman -S --needed base-devel fontconfig libxkbcommon-x11 wayland libxcb` |
| Fedora | `sudo dnf install gcc gcc-c++ make pkgconf-pkg-config fontconfig-devel libxkbcommon-x11-devel wayland-devel libxcb-devel` |
| openSUSE | `sudo zypper install gcc gcc-c++ make pkg-config fontconfig-devel libxkbcommon-x11-devel wayland-devel libxcb-devel` |

`wl-copy` (from wl-clipboard) is optional, but copying images needs it on wayland (or `xclip` on X11).

```sh
git clone https://github.com/xevrion/gyotaku && cd gyotaku
cargo install --path crates/cli     # `gyotaku`, the watcher and command line
cargo install --path crates/app     # `gyotaku-app`, the search window
```

then bind `gyotaku-app` to a key, in your desktop's keyboard shortcut settings (GNOME and KDE both have "custom shortcut, run a command") or your compositor's config:

```
# sway / i3
bindsym $mod+s exec gyotaku-app
# hyprland
bind = SUPER, S, exec, gyotaku-app
# niri
Mod+S { spawn "gyotaku-app"; }
```

the first time you press it, onboarding asks which folders to read and whether to keep reading new screenshots in the background, and sets that up (a systemd user service, or an autostart entry where there's no systemd). the same key closes it again.

## keys

| key | in the grid | on an open shot |
|---|---|---|
| type | search | back to the grid, searching |
| arrows, page up/down | move | left and right go to the next result |
| enter | open it | open the file in your image viewer |
| ctrl c | copy its text | copy the picked lines, or all of it |
| ctrl shift c | copy the image | same |
| ctrl o / ctrl shift o | open the file / show it in its folder | same |
| ctrl , | settings | |
| escape | clear the search, then close | back to the grid |

with the mouse: click a tile to open it. on an open shot, hover to see the lines, click one to copy it, drag a box to copy everything it touches.

settings has the folders it reads, the theme (system, light or dark), background reading on or off, how many cores reading a screenshot may use, and clearing the thumbnail cache.

`gyotaku-app --window` forces a normal window, `--once` exits on close instead of staying resident, `GYOTAKU_FRAME_STATS=1` prints frame timings when the window closes.

## the command line

```sh
gyotaku search invoice march      # paths plus the lines that matched
gyotaku stats                     # where things live, how many are indexed
gyotaku ocr some.png --boxes      # read one image, don't index it
gyotaku index [folders]           # read everything once, then exit
gyotaku watch [folders]           # read everything, then keep watching
```

without folders, `index` and `watch` use the ones from settings, and `watch` follows changes to them live.

## where things live

```
~/.config/gyotaku/config.toml       folders, theme, threads
~/.local/share/gyotaku/index.db     the text
~/.local/share/gyotaku/models/      the two onnx models
~/.local/share/gyotaku/runtime/     ONNX Runtime
~/.cache/gyotaku/thumbs/            grid thumbnails, safe to delete
```

to remove it all: `systemctl --user disable --now gyotaku-watch` (or delete `~/.config/autostart/gyotaku-watch.desktop`), `cargo uninstall gyotaku gyotaku-app`, and delete the folders above. it never changes or deletes your screenshots.

## limits

- linux only for now. the core, the OCR and the ui toolkit all run on mac and windows, the watcher and the overlay bits don't yet.
- the recognizer's alphabet is ~18,700 characters of chinese, latin, japanese kana and greek, and nothing else: no devanagari, cyrillic, hangul or arabic, so hindi or russian text won't be read. i've only tested english.
- rotated or vertical text isn't detected, boxes are upright on purpose.
- images bigger than about 64 megapixels are skipped rather than loaded, so one giant scan can't push a small laptop into swap. so are images under 16 px on a side.
- it won't take your whole home folder or `/` as a folder to read, pick the ones your screenshots are actually in.

## layout

```
crates/core   the index, the config, search, thumbnail crop rules
crates/ocr    PP-OCRv6 on onnx runtime: detection, recognition, decoding
crates/cli    the `gyotaku` command: index, watch, search
crates/app    the search window, onboarding and settings (gpui)
contrib/      a systemd user unit, if you'd rather set it up by hand
```

[notes.md](notes.md) is the build log: every measurement, what turned out wrong, and the bugs that cost the most time.

## license

GPL-3.0-or-later. IBM Plex Sans is bundled under the SIL Open Font License (`crates/app/fonts/OFL.txt`). the PaddleOCR models are Apache-2.0 and aren't in this repo, they're downloaded.
