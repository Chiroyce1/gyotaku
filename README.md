# gyotaku

search every screenshot you've ever taken by the text inside it. native on linux, fully offline, and the OCR runs on plain CPU so you don't need a graphics card for it.

gyotaku (魚拓) is the old japanese way fishermen kept a record of a catch: ink the fish, press paper on it, and you've got a print of it that lasts. this does the same with your screen, you catch something, and it stays findable forever cuz every word in it got read and indexed.

> early days. the index and the search CLI work, the OCR and the window are next. nothing here is ready for anyone to use yet.

## how it works

```
screenshot lands in a folder you care about
  -> gyotaku notices (inotify), at idle priority so you never feel it
  -> OCR reads every line of text and where it sits in the image
  -> lines go into sqlite, full text search with a trigram index
  -> you hit a key, type a few letters, the screenshot is right there
```

it doesn't take the screenshots itself (not yet at least). niri, spectacle, grim, flameshot, whatever you already use, gyotaku just watches the folder they save to. so on the first run it also works through the backlog you already have.

the trigram index is why partial words work. `nutsmp` finds `donutsmp.net`, and a word the OCR got slightly wrong is still findable from the parts it got right.

### OCR

[PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) models (PP-OCRv6, det + rec) running on [ONNX Runtime](https://onnxruntime.ai) through the [`ort`](https://crates.io/crates/ort) crate. CPU only. i tried tesseract and [ocrs](https://github.com/robertknight/ocrs) first on my own screenshots and both dropped exactly the small UI text you'd want to search for, numbers are in [notes.md](notes.md).

### the window

[gpui](https://gpui.rs), the ui framework zed is built on. gpu drawn, and it renders through wgpu, so it runs on vulkan, or on plain opengl if that's all an old laptop has.

## building

needs rust 1.95, rustup picks it up from `rust-toolchain.toml` on its own.

```sh
cargo build --release

# search the index from a terminal
./target/release/gyotaku search invoice march
./target/release/gyotaku stats

# the search window
./target/release/gyotaku-app
```

## layout

```
crates/core   the index: sqlite schema, inserting OCR output, search
crates/cli    the `gyotaku` command
crates/app    the search window (gpui)
```

## license

GPL-3.0-or-later
