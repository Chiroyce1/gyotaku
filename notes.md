# notes

learning log for gyotaku. messy on purpose.

### the core trick

a screenshot is a picture, so you can't search it. OCR once, keep every line of text plus the box it came from, put the text in a full text index. then search is a sqlite query and the boxes let the ui point at exactly where the word is in the image.

### OCR bakeoff (2026-09-26)

four of my own screenshots from ~/Pictures (a github PR page, a youtube shorts page at 2568x1428, two others). CPU only, this laptop has 28 threads.

| engine | time per shot | peak memory | how it read them |
|---|---|---|---|
| tesseract 5.5 | 0.4 to 0.9s | 40 to 75 MB | missed every small sidebar label (Home, Shorts, Like, Share), plus junk lines like `EERE` |
| ocrs 0.13 (pure rust) | about 0.4s | about 240 MB | fast but garbled: `Later inlthis video`, `Makina`, `Shar`, `emi` |
| PaddleOCR PP-OCRv6 small, onnx (via RapidOCR, python) | 2 to 3.4s | about 640 MB | read nearly everything, including the url bar and the tiny labels |

paddle wins. search is useless if it misses words, and speed doesn't matter much for something running in the background at idle priority. the 640 MB is the python process with onnxruntime loaded, the rust version has to be measured on its own.

### assumption that was wrong

i assumed OCR time would scale with cores, so a 4 core laptop would be several times slower than this one. pinned to 4 cores with `taskset`: same 2 to 3s. pinned to 2 cores: still the same. so it's not CPU bound the way i thought, something serial dominates, probably the per line recognition calls plus python post processing. good news for weak laptops, and it means batching the recognition step in the rust version is probably the big win. need to profile, not guess.

### stuff found in my own screenshot folder

- 4476 pngs loose in ~/Pictures (1.1G) plus 648 in ~/Pictures/Screenshots where niri saves. the backlog is the real test set.
- `2026-07-06_12-06-09.png` is a 1x2 pixel png. degenerate images exist in the wild, the indexer has to shrug and move on, not crash.
- bursts: sometimes 8 shots inside 2 minutes of the same page. dedup (or at least grouping) is going to matter in the ui.

### why sqlite fts5 with trigram

- one file, no server, sits in `~/.local/share/gyotaku/index.db`.
- trigram tokenizer indexes every 3 char window, so substrings match (`nutsmp` finds `donutsmp.net`) and OCR typos are forgiving.
- catch: anything shorter than 3 chars can't use the index. those terms fall back to `LIKE`, which is a scan but a scan over a few thousand rows is nothing.
- one fts row per screenshot, not per line, so `invoice march` matches when the words are on different lines. the per line boxes live in a normal table.
- every term gets quoted before it goes into MATCH, otherwise typing `c++` or `NOT` or a stray `"` is a syntax error. there's a test that throws junk at it.

### why gpui, and why from git

- rust end to end, gpu drawn, runs on mac and windows later.
- the 0.2.2 release on crates.io renders through blade, vulkan only. zed main switched to wgpu with vulkan and GL backends, so an old integrated gpu without vulkan still gets a window. pinned to a main commit since the api still moves.
- gpui animations are duration + easing only. no springs. the plan is a tiny critically damped spring driven per frame, which gives interruptible motion (grab it mid flight and it follows from where it is, not from the target).
- tauri was out: webkitgtk on nvidia has already bitten me (modrinth needed `__NV_DISABLE_EXPLICIT_SYNC=1`), and a webview costs 150 MB before doing anything.

### design direction (not settled)

the screenshots are the colour, the chrome around them stays quiet and light. the one memorable move should come from the name: when you search, the matching words get pressed onto the thumbnail like ink coming through paper. nothing else animates on its own, motion only answers what i did.

### next

- [ ] OCR in rust: load the det + rec onnx models with `ort`, DB post processing for boxes, CTC decoding for text. learn how both actually work first
- [ ] `gyotaku index <dir>` to backfill, then `gyotaku watch` with inotify at SCHED_IDLE
- [ ] thumbnails cached at index time so the grid never decodes a 4MB png
- [ ] the search window: input, live results, highlighted boxes
- [ ] a spring for gpui
- [ ] select text directly on the image
