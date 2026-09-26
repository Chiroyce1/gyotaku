# Contributing to gyotaku

Thanks for taking the time. gyotaku is meant to be the screenshot search you install once and forget about, so the bar for a change is not only "does it work" but "does it stay fast, small, and safe on someone else's machine".

Don't worry if you get any of the process below wrong, or if you haven't contributed to a project before. Say so and we'll help.

## Before you start

**Found something small and obvious?** Send the pull request. No ceremony needed.

**Want to add a feature, change the OCR, or touch the index format?** Open an issue first and describe the approach. It takes a few minutes and saves you writing something that then has to be rewritten.

**Want to work on an existing issue?** Comment on it so two people don't build the same thing. You don't have to wait for a reply before starting.

**Not sure what to work on?** The ["to try later" list in notes.md](notes.md#to-try-later) has the ideas that are wanted but not started. Testing on hardware nobody has tried yet is just as useful: GNOME, KDE, integrated gpus, ARM, and distros without systemd are all marked "not yet" in [compatibility](docs/compatibility.md).

## Getting set up

You need the build tools from [step 1 of the install](README.md#1-the-build-tools), and rust from [rustup](https://rustup.rs). The repo pins the rust version in `rust-toolchain.toml`, so rustup fetches the right one the first time you build.

Fork the repo on GitHub, then:

```sh
git clone https://github.com/YOUR-USERNAME/gyotaku.git
cd gyotaku
git remote add upstream https://github.com/xevrion/gyotaku.git
git checkout -b your-branch-name
```

A debug build of the whole workspace takes about 1.6 GB of disk in `target/`, mostly gpui and wgpu. Dependencies are built optimised and without debug info on purpose: with full debug info that folder once reached 18 GB.

Useful commands:

| Command | What it does |
|---|---|
| `cargo run -p gyotaku-app -- --once` | Run the search window from source |
| `cargo run -p gyotaku -- ocr some.png` | Read one image and print its text |
| `cargo run -p gyotaku -- search word` | Search the index |
| `cargo test --workspace` | Run the tests |
| `cargo clippy --workspace -- -D warnings` | Lint, warnings are errors |
| `cargo fmt --all` | Format |

Always pass `--once` when running the window from source. Without it, if you also have gyotaku installed, the new process finds the installed one already running in the background, asks it to show its window, and exits, so you end up looking at the old code.

`RUST_LOG=warn` shows what gpui says about the window and the gpu. `GYOTAKU_FRAME_STATS=1` prints frame timings when the window closes. `GYOTAKU_THEME=light` or `dark` forces a theme.

The first OCR run downloads the models and ONNX Runtime into `~/.local/share/gyotaku`, the same place an installed gyotaku uses, so it's shared.

## How the project is laid out

```
crates/core   the index (sqlite, fts5 trigram), the config, thumbnail crop rules. no ui, no OCR
crates/ocr    PP-OCRv6 on ONNX Runtime: detection, recognition, decoding, model download
crates/cli    the `gyotaku` command: index, watch, search, stats, ocr
crates/app    the search window, onboarding and settings, on gpui
contrib/      a systemd user unit for people who set it up by hand
tests/        fixtures, currently one real screenshot CI reads on every distro
```

`core` and `ocr` know nothing about the window, which is what lets the command line and CI exercise them on machines with no display.

[docs/how-it-works.md](docs/how-it-works.md) explains the pieces and why they're built the way they are, and [notes.md](notes.md) is the build log, including the bugs that cost the most time. Read the relevant part of it before changing the image loading, the animation timing, or the OCR sizing: each of those has a trap that's already been fallen into once.

## Numbers must be measured

Every number in the README and the docs was measured on real hardware. Please keep it that way:

- If your change affects speed or memory, include before and after numbers in the pull request, and say what machine they're from.
- Never extrapolate a number to hardware you didn't run it on. "Not measured" is a fine thing to write.
- If a change makes a documented number wrong, update it with a new measurement, or remove it.

## Safe on anyone's machine

gyotaku runs in the background on people's laptops, so:

- Fail soft. A broken config, a missing gpu, no systemd, an old glibc, no network, or a 30,000 pixel wide image must never crash it or take the machine down with it.
- Keep background work at idle priority, and keep memory bounded. Anything that scales with the size of someone's library needs a cap.
- Never write to, move or delete a user's screenshots.
- Nothing leaves the machine. The only network use is the one-time, checksum-verified download of the models and the runtime, and it should stay that way.
- Keep it generic. No code path or piece of text should assume one desktop, distro, compositor or gpu vendor.

## Writing

Docs and UI text are casual and plain, the way the README reads.

- Say what something does for the person reading, not which function moved.
- No em dashes. Use a comma, a full stop, or a second sentence.
- No unicode arrows. Write "then".
- Code comments explain why, not what, and read like a person wrote them.

## Design constraints

The window follows a few rules, so it keeps feeling like one thing:

- The screenshots are the colour. The chrome around them stays quiet: off white or near black, IBM Plex Sans.
- One accent colour, shu (vermilion), and it only ever means "the search found this". Selection is always ink.
- Nothing animates on its own. Motion only answers something the person did, and it has to be interruptible.
- Without a gpu, motion becomes short fades. Every animated frame on the cpu costs battery.
- Animation steps by real elapsed time, never a fixed step per frame, or it crawls on slow machines.

For anything visible, include a screenshot or a short recording in the pull request.

## Pull requests

- One logical change per pull request. If you find an unrelated bug, open an issue for it.
- Say what the change does and why. If it changes behaviour, include before and after.
- Before opening, run `cargo fmt --all`, `cargo clippy --workspace -- -D warnings` and `cargo test --workspace`.

### The title

Pull requests are squash-merged, so the title becomes the commit message on `main`, and a CI check enforces its shape. Start it with one of:

`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Scopes are optional: `fix: escape closes the window on the first press` and `fix(ocr): skip images under 16 px` are both fine. Lowercase after the prefix, no full stop at the end. `git log` shows the house style.

### What happens after you open it

If it's your first pull request here, the checks wait until a maintainer approves them. That's GitHub's gate on pull requests from forks, not something you did wrong. After your first merged pull request they run automatically.

The checks are:

- **fmt, clippy, tests** on Ubuntu 24.04.
- **a clean build on six distros**: Ubuntu 22.04, Debian 12, Kali, Arch, Fedora and openSUSE, each from a fresh image with only the packages the README lists, then reading a real screenshot. If you add a system dependency, add it to the README's install step and to `.github/workflows/ci.yml` in the same pull request.
- **CodeQL**, a security scan.
- **semantic**, the pull request title.

If a review asks for changes, push follow-up commits instead of force-pushing. The squash-merge flattens them anyway, and it lets the reviewer see what changed since they last looked.

## Reporting bugs

Use the bug report template. The most useful things are your distro, your desktop, whether you have a gpu, and what `gyotaku-app --once` prints when run from a terminal (add `RUST_LOG=warn` for more). If a screenshot isn't found, the output of `gyotaku ocr` on it helps a lot, and the screenshot itself even more, if it has nothing private in it.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
