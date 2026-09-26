# Contributing to gyotaku

Thank you for your interest in contributing. gyotaku runs continuously in the background on users' machines, so every change is evaluated not only on whether it works, but on whether it remains fast, resource-efficient and safe on hardware the author has never seen.

First-time contributors are welcome. If you are unsure about any part of this process, say so in your issue or pull request and a maintainer will help.

## Table of contents

- [Before you start](#before-you-start)
- [Development setup](#development-setup)
- [Project structure](#project-structure)
- [Engineering standards](#engineering-standards)
- [Documentation style](#documentation-style)
- [Design guidelines](#design-guidelines)
- [Pull requests](#pull-requests)
- [Reporting bugs](#reporting-bugs)
- [Code of conduct](#code-of-conduct)

## Before you start

- **Small, self-evident fixes** (typos, obvious bugs) can be submitted directly as a pull request.
- **New features, OCR changes, or changes to the index format** should start with an issue describing the proposed approach, so that design questions are settled before implementation.
- **Existing issues:** comment on the issue before starting work to avoid duplicated effort. You do not need to wait for a reply.
- **Finding something to work on:** issues labeled [`good first issue`](https://github.com/xevrion/gyotaku/labels/good%20first%20issue) and [`help wanted`](https://github.com/xevrion/gyotaku/labels/help%20wanted) are open for contribution. Planned ideas are listed under "to try later" in the [development log](notes.md#to-try-later). Testing on unverified configurations (see [Compatibility](docs/compatibility.md)) is equally valuable.

### Labels

| Label | Meaning |
|---|---|
| `area:core`, `area:ocr`, `area:cli`, `area:app` | The crate an issue concerns |
| `bug`, `enhancement`, `performance`, `ocr-accuracy` | The type of issue |
| `compatibility` | Behavior on a specific distribution, desktop, GPU or CPU |
| `triage`, `needs-repro` | Requires more information before work can begin |
| `discussion` | The approach is not yet agreed; comment before implementing |

## Development setup

### Prerequisites

- The build dependencies from [step 1 of the installation guide](README.md#1-install-build-dependencies).
- Rust, installed with [rustup](https://rustup.rs). The version is pinned in `rust-toolchain.toml` and installed automatically on first build.
- About 2 GB of free disk space. A debug build of the workspace occupies about 1.6 GB in `target/`, mostly GPUI and wgpu. Dependencies are compiled with optimizations and without debug info to keep this size bounded.

### Getting the source

Fork the repository on GitHub, then:

```sh
git clone https://github.com/YOUR-USERNAME/gyotaku.git
cd gyotaku
git remote add upstream https://github.com/xevrion/gyotaku.git
git checkout -b your-branch-name
```

### Common commands

| Command | Description |
|---|---|
| `cargo run -p gyotaku-app -- --once` | Run the search window from source |
| `cargo run -p gyotaku -- ocr <image>` | Extract and print the text of one image |
| `cargo run -p gyotaku -- search <words>` | Query the index |
| `cargo test --workspace` | Run all tests |
| `cargo clippy --workspace -- -D warnings` | Lint; warnings are errors |
| `cargo fmt --all` | Format |

Always pass `--once` when running the window from source. Without it, if an installed copy of gyotaku is resident, the new process signals the installed one to show its window and exits, and the code under development never runs.

Useful environment variables during development:

| Variable | Effect |
|---|---|
| `RUST_LOG=warn` | Show warnings from GPUI and the GPU layer |
| `GYOTAKU_FRAME_STATS=1` | Print frame timing statistics when the window closes |
| `GYOTAKU_THEME=light\|dark` | Force a theme |

The first OCR run downloads the models and ONNX Runtime to `~/.local/share/gyotaku`. This location is shared with any installed copy.

### Git hooks

The repository provides optional git hooks that mirror CI. Enable them once per clone:

```sh
git config core.hooksPath .githooks
```

| Hook | Checks |
|---|---|
| `pre-commit` | `cargo fmt --check` |
| `pre-push` | Formatting, `clippy -D warnings`, and the test suite, matching CI's `check` job |

The distribution builds run only in CI. A hook can be bypassed with `--no-verify`, but CI will still enforce the same checks.

## Project structure

| Path | Contents |
|---|---|
| `crates/core` | Index (SQLite FTS5, trigram tokenizer), configuration, thumbnail crop rules. No UI or OCR dependencies. |
| `crates/ocr` | PP-OCRv6 on ONNX Runtime: detection, recognition, decoding, model download |
| `crates/cli` | The `gyotaku` binary: `index`, `watch`, `search`, `stats`, `ocr` |
| `crates/app` | The `gyotaku-app` binary: search window, onboarding and settings, built on GPUI |
| `contrib/` | systemd user unit for manual installation |
| `tests/fixtures/` | Test images; CI reads one on every supported distribution |

The [architecture overview](docs/architecture.md) explains how the components work and why. The [development log](notes.md) records measurements, rejected approaches and past bugs. Read the relevant section before changing image loading, animation timing, or OCR input sizing; each has a documented failure mode.

## Engineering standards

### Measured claims

Every figure in the README and documentation is measured on real hardware.

- Changes that affect speed or memory must include before and after measurements in the pull request, along with the hardware they were taken on.
- Do not extrapolate figures to hardware that was not tested. "Not measured" is an acceptable entry.
- If a change invalidates a documented figure, re-measure it or remove it.

### Safety on user machines

- **Fail gracefully.** A missing GPU, missing systemd, no network, an older glibc, an invalid configuration file or an extremely large image must never crash the application or destabilize the system.
- **Bound resource usage.** Background work runs at idle priority. Anything that scales with library size requires a limit.
- **Never modify user files.** gyotaku must not write to, move or delete screenshots.
- **No network access** beyond the one-time, checksum-verified download of the models and runtime.
- **Remain platform-neutral.** No code path or user-facing text may assume a particular desktop environment, compositor, distribution or GPU vendor.

### Code

- Code must pass `cargo fmt` and `cargo clippy -- -D warnings`.
- Comments explain intent and constraints (why), not mechanics (what).
- Avoid allocation on hot paths such as frame rendering and per-keystroke search.

## Documentation style

- Write in clear, neutral, professional English. Use sentence case for headings.
- Describe behavior from the user's perspective.
- Do not use em dashes or Unicode arrows.
- Prefer tables for reference material and numbered steps for procedures.

## Design guidelines

- Screenshots provide the color. Interface chrome is neutral: off-white or near-black, set in IBM Plex Sans.
- A single accent color (vermilion) is reserved for search matches. Selection uses the foreground color.
- Motion occurs only in response to user input, and every animation is interruptible.
- Under software rendering, animations are replaced by short fades.
- Animations advance by elapsed time, never by a fixed step per frame.

Include a screenshot or screen recording with any pull request that changes the interface.

## Pull requests

- Limit each pull request to one logical change. Report unrelated issues separately.
- Describe what the change does and why. Include before and after behavior where relevant.
- Before submitting, run `cargo fmt --all`, `cargo clippy --workspace -- -D warnings` and `cargo test --workspace`.
- If the change adds a system package dependency, update both the installation steps in the README and `.github/workflows/ci.yml`.

### Title format

Pull requests are squash-merged, so the title becomes the commit message on `main`. A CI check enforces the [Conventional Commits](https://www.conventionalcommits.org) format. Allowed types:

`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Scopes are optional. Examples:

```
fix: close the window on the first Escape press
fix(ocr): skip images smaller than 16 pixels
```

Use lowercase after the type and omit the trailing period.

### Continuous integration

For first-time contributors, workflows require maintainer approval before they run. This is a GitHub policy for pull requests from forks. After the first merged pull request, they run automatically.

Jobs run only when the change requires them:

| Check | Description | Runs when |
|---|---|---|
| `fmt, clippy, tests` | Formatting, lints and tests on Ubuntu 24.04 | Rust code, tests, manifests or CI configuration change |
| Distribution builds | Clean builds on Ubuntu 22.04, Debian 12, Kali, Arch Linux, Fedora and openSUSE, each followed by OCR of a real screenshot | Dependencies (`Cargo.toml`, `Cargo.lock`), the toolchain or CI configuration change; weekly; on manual dispatch |
| `ci result` | Summary of the jobs above. Skipped jobs count as passing. | Always |
| `CodeQL` | Static security analysis of the Rust code and the workflows | Rust code or workflows change; weekly |
| `semantic` | Pull request title format | Every pull request |

`ci result` and `semantic` are required for merging. A documentation-only change runs neither build.

Maintainers can trigger the distribution builds manually from the [Actions tab](https://github.com/xevrion/gyotaku/actions/workflows/ci.yml) (Run workflow), for example before a release.

When addressing review feedback, push additional commits rather than force-pushing. The squash merge combines them, and separate commits let reviewers see what changed.

## Reporting bugs

Use the [bug report template](https://github.com/xevrion/gyotaku/issues/new?template=bug_report.yml). Include the distribution, desktop environment, GPU, and the output of `RUST_LOG=warn gyotaku-app --once`. For recognition problems, include the output of `gyotaku ocr` for the affected image, and the image itself if it contains no private information.

Report security vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
