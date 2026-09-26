# using gyotaku

- [searching](#searching)
- [keys](#keys)
- [the mouse](#the-mouse)
- [settings](#settings)
- [the background reader](#the-background-reader)
- [the command line](#the-command-line)
- [flags and environment variables](#flags-and-environment-variables)
- [where things live](#where-things-live)

## searching

press your key and start typing. results update on every keystroke.

- **partial words work.** `nutsmp` finds `donutsmp.net`, and `invoi` finds `invoice`. that also means a word the OCR got slightly wrong is still findable from the parts it got right.
- **every word has to match.** `invoice march` finds screenshots that have both words anywhere in them, not necessarily on the same line. add words to narrow it down.
- **case doesn't matter.**
- **symbols are fine.** `c++`, `NOT` or a stray `"` are searched as plain text, never as syntax.
- **one or two letter words work too.** the index is built from three letter pieces, so those are checked by reading through the text of the other matches instead.

while you type, every thumbnail darkens and the lines you matched stay lit, outlined in red, so you can see why each shot came up.

the best matches come first, and among equally good ones, the newest. with nothing typed, it shows your newest screenshots.

## keys

| key | in the grid | on an open shot |
|---|---|---|
| type | search | back to the grid, searching |
| arrows, page up, page down | move | left and right go to the next result |
| enter | open it | open the file in your image viewer |
| ctrl c | copy its text | copy the picked lines, or all of it |
| ctrl shift c | copy the image | same |
| ctrl o | open the file in your image viewer | same |
| ctrl shift o | show it in its folder | same |
| ctrl , | settings | |
| escape | clear the search, then close | back to the grid |

pressing the key you bound gyotaku to also closes it.

when you open gyotaku again, it's exactly where you left it: same search, same selection, same shot open.

## the mouse

- click a tile to open it.
- on an open shot, hover to see the lines it read, click one to copy it, or drag a box to copy every line it touches.

## settings

ctrl , opens them.

- **folders**: which folders gyotaku reads. add the ones your screenshot tool saves to. it won't take your whole home folder or `/`, pick the folders your screenshots are actually in.
- **theme**: system, light or dark.
- **background reading**: on or off. see [the background reader](#the-background-reader).
- **cores per screenshot**: how many cpu cores reading one screenshot may use. more is faster, fewer leaves more for everything else. it runs at idle priority either way.
- **thumbnail cache**: clear it to free disk. thumbnails are redrawn as you scroll.

settings are saved to `~/.config/gyotaku/config.toml`, which you can also edit by hand. the background reader picks up changes to the folder list without a restart.

## the background reader

`gyotaku watch` reads every screenshot in your folders, then keeps watching them and reads each new one as it lands (0.77 s from saved to searchable, on my laptop). renamed and moved files keep their text without being read again, and deleted ones drop out of the index.

it's careful with your machine:

- it runs at idle cpu and io priority, so anything else you do comes first.
- on battery, it slows down on an old backlog to one screenshot every few seconds. new screenshots are still read straight away.
- the systemd service caps it at 400 MB of memory.
- images bigger than about 64 megapixels, or smaller than 16 px on a side, are skipped.

turning on background reading in settings (or in the first launch) sets it up for you:

- **with systemd**: a user service at `~/.config/systemd/user/gyotaku-watch.service`, started now and at every login.
- **without systemd**: an autostart entry at `~/.config/autostart/gyotaku-watch.desktop`, which your desktop runs at login.

to set it up by hand instead, copy [`contrib/gyotaku-watch.service`](../contrib/gyotaku-watch.service) to `~/.config/systemd/user/` and run `systemctl --user enable --now gyotaku-watch`.

to check on it:

```sh
systemctl --user status gyotaku-watch      # is it running
journalctl --user -u gyotaku-watch -f      # what it's doing right now
gyotaku stats                              # how many screenshots are searchable
```

## the command line

```sh
gyotaku search invoice march      # paths of matching screenshots, plus the lines that matched
gyotaku search -n 50 invoice      # up to 50 results (default 20)
gyotaku stats                     # where things live, how many are indexed
gyotaku ocr some.png              # read one image and print its text, without indexing it
gyotaku ocr some.png --boxes      # also print where each line sits, and how sure the OCR is
gyotaku index [folders]           # read everything once, then exit
gyotaku watch [folders]           # read everything, then keep watching
```

without folders, `index` and `watch` use the ones from settings, and `watch` follows changes to them live. `index`, `watch` and `ocr` take `--threads n` to set how many cores reading may use.

`gyotaku --help` and `gyotaku <command> --help` list everything.

## flags and environment variables

| | |
|---|---|
| `gyotaku-app --window` | open as a normal window instead of floating over everything |
| `gyotaku-app --once` | quit when closed, instead of staying running hidden for a faster next open |
| `GYOTAKU_THEME=light` or `dark` | force a theme, overriding settings |
| `GYOTAKU_FRAME_STATS=1` | print frame timings when the window closes |
| `ORT_DYLIB_PATH=/path/to/libonnxruntime.so` | use your own ONNX Runtime instead of downloading one, see [compatibility](compatibility.md) |

## where things live

```
~/.config/gyotaku/config.toml       folders, theme, cores
~/.local/share/gyotaku/index.db     the text of every screenshot
~/.local/share/gyotaku/models/      the two OCR models
~/.local/share/gyotaku/runtime/     ONNX Runtime
~/.cache/gyotaku/thumbs/            grid thumbnails, safe to delete
```

gyotaku never changes, moves or deletes your screenshots.
