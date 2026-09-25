mod index;

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use sha2::{Digest, Sha256};

pub use index::{Hit, Index};

/// A box in normalized image coordinates, so the same numbers work on a
/// 240px thumbnail and on the full size view.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

/// One line of text the OCR found, and where it found it.
#[derive(Debug, Clone, PartialEq)]
pub struct Line {
    pub text: String,
    pub rect: Rect,
    pub score: f32,
}

#[derive(Debug, Clone)]
pub struct Shot {
    pub path: PathBuf,
    /// Seconds since the epoch. Doubles as the "taken at" time and as the
    /// cheap check for whether a file changed since we indexed it.
    pub mtime: i64,
    /// 0 x 0 for files that couldn't be read or are too small to be a real
    /// screenshot. They stay in the index so they aren't retried every run,
    /// but search never returns them.
    pub width: u32,
    pub height: u32,
}

fn dirs() -> Result<directories::ProjectDirs> {
    directories::ProjectDirs::from("", "", "gyotaku").context("could not work out a home directory")
}

pub fn data_dir() -> Result<PathBuf> {
    Ok(dirs()?.data_dir().to_path_buf())
}

/// Where the grid thumbnail for a screenshot lives. Named after the path, not
/// the row id, so re-indexing a changed file overwrites its old thumbnail
/// instead of leaving it behind.
pub fn thumb_path(shot: &Path) -> Result<PathBuf> {
    let digest = Sha256::digest(shot.as_os_str().as_encoded_bytes());
    let name: String = digest[..12].iter().map(|b| format!("{b:02x}")).collect();
    Ok(dirs()?
        .cache_dir()
        .join("thumbs")
        .join(format!("{name}.jpg")))
}
