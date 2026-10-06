use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, UNIX_EPOCH};

use anyhow::{Context, Result};
use fast_image_resize::{FilterType, ResizeAlg, ResizeOptions, Resizer};
use gyotaku_core::{Index, Script, Shot};

use crate::platform;
use gyotaku_ocr::Ocr;
use image::RgbImage;
use image::codecs::jpeg::JpegEncoder;

// Grid thumbnails. 480 wide is sharp in a ~240 px cell on a 2x screen, and at
// this quality one lands around 20 to 40 KB, so a 5000 shot library is a
// couple hundred MB of cache rather than a gigabyte.
const THUMB_WIDTH: u32 = 480;
const THUMB_QUALITY: u8 = 78;

// Below this it's an icon, a 1x2 test png, or a slip of the mouse.
const MIN_SIDE: u32 = 16;

const EXTENSIONS: [&str; 4] = ["png", "jpg", "jpeg", "webp"];

pub enum Outcome {
    Unchanged,
    Thumbnail,
    Indexed {
        lines: usize,
        took: Duration,
    },
    Hidden(String),
    /// Couldn't be read, but it was written moments ago and may still be
    /// mid-write, so it's left to try again rather than written off.
    NotYet,
}

// A file that fails to load within this long of being written is treated as
// still being written. Browsers, for one, save as an empty file and then
// rename the real one over it within the same second, and an mtime with only
// seconds in it can't tell the two apart afterwards.
const STILL_WRITING: Duration = Duration::from_secs(10);

pub struct Indexer {
    pub index: Index,
    ocr: Ocr,
}

impl Indexer {
    pub fn new(threads: usize, scripts: &[Script]) -> Result<Self> {
        Ok(Self {
            index: Index::open_default()?,
            ocr: Ocr::new(threads, scripts)?,
        })
    }

    /// A new reader for changed settings. On an error (a script's model that
    /// can't be downloaded right now) the old one stays.
    pub fn set_reader(&mut self, threads: usize, scripts: &[Script]) -> Result<()> {
        self.ocr = Ocr::new(threads, scripts)?;
        Ok(())
    }

    /// Whether reading this file would do anything: it's new or changed, or
    /// its thumbnail went missing. Cheap (a stat and a lookup), so a library
    /// can be sorted into what needs work before any of it starts.
    pub fn needs_reading(&self, path: &Path) -> bool {
        let Ok(mtime) = mtime(path) else {
            return false;
        };
        if !self.index.is_current(path, mtime).unwrap_or(false) {
            return true;
        }
        let thumb_missing = gyotaku_core::thumb_path(path).is_ok_and(|t| !t.exists());
        thumb_missing && self.index.is_visible(path).unwrap_or(false)
    }

    pub fn index_file(&mut self, path: &Path) -> Result<Outcome> {
        if fs::metadata(path).is_ok_and(|m| platform::only_in_the_cloud(&m)) {
            return Ok(Outcome::Unchanged);
        }
        let mtime = mtime(path)?;
        if self.index.is_current(path, mtime)? {
            // The thumbnail cache can be wiped (or its format change) without
            // the text going stale, and redrawing one is ~50 ms against ~600
            // for OCR, so only the thumbnail gets redone.
            let thumb = gyotaku_core::thumb_path(path)?;
            if !thumb.exists() && self.index.is_visible(path)? {
                write_thumbnail(&gyotaku_ocr::load_image(path)?, &thumb)?;
                platform::release_memory();
                return Ok(Outcome::Thumbnail);
            }
            return Ok(Outcome::Unchanged);
        }

        // A file that can't even be opened (a capture tool or a virus
        // scanner still holding it) says nothing about the image, so it's
        // left to try again rather than written off as unreadable.
        if let Err(e) = fs::File::open(path) {
            return Err(e).with_context(|| format!("can't open {}", path.display()));
        }
        let t = Instant::now();
        let img = match gyotaku_ocr::load_image(path) {
            Ok(img) => img,
            Err(_) if written_recently(path) => return Ok(Outcome::NotYet),
            Err(e) => return self.hide(path, mtime, format!("{e:#}")),
        };
        if img.width() < MIN_SIDE || img.height() < MIN_SIDE {
            return self.hide(
                path,
                mtime,
                format!("{}x{} is too small", img.width(), img.height()),
            );
        }

        let lines = self.ocr.read(&img)?;
        write_thumbnail(&img, &gyotaku_core::thumb_path(path)?)?;
        let shot = Shot {
            path: path.to_owned(),
            mtime,
            width: img.width(),
            height: img.height(),
        };
        self.index.insert(&shot, &lines)?;

        drop(img);
        platform::release_memory();
        Ok(Outcome::Indexed {
            lines: lines.len(),
            took: t.elapsed(),
        })
    }

    /// Recorded as 0x0, so it's skipped next time but never shown.
    fn hide(&mut self, path: &Path, mtime: i64, why: String) -> Result<Outcome> {
        let shot = Shot {
            path: path.to_owned(),
            mtime,
            width: 0,
            height: 0,
        };
        self.index.insert(&shot, &[])?;
        Ok(Outcome::Hidden(why))
    }

    pub fn rename(&mut self, from: &Path, to: &Path) -> Result<bool> {
        if !self.index.rename(from, to)? {
            return Ok(false);
        }
        let (old, new) = (
            gyotaku_core::thumb_path(from)?,
            gyotaku_core::thumb_path(to)?,
        );
        let _ = fs::rename(old, new);
        Ok(true)
    }

    pub fn forget(&mut self, path: &Path) -> Result<bool> {
        if let Ok(thumb) = gyotaku_core::thumb_path(path) {
            let _ = fs::remove_file(thumb);
        }
        self.index.remove(path)
    }
}

/// An image by its extension. A name that isn't valid UTF-8 is left out: the
/// index stores paths as text, so such a file could never be found again by
/// its stored path and would be read again on every start.
pub fn is_image(path: &Path) -> bool {
    path.to_str().is_some()
        && path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| EXTENSIONS.iter().any(|x| e.eq_ignore_ascii_case(x)))
}

fn written_recently(path: &Path) -> bool {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .is_ok_and(|t| t.elapsed().is_ok_and(|age| age < STILL_WRITING))
}

/// Every image under the given folders, newest first. Newest first because
/// the backfill of an existing library takes a while and the shots from this
/// week are the ones most likely to be searched for during it.
pub fn scan(dirs: &[PathBuf]) -> Vec<PathBuf> {
    // A set, since overlapping folders (~/Pictures and ~/Pictures/Screenshots)
    // would otherwise list the same file twice.
    let mut found = HashSet::new();
    let mut stack: Vec<PathBuf> = dirs.to_vec();
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let hidden = entry.file_name().to_string_lossy().starts_with('.');
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            // Symlinked files are followed, symlinked folders aren't, one
            // pointing back up the tree would never finish.
            let file = kind.is_file() || (kind.is_symlink() && path.is_file());
            if kind.is_dir() && !hidden {
                stack.push(path);
            } else if file
                && is_image(&path)
                && !entry
                    .metadata()
                    .is_ok_and(|m| platform::only_in_the_cloud(&m))
            {
                found.insert(path);
            }
        }
    }
    let mut found: Vec<(i64, PathBuf)> = found
        .into_iter()
        .map(|p| (mtime(&p).unwrap_or(0), p))
        .collect();
    found.sort_by(|a, b| b.cmp(a));
    found.into_iter().map(|(_, p)| p).collect()
}

fn mtime(path: &Path) -> Result<i64> {
    let modified = fs::metadata(path)?.modified()?;
    Ok(modified
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0))
}

/// Cut to exactly what the grid tile shows, see `gyotaku_core::tile_crop`.
fn write_thumbnail(img: &RgbImage, dest: &Path) -> Result<()> {
    let (iw, ih) = (img.width(), img.height());
    let crop = gyotaku_core::tile_crop(iw, ih);
    let (cw, ch) = (crop.w * iw as f32, crop.h * ih as f32);
    let w = THUMB_WIDTH.min(cw as u32).max(1);
    let h = ((w as f32 * ch / cw).round() as u32).max(1);

    let mut thumb = RgbImage::new(w, h);
    let opts = ResizeOptions::new()
        .resize_alg(ResizeAlg::Convolution(FilterType::Lanczos3))
        .crop(
            (crop.x * iw as f32) as f64,
            (crop.y * ih as f32) as f64,
            cw as f64,
            ch as f64,
        );
    Resizer::new().resize(img, &mut thumb, &opts)?;

    let dir = dest.parent().context("thumbnail path has no parent")?;
    fs::create_dir_all(dir)?;
    let tmp = dest.with_extension("tmp");
    let mut out = std::io::BufWriter::new(fs::File::create(&tmp)?);
    JpegEncoder::new_with_quality(&mut out, THUMB_QUALITY).encode_image(&thumb)?;
    drop(out);
    fs::rename(&tmp, dest)?;
    Ok(())
}
