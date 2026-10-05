//! The parts of onboarding and settings that aren't drawing and don't depend
//! on the system: which folders to offer, counting what's in them, and where
//! the command line tool is. Starting the reader is in `platform`.

use std::path::{Path, PathBuf};

use crate::platform;

const IMAGE_EXTENSIONS: [&str; 4] = ["png", "jpg", "jpeg", "webp"];

#[derive(Debug, Clone, PartialEq)]
pub struct Candidate {
    pub path: PathBuf,
    /// Why it's suggested, shown next to it.
    pub why: String,
    /// Set when a screenshot tool is configured to save here, which is the
    /// strongest hint there is.
    pub tool: bool,
}

/// Folders worth offering, most specific first: wherever an installed
/// screenshot tool is set to save, then the usual defaults. Only ones that
/// exist, and each only once.
pub fn candidates() -> Vec<Candidate> {
    let home = match directories::BaseDirs::new() {
        Some(d) => d.home_dir().to_path_buf(),
        None => return Vec::new(),
    };

    let mut found = Vec::new();
    let mut add = |path: PathBuf, why: &str, tool: bool| {
        if path.is_dir() && !found.iter().any(|c: &Candidate| c.path == path) {
            found.push(Candidate {
                path,
                why: why.into(),
                tool,
            });
        }
    };

    // The tools are all described the same way on screen, the person knows
    // which one they use.
    for folder in platform::tool_folders(&home) {
        add(folder, "your screenshot tool saves here", true);
    }
    let pictures = gyotaku_core::pictures_dir();
    if let Some(pictures) = pictures {
        add(
            pictures.join("Screenshots"),
            platform::WORDS.default_folder,
            false,
        );
        add(pictures, "your pictures folder", false);
    }
    let desktop = directories::UserDirs::new()
        .and_then(|d| d.desktop_dir().map(Path::to_path_buf))
        .unwrap_or_else(|| home.join("Desktop"));
    add(desktop, "your desktop", false);
    found
}

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Counts {
    pub images: usize,
    /// Images whose names look like a screenshot tool made them.
    pub screenshots: usize,
}

/// Images under a folder, counted up to `cap` so a huge photo library
/// doesn't hold the answer up.
pub fn count_images(dir: &Path, cap: usize) -> Counts {
    let mut counts = Counts::default();
    let mut stack = vec![dir.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            match entry.file_type() {
                Ok(t) if t.is_dir() && !name.starts_with('.') => stack.push(path),
                Ok(t) if t.is_file() && is_image(&path) => {
                    counts.images += 1;
                    counts.screenshots += looks_like_a_screenshot(&name) as usize;
                    if counts.images >= cap {
                        return counts;
                    }
                }
                _ => {}
            }
        }
    }
    counts
}

/// Screenshot tools name files after what they are or when they were taken:
/// `Screenshot from 2025-10-01 15-48-28.png`, `2026-06-07_19-06-02.png`,
/// `shot_1779298058.png`. Photos from a camera or a download rarely look
/// like either.
pub fn looks_like_a_screenshot(name: &str) -> bool {
    let lower = name.to_lowercase();
    if ["screenshot", "screen shot", "shot", "capture", "grim"]
        .iter()
        .any(|w| lower.contains(w))
    {
        return true;
    }
    // a yyyy-mm-dd (or yyyy_mm_dd) date anywhere in the name
    let b = lower.as_bytes();
    b.windows(10).any(|w| {
        let digits = |r: std::ops::Range<usize>| w[r].iter().all(u8::is_ascii_digit);
        digits(0..4) && digits(5..7) && digits(8..10) && matches!(w[4], b'-' | b'_') && w[4] == w[7]
    })
}

fn is_image(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| IMAGE_EXTENSIONS.iter().any(|x| e.eq_ignore_ascii_case(x)))
}

/// Drops folders that sit inside another picked folder, since the outer one
/// already covers them.
pub fn without_nested(mut folders: Vec<PathBuf>) -> Vec<PathBuf> {
    folders.sort();
    folders.dedup();
    let all = folders.clone();
    folders.retain(|f| !all.iter().any(|o| o != f && f.starts_with(o)));
    folders
}

/// Total size of the files in a folder, not following links.
pub fn folder_size(dir: &Path) -> u64 {
    let mut total = 0;
    let mut stack = vec![dir.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            match entry.metadata() {
                Ok(m) if m.is_dir() => stack.push(entry.path()),
                Ok(m) => total += m.len(),
                Err(_) => {}
            }
        }
    }
    total
}

/// The command line tool, installed next to this program by the installers,
/// `cargo install` and packages alike. Pointing at it directly beats hoping
/// it's on the PATH of whatever starts it.
pub fn cli_path() -> String {
    std::env::current_exe()
        .ok()
        .map(|exe| exe.with_file_name(format!("gyotaku{}", std::env::consts::EXE_SUFFIX)))
        .filter(|cli| cli.exists())
        .map_or_else(|| "gyotaku".into(), |cli| cli.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nested_folders_are_covered_by_their_parent() {
        let folders = vec![
            PathBuf::from("/p/Screenshots"),
            PathBuf::from("/p"),
            PathBuf::from("/q"),
            PathBuf::from("/p"),
            PathBuf::from("/pq"),
        ];
        assert_eq!(
            without_nested(folders),
            [PathBuf::from("/p"), "/pq".into(), "/q".into()]
        );
    }

    #[test]
    fn counting_stops_at_the_cap_and_skips_hidden() {
        let dir = std::env::temp_dir().join(format!("gyotaku-count-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::create_dir_all(dir.join(".hidden")).unwrap();
        for name in [
            "a.png",
            "Screenshot 1.JPG",
            "sub/2026-01-02.webp",
            ".hidden/d.png",
            "notes.txt",
        ] {
            std::fs::write(dir.join(name), b"").unwrap();
        }
        assert_eq!(
            count_images(&dir, 100),
            Counts {
                images: 3,
                screenshots: 2
            }
        );
        assert_eq!(count_images(&dir, 2).images, 2);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn screenshot_names() {
        for name in [
            "Screenshot from 2025-10-01 15-48-28.png",
            "2026-06-07_19-06-02.png",
            "shot_1779298058.png",
            "utsushot_1786555075.png",
            "2026_01_02 thing.png",
        ] {
            assert!(looks_like_a_screenshot(name), "{name}");
        }
        for name in [
            "IMG_4032.jpg",
            "cookmarked.png",
            "99adebae-fa8d-441f-9606.jpeg",
            "2026-0102.png",
        ] {
            assert!(!looks_like_a_screenshot(name), "{name}");
        }
    }
}
