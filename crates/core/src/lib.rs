mod index;

use std::path::PathBuf;

use anyhow::{Context, Result};

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
    pub width: u32,
    pub height: u32,
}

pub fn data_dir() -> Result<PathBuf> {
    let dirs = directories::ProjectDirs::from("", "", "gyotaku")
        .context("could not work out a home directory")?;
    Ok(dirs.data_dir().to_path_buf())
}
