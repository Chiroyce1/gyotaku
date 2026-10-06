//! Saving images that only ever went to the clipboard. The reader watches
//! the clipboard (see the cli's `clipboard` module) and writes each new image
//! into a folder of its own, where it's read like any other screenshot. What
//! lives here is shared with the window: naming the files, and telling the
//! reader which image the window itself just copied, so copying a screenshot
//! out of gyotaku doesn't save a second copy of it.

use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// How long a copy made by the window is remembered. The reader looks at the
/// clipboard within a second or two, unless the machine is very busy.
const OWN_COPY_FOR: Duration = Duration::from_secs(60);

fn own_copy_path() -> Option<PathBuf> {
    crate::data_dir().ok().map(|d| d.join("clipboard.own"))
}

/// Called by the window right before it puts this screenshot on the
/// clipboard. Failing only means the reader may save it once more.
pub fn mark_own_copy(path: &Path) {
    if let Some(marker) = own_copy_path() {
        let _ = std::fs::write(marker, path.as_os_str().as_encoded_bytes());
    }
}

/// The screenshot the window copied in the last minute, if it did.
pub fn own_copy() -> Option<PathBuf> {
    let marker = own_copy_path()?;
    let age = std::fs::metadata(&marker)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| SystemTime::now().duration_since(t).ok())?;
    if age > OWN_COPY_FOR {
        return None;
    }
    let bytes = std::fs::read(marker).ok()?;
    Some(PathBuf::from(String::from_utf8(bytes).ok()?))
}

/// `Clipboard 2026-10-06 14.03.22.png`, the way screenshot tools name theirs,
/// with ` (2)` and up when two land in the same second.
pub fn file_name(at: jiff::civil::DateTime, taken: impl Fn(&str) -> bool) -> String {
    let stem = at.strftime("Clipboard %Y-%m-%d %H.%M.%S").to_string();
    let first = format!("{stem}.png");
    if !taken(&first) {
        return first;
    }
    (2..)
        .map(|n| format!("{stem} ({n}).png"))
        .find(|name| !taken(name))
        .expect("some number is free")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_follow_the_time_and_never_collide() {
        let at = jiff::civil::date(2026, 10, 6).at(14, 3, 22, 0);
        assert_eq!(
            file_name(at, |_| false),
            "Clipboard 2026-10-06 14.03.22.png"
        );
        let taken = [
            "Clipboard 2026-10-06 14.03.22.png",
            "Clipboard 2026-10-06 14.03.22 (2).png",
        ];
        assert_eq!(
            file_name(at, |n| taken.contains(&n)),
            "Clipboard 2026-10-06 14.03.22 (3).png"
        );
    }
}
