# performance

what gyotaku costs your machine. every number here was measured, none are estimates.

measured on an i7-14700HX laptop (28 threads) with an RTX 4060, on Fedora 43. "no gpu" means every gpu driver hidden so it draws with Mesa's software renderer, the way a machine without one would. "4 cores" or "2 cores" means the process pinned to that many with `taskset`.

- [the search window](#the-search-window)
- [reading screenshots](#reading-screenshots)
- [searching](#searching)
- [disk](#disk)
- [measuring it yourself](#measuring-it-yourself)

## the search window

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

empty cells weren't measured.

it only draws when something changes, so sitting open and idle costs nothing in any of these. after the first launch the process stays running hidden, which is why later launches take ~120 ms instead of half a second: most of a cold start is the gpu driver waking up.

## reading screenshots

25 real screenshots, the process pinned to n cores:

| cores | 1 | 2 | 4 |
|---|---|---|---|
| time per screenshot | 1.32 s | 1.21 s | 0.67 s |
| peak memory | 278 MB | 311 MB | 289 MB |

- from a screenshot being saved to it being searchable: 0.77 s.
- between screenshots the background reader sits at about 60 MB.
- it runs at idle cpu and io priority, so anything else you do comes first.
- on battery it slows its way through an old backlog to one screenshot every few seconds. new ones are still read straight away.
- the systemd service caps it at 400 MB.
- a library of 5,159 screenshots took 43 minutes to read on 6 threads, with 0 failures.

how well it reads: on 25 random screenshots, it finds 99.5% of the words the bigger OCR models find with paddle's own settings, with a detector 4.6x faster. [how it works](how-it-works.md#reading-the-text) has the details.

## searching

1 to 10 ms per keystroke over 5,000+ screenshots. that's the time for the tiles actually on screen, since the matching lines are only fetched for tiles you can see.

## disk

| | |
|---|---|
| the text index | ~4.6 MB per 1,000 screenshots |
| grid thumbnails | ~23 MB per 1,000 (24 KB each, safe to delete, redrawn as needed) |
| OCR models | 22 MB, once |
| ONNX Runtime | 24 MB, once (Microsoft's own build, fetched on first use) |
| the two programs | 8 MB and 34 MB |

## measuring it yourself

`GYOTAKU_FRAME_STATS=1 gyotaku-app --once` prints frame timings when the window closes. `gyotaku ocr some.png` prints how long reading one screenshot took. numbers from other machines, especially integrated gpus and small laptops, are very welcome in an issue.
