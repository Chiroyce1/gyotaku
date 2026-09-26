# Security policy

## Supported versions

gyotaku has not yet published versioned releases. Security fixes are applied to the `main` branch. Update by following the [update instructions](README.md#updating).

## Reporting a vulnerability

Report vulnerabilities privately through GitHub's [private vulnerability reporting](https://github.com/xevrion/gyotaku/security/advisories/new). Do not open a public issue.

You can expect an initial response within seven days. Once the issue is confirmed, a fix is prepared privately and published together with an advisory. Reporters are credited unless they prefer otherwise.

When reporting, provide a minimal reproduction, such as a crafted image file, rather than screenshots containing personal information.

Findings from automated scanners are accepted only when they have been confirmed to be real and reachable in gyotaku.

## Threat model

Screenshots routinely contain credentials, private messages, financial details and other sensitive information. gyotaku's text index is therefore treated as sensitive data. The following describes its attack surface.

| Component | Exposure |
|---|---|
| Image decoding | Reads and decodes image files from user-selected folders. A crafted image is the most likely attack vector. |
| Text index | Stored in `~/.local/share/gyotaku/index.db`, with thumbnails in `~/.cache/gyotaku/`, both within the user's home directory. |
| Model download | OCR models are downloaded from ModelScope and ONNX Runtime from Microsoft's GitHub releases, once. Each file is verified against a SHA-256 checksum pinned in the source before use. |
| Local IPC | The search window listens on a Unix socket at `$XDG_RUNTIME_DIR/gyotaku.sock` so that the shortcut can signal the resident process. Other users cannot connect to it. |
| Network | No other network access. No telemetry, accounts or update checks. |

### In scope

- Memory safety issues or code execution triggered by a crafted image.
- Any means by which another local user, another application, or a remote party can read the index or thumbnails.
- Bypassing the checksum verification of downloaded files.
- Any unintended network transmission of user data.

### Out of scope

- Attacks requiring an attacker who already runs code as the same user.
- Denial of service through images already rejected by the documented size limits.
