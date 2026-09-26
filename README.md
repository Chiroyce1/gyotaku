# gyotaku

search every screenshot you've ever taken by the text inside it. native on linux, fully offline, and the OCR runs on plain CPU so you don't need a graphics card for it.

gyotaku (魚拓) is the old japanese way fishermen kept a record of a catch: ink the fish, press paper on it, and you've got a print that lasts. this does the same with your screen. you catch something, and it stays findable forever cuz every word in it got read and indexed.

you hit a key, type a few letters of anything you remember seeing, and every screenshot that says it shows up, dimmed like an ink print with just the words you typed still lit. enter opens one, and from there you can copy its text (all of it, one line, or whatever you drag a box over) or the image itself.

> it works and i use it, but it's young. linux only for now, tested on niri.

## how it works

```
screenshot lands in a folder you care about
  -> gyotaku notices (inotify), at idle priority so you never feel it
  -> OCR reads every line of text and where it sits in the image
  -> lines go into sqlite, full text search with a trigram index
  -> you hit a key, type a few letters, the screenshot is right there
```

it doesn't take the screenshots itself. niri, spectacle, grim, flameshot, whatever you already use, gyotaku just watches the folder they save to. the first run works through the backlog you already have, newest first, since the stuff from this week is what you're most likely to go looking for.

### reading the text

the models are [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)'s PP-OCRv6 (tiny detector, small recognizer), running on [ONNX Runtime](https://onnxruntime.ai) through the [`ort`](https://crates.io/crates/ort) crate. everything around them is written here: finding the text boxes in the detector's heat map, cutting each line out, batching them through the recognizer, and decoding what comes back.

i tried tesseract and [ocrs](https://github.com/robertknight/ocrs) first on my own screenshots and both dropped exactly the small UI text you'd want to search for (sidebar labels, buttons, tab names). paddle read nearly all of it. a few things were tuned for screenshots rather than photos of paper, all measured on my own library, numbers in [notes.md](notes.md):

| | paddle's default | gyotaku | why |
|---|---|---|---|
| detector | small | tiny | 4.6x faster, kept 99.6% of the words |
| detection size | upscale to 736 px, never shrink | only shrink, to ~1 MP | screen text is already readable size, upscaling a small crop cost 330 MB for nothing |
| boxes | rotated rectangles | upright ones | screenshot text is upright, so plain connected components do the job |
| batches | 6 lines | by total width | the recognizer scores 18k characters per step, that output tensor is what eats memory |

on this laptop that's about half a second a screenshot, 200 to 300 MB while reading and ~60 MB when the watcher is idle. my 5,159 screenshots took 43 minutes to backfill, and a fresh one is searchable about a second after you take it.

### finding it

one sqlite file, full text search with the trigram tokenizer. that's why partial words work: `nutsmp` finds `donutsmp.net`, and a word the OCR got slightly wrong is still findable from the parts it got right. every word you type has to show up somewhere in the shot, not necessarily on the same line. a search takes 1 to 10 ms.

### the window

[gpui](https://gpui.rs), the ui framework zed is built on. gpu drawn, through wgpu, so it runs on vulkan or plain opengl. on compositors with layer shell (niri, sway, hyprland, kde) it floats over everything like a launcher, anywhere else it's a normal window.

a few things that took some doing:

- the ink press. while you search, each thumbnail darkens and only the lines you matched stay lit, outlined in shu, the vermilion of a hanko seal. what you *selected* is always ink, what the search *found* is always shu.
- opening a shot grows it out of its tile with a spring, and springs can be interrupted, so hitting escape halfway turns it around from wherever it is instead of snapping.
- it stays resident. most of a cold start is the gpu driver waking up (300 to 800 ms here), so after the first launch the process stays around at ~37 MB and the key just asks it to show the window, about 120 ms end to end.
- copying goes through `wl-copy` when it's there. a wayland clipboard dies with the app that set it, so without that, copy then escape then paste would paste nothing.

## install

needs rust 1.95 (rustup picks it up from `rust-toolchain.toml` on its own) and a C compiler. `wl-copy` (from wl-clipboard) is optional but you want it.

```sh
git clone https://github.com/xevrion/gyotaku && cd gyotaku
cargo install --path crates/cli     # the `gyotaku` command and the watcher
cargo install --path crates/app     # the search window, `gyotaku-app`

# read everything already in ~/Pictures once (downloads the models, ~23 MB,
# the first time). or skip this, the watcher does it too, just slower.
gyotaku index

# then keep reading new ones in the background
cp contrib/gyotaku-watch.service ~/.config/systemd/user/
systemctl --user enable --now gyotaku-watch
```

bind `gyotaku-app` to a key. the same key opens and closes it.

```kdl
// niri, ~/.config/niri/config.kdl
binds {
    Mod+S { spawn "gyotaku-app"; }
}
```

```
# sway / i3
bindsym $mod+s exec gyotaku-app
# hyprland
bind = SUPER, S, exec, gyotaku-app
```

it watches your Pictures folder (XDG), and everything under it. point it somewhere else with `gyotaku watch ~/some/folder ~/another` (edit the service's `ExecStart` to make it stick).

## keys

| key | in the grid | on an open shot |
|---|---|---|
| type | search | back to the grid, searching |
| arrows, page up/down | move | left and right go to the next result |
| enter | open it | open the file in your image viewer |
| ctrl c | copy its text | copy the picked lines, or all of it |
| ctrl shift c | copy the image | same |
| ctrl o / ctrl shift o | open the file / show it in its folder | same |
| escape | clear the search, then close | back to the grid |

with the mouse: click a tile to open it. on an open shot, hover to see the lines, click one to copy it, drag a box to copy everything it touches.

`gyotaku-app --window` forces a normal window, `--once` exits on close instead of staying resident, `GYOTAKU_THEME=light` or `dark` overrides the system theme.

## the command line

```sh
gyotaku search invoice march      # paths plus the lines that matched
gyotaku stats                     # where things live, how many are indexed
gyotaku ocr some.png --boxes      # read one image, don't index it
gyotaku index [folders]           # read everything, then exit
gyotaku watch [folders]           # read everything, then keep watching
```

## where things live

```
~/.local/share/gyotaku/index.db     the text (22 MB for my 5k screenshots)
~/.local/share/gyotaku/models/      the two onnx models
~/.cache/gyotaku/thumbs/            grid thumbnails (130 MB for the same 5k), safe to delete
```

## limits

- linux only. the core, the OCR and the ui toolkit all run on mac and windows, the watcher and the overlay bits don't yet.
- i've only tested english. the recognizer's alphabet is ~18,700 characters of chinese, latin, japanese kana and greek, and nothing else: no devanagari, cyrillic, hangul or arabic, so hindi or russian text won't be read at all.
- rotated or vertical text isn't detected, boxes are upright on purpose.
- text in images smaller than 16 px on a side isn't read (it's usually not a screenshot).
- the first launch after boot pays the gpu setup, around half a second.
- the models download from RapidOCR's ModelScope mirror on first use and are checked against a sha256.

## layout

```
crates/core   the index: sqlite schema, search, thumbnail crop rules
crates/ocr    PP-OCRv6 on onnx runtime: detection, recognition, decoding
crates/cli    the `gyotaku` command: index, watch, search
crates/app    the search window (gpui)
contrib/      the systemd user unit for the watcher
```

## license

GPL-3.0-or-later. IBM Plex Sans is bundled under the SIL Open Font License (`crates/app/fonts/OFL.txt`). the PaddleOCR models are Apache-2.0 and aren't in this repo, they're downloaded.
