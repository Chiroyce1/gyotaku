# how it works

```
a screenshot lands in a folder you picked
  gyotaku notices (inotify), at idle priority so you never feel it
  OCR reads every line of text and where it sits in the image
  the lines go into sqlite, full text search with a trigram index
  you hit a key, type a few letters, and the screenshot is right there
```

it doesn't take the screenshots itself. whatever tool you already use is fine, gyotaku watches the folder it saves to. the backlog you already have gets read newest first, since this week's stuff is what you're most likely to go looking for.

- [reading the text](#reading-the-text)
- [finding it](#finding-it)
- [the window](#the-window)
- [the code](#the-code)

## reading the text

the models are [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)'s PP-OCRv6 (tiny detector, small recognizer), running on [ONNX Runtime](https://onnxruntime.ai) through the [`ort`](https://crates.io/crates/ort) crate, all on the cpu. everything around them is written here: finding the text boxes in the detector's heat map, cutting each line out, batching them through the recognizer, and decoding what comes back.

ONNX Runtime is loaded at run time from Microsoft's official build instead of being linked in. the prebuilt one most rust projects link is built against a very new glibc, and CI showed it won't even link on Ubuntu 22.04 or Debian 12. Microsoft's needs glibc 2.27, so it runs on anything from Ubuntu 18.04 and Debian 10 on.

i tried tesseract and [ocrs](https://github.com/robertknight/ocrs) first on my own screenshots, and both dropped exactly the small UI text you'd want to search for (sidebar labels, buttons, tab names). paddle read nearly all of it. then it got tuned for screenshots rather than photos of paper:

| | paddle's default | gyotaku | why |
|---|---|---|---|
| detector | small | tiny | 4.6x faster, kept 99.6% of the words |
| detection size | upscale to 736 px, never shrink | only shrink, to ~1 MP | screen text is already a readable size, upscaling a small crop cost 330 MB for nothing |
| boxes | rotated rectangles | upright ones | screenshot text is upright, so plain connected components do the job |
| batches | 6 lines | by total width | the recognizer scores 18k characters per step, and that output is what eats memory |

single character lines are dropped, because UI icons come back as one confident character: a bell reads as 白, a grid icon as 品, a hamburger menu as 三.

## finding it

one sqlite file, full text search with the trigram tokenizer. that's why partial words work: `nutsmp` finds `donutsmp.net`, and a word the OCR got slightly wrong is still findable from the parts it got right.

- there's one search row per screenshot, not per line, so `invoice march` matches when the words are on different lines. the box of every line lives in a normal table next to it.
- every term is quoted before it reaches sqlite, so typing `c++`, `NOT` or a stray `"` is searched as text instead of being a syntax error.
- terms under 3 characters can't be seen by a trigram index, so they fall back to a plain `LIKE` over the rows the other terms already narrowed down.
- the highlighted lines are fetched only for the tiles on screen. a two letter query can match 2,000 shots, and loading lines for all of them took 60 to 90 ms. for the ~30 visible tiles it's 1 to 10 ms.

## the window

[gpui](https://gpui.rs), the ui framework zed is built on, drawing through wgpu on vulkan or opengl. a few things that took some doing:

- **the ink press.** while you search, each thumbnail darkens and only the lines you matched stay lit, outlined in shu, the vermilion of a hanko seal. what you *selected* is always ink, what the search *found* is always shu.
- **springs.** opening a shot grows it out of its tile with a spring. springs can be interrupted, so escape halfway turns it around from wherever it is instead of snapping.
- **it stays running.** most of a cold start is the gpu driver waking up (300 to 800 ms), so after the first launch the process stays around hidden (37 MB) and the key just asks it to show the window over a unix socket. it opens exactly where you left it: same search, same selection, same shot open.
- **no gpu, calmer motion.** without a gpu it notices, and swaps the flying tile and the ink press for short fades, since every animated frame drawn on the cpu costs real battery.
- **its own image loading.** gpui's image loader leaked about 9 MB per page of scrolling, so thumbnails are decoded on a background thread and handed to gpui ready to draw. memory now stays flat while paging.
- **the clipboard.** copying goes through `wl-copy` when it's there. a wayland clipboard dies with the app that set it, so without that, copy then escape then paste would paste nothing.

the design stays quiet on purpose: the screenshots are the colour, and the chrome around them is off white or near black, in IBM Plex Sans. nothing animates on its own, motion only ever answers something you did.

## the code

```
crates/core   the index, the config, search, thumbnail crop rules
crates/ocr    PP-OCRv6 on onnx runtime: detection, recognition, decoding
crates/cli    the `gyotaku` command: index, watch, search, ocr
crates/app    the search window, onboarding and settings (gpui)
contrib/      a systemd user unit, if you'd rather set it up by hand
```

[CONTRIBUTING.md](../CONTRIBUTING.md) has how to build and test it, and [notes.md](../notes.md) is the full build log: every measurement, what turned out wrong, and the bugs that cost the most time.
