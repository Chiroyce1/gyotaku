# Security

gyotaku reads every screenshot you point it at, and screenshots hold passwords, messages, bank pages and everything else that crosses a screen. So its text index is sensitive, and we treat problems that could expose it, or that could run code, seriously.

What it does, so you can judge the surface:

- It reads image files from the folders you choose, and decodes them. A crafted image is the most likely way in.
- It stores the text it reads in `~/.local/share/gyotaku/index.db`, and thumbnails in `~/.cache/gyotaku/`, both under your home folder.
- It downloads two OCR models from ModelScope and ONNX Runtime from Microsoft's GitHub releases, once, and checks each against a sha256 pinned in the source before using it.
- The search window listens on a unix socket (`$XDG_RUNTIME_DIR/gyotaku.sock`), so pressing the key can wake the window that's already running. Other users can't connect to it.
- It sends nothing anywhere. No telemetry, no accounts, no update checks.

If you find something that could harm a user, for example an image that crashes the reader in a way that looks exploitable, a way for another user or a website to read the index, or a way around the checksum on the download, please report it privately rather than opening a public issue.

Use GitHub's [private vulnerability reporting](https://github.com/xevrion/gyotaku/security/advisories/new) on this repository. You should get a response within a week.

When you report, please don't attach screenshots that contain your own private information. A minimal crafted file is better.

Please don't report findings from automated scanners without checking that they're real and reachable in gyotaku.
