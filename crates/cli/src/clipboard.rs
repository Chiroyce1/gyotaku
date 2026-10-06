//! Saving images that only ever went to the clipboard, so they can be found
//! like any other screenshot. Off unless turned on in settings. The platform
//! module watches the clipboard and hands over each image put on it; this
//! decides whether it's worth keeping and writes it into the clipboard
//! folder, where the reader picks it up like anything else.
//!
//! Most of the work is not saving the same picture twice. The clipboard
//! announces the same image again after an app restarts, many screenshot
//! tools both save a file and copy it, and the window copies screenshots
//! that are already indexed.

use std::collections::VecDeque;
use std::hash::{Hash as _, Hasher as _};
use std::io::Read as _;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, mpsc};
use std::time::{Duration, Instant};

use anyhow::{Context as _, Result};
use image::RgbaImage;
use notify::{Event, EventKind};

use gyotaku_core::Config;

use crate::{indexer, platform};

/// Smaller than this either way is an icon or a colour swatch, nothing
/// anyone will search for.
const MIN_SIDE: u32 = 32;
/// A tool that saves and copies may write its file a moment after copying.
const TOOL_WRITES_WITHIN: Duration = Duration::from_secs(2);
/// Files that appeared this recently are compared with a copied image.
const FRESH_FOR: Duration = Duration::from_secs(30);
/// Copies already saved, by their pixels, newest last.
const REMEMBERED: usize = 32;
/// Decoding is capped so a giant image can't take the reader's memory with
/// it: 256 MB is an 8192 x 8192 picture.
const MAX_DECODE: u64 = 256 * 1024 * 1024;

pub struct Clipboard {
    shared: Arc<Shared>,
    found: mpsc::Sender<Vec<u8>>,
    watch: Option<platform::ClipboardWatch>,
}

#[derive(Default)]
struct Shared {
    /// Where copies go. None once saving is turned off, so whatever is still
    /// queued is dropped instead of saved.
    folder: Mutex<Option<PathBuf>>,
    /// Images that just appeared in the folders being read.
    fresh: Mutex<VecDeque<(PathBuf, Instant)>>,
}

/// The file watcher's view of new images, kept apart from the reader's own
/// loop, which can be busy reading a screenshot for seconds at a time.
#[derive(Clone)]
pub struct Fresh(Arc<Shared>);

impl Clipboard {
    pub fn new() -> Self {
        let shared = Arc::new(Shared::default());
        let (found, copies) = mpsc::channel::<Vec<u8>>();
        let mut saver = Saver {
            shared: shared.clone(),
            recent: VecDeque::new(),
            wait: TOOL_WRITES_WITHIN,
        };
        let _ = std::thread::Builder::new()
            .name("clipboard".into())
            .spawn(move || {
                for bytes in copies {
                    match saver.take(&bytes) {
                        Ok(Some(path)) => eprintln!("saved a copied image as {}", path.display()),
                        Ok(None) => {}
                        Err(e) => eprintln!("couldn't save a copied image: {e:#}"),
                    }
                }
            });
        Self {
            shared,
            found,
            watch: None,
        }
    }

    /// Watching starts when saving is turned on and stops when it's turned
    /// off, so nothing looks at the clipboard unless asked to.
    pub fn follow(&mut self, config: &Config) {
        let folder = config.clipboard_folder();
        if let Some(folder) = &folder
            && let Err(e) = std::fs::create_dir_all(folder)
        {
            eprintln!("can't make {}: {e}", folder.display());
        }
        let on = folder.is_some();
        *self.shared.folder.lock().expect("not poisoned") = folder;
        if on && self.watch.is_none() {
            eprintln!("saving images copied to the clipboard");
            self.watch = Some(platform::watch_clipboard(self.found.clone()));
        } else if !on && self.watch.take().is_some() {
            eprintln!("stopped saving images copied to the clipboard");
        }
    }

    pub fn fresh(&self) -> Fresh {
        Fresh(self.shared.clone())
    }
}

impl Fresh {
    /// Notes images that were just written, before the reader gets to them.
    pub fn note(&self, event: &Event) {
        if !matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_)) {
            return;
        }
        let now = Instant::now();
        let mut fresh = self.0.fresh.lock().expect("not poisoned");
        for path in event.paths.iter().filter(|p| indexer::is_image(p)) {
            fresh.retain(|(p, _)| p != path);
            fresh.push_back((path.clone(), now));
        }
        while fresh.front().is_some_and(|(_, t)| t.elapsed() > FRESH_FOR) {
            fresh.pop_front();
        }
    }
}

struct Saver {
    shared: Arc<Shared>,
    /// Pixel hashes of the copies saved or passed over lately.
    recent: VecDeque<u64>,
    /// How long to give a screenshot tool to write its own file.
    wait: Duration,
}

impl Saver {
    /// Saves one copied image, unless it's tiny, already saved, or already a
    /// file somewhere being read. The path it was saved as, if it was.
    fn take(&mut self, bytes: &[u8]) -> Result<Option<PathBuf>> {
        let Some(folder) = self.folder() else {
            return Ok(None);
        };
        let format = image::guess_format(bytes).context("not an image")?;
        let pixels = decode(bytes)?;
        if pixels.width() < MIN_SIDE || pixels.height() < MIN_SIDE {
            return Ok(None);
        }
        let hash = pixel_hash(&pixels);
        if self.recent.contains(&hash) {
            return Ok(None);
        }
        self.remember(hash);
        std::thread::sleep(self.wait);
        if self.already_a_file(&pixels, &folder) {
            return Ok(None);
        }
        // Turned off while waiting.
        let Some(folder) = self.folder() else {
            return Ok(None);
        };
        let png = if format == image::ImageFormat::Png {
            bytes.to_vec()
        } else {
            let mut png = Vec::new();
            pixels.write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)?;
            png
        };
        save(&folder, &png).map(Some)
    }

    fn folder(&self) -> Option<PathBuf> {
        self.shared.folder.lock().expect("not poisoned").clone()
    }

    fn remember(&mut self, hash: u64) {
        self.recent.push_back(hash);
        if self.recent.len() > REMEMBERED {
            self.recent.pop_front();
        }
    }

    /// Whether these exact pixels are already a file: one a screenshot tool
    /// saved as it copied, or the screenshot the window just copied. A file
    /// still being written can't be decoded yet, so that's tried again for a
    /// few seconds before giving up on it.
    fn already_a_file(&self, pixels: &RgbaImage, clips: &Path) -> bool {
        for _ in 0..4 {
            let mut candidates: Vec<PathBuf> = {
                let fresh = self.shared.fresh.lock().expect("not poisoned");
                fresh
                    .iter()
                    .filter(|(p, t)| t.elapsed() < FRESH_FOR && !p.starts_with(clips))
                    .map(|(p, _)| p.clone())
                    .collect()
            };
            candidates.extend(gyotaku_core::clipboard::own_copy());
            let mut unsure = false;
            for path in candidates {
                match same_pixels(&path, pixels) {
                    Some(true) => return true,
                    Some(false) => {}
                    None => unsure = true,
                }
            }
            if !unsure {
                return false;
            }
            std::thread::sleep(Duration::from_secs(1));
        }
        false
    }
}

/// None when the file can't be read (yet).
fn same_pixels(path: &Path, pixels: &RgbaImage) -> Option<bool> {
    let (w, h) = image::image_dimensions(path).ok()?;
    if (w, h) != pixels.dimensions() {
        return Some(false);
    }
    let bytes = std::fs::read(path).ok()?;
    Some(decode(&bytes).ok()?.as_raw() == pixels.as_raw())
}

fn decode(bytes: &[u8]) -> Result<RgbaImage> {
    let mut reader = image::ImageReader::new(std::io::Cursor::new(bytes)).with_guessed_format()?;
    let mut limits = image::Limits::default();
    limits.max_alloc = Some(MAX_DECODE);
    reader.limits(limits);
    Ok(reader.decode()?.to_rgba8())
}

fn pixel_hash(pixels: &RgbaImage) -> u64 {
    let mut hasher = std::hash::DefaultHasher::new();
    pixels.dimensions().hash(&mut hasher);
    pixels.as_raw().hash(&mut hasher);
    hasher.finish()
}

/// Written next to where it belongs under a name nothing reads, then renamed,
/// so the reader never sees half an image.
fn save(folder: &Path, png: &[u8]) -> Result<PathBuf> {
    let now = jiff::Zoned::now().datetime();
    let name = gyotaku_core::clipboard::file_name(now, |n| folder.join(n).exists());
    let path = folder.join(&name);
    let part = folder.join(format!(".{name}.part"));
    std::fs::write(&part, png).with_context(|| format!("writing {}", part.display()))?;
    std::fs::rename(&part, &path).with_context(|| format!("naming {}", path.display()))?;
    Ok(path)
}

/// What a clipboard watcher run per copy does (wl-paste on Wayland runs one
/// for each image copied): hands the image it was given on stdin to the
/// reader as a file in `dir`, and prints that file's path for the reader to
/// pick up.
pub fn hand_over(dir: &Path) -> Result<()> {
    // wl-paste says "sensitive" for things password managers copy. Never an
    // image, but never worth keeping either.
    if std::env::var("CLIPBOARD_STATE").is_ok_and(|s| s != "data") {
        return Ok(());
    }
    let mut bytes = Vec::new();
    std::io::stdin().take(MAX_DECODE).read_to_end(&mut bytes)?;
    if bytes.is_empty() {
        return Ok(());
    }
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let path = dir.join(format!("{stamp}-{}", std::process::id()));
    let part = path.with_extension("part");
    std::fs::write(&part, &bytes).with_context(|| format!("writing {}", part.display()))?;
    std::fs::rename(&part, &path)?;
    println!("{}", path.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png(w: u32, h: u32, shade: u8) -> Vec<u8> {
        let image = RgbaImage::from_pixel(w, h, image::Rgba([shade, 40, 90, 255]));
        let mut out = Vec::new();
        image
            .write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png)
            .unwrap();
        out
    }

    fn scratch(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("gyotaku-clipboard-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn saver(folder: &Path) -> Saver {
        let shared = Arc::new(Shared::default());
        *shared.folder.lock().unwrap() = Some(folder.to_path_buf());
        Saver {
            shared,
            recent: VecDeque::new(),
            wait: Duration::ZERO,
        }
    }

    #[test]
    fn a_copy_is_saved_once() {
        let dir = scratch("once");
        let mut saver = saver(&dir);
        let saved = saver.take(&png(64, 48, 10)).unwrap().unwrap();
        assert_eq!(std::fs::read(&saved).unwrap(), png(64, 48, 10));
        assert_eq!(saver.take(&png(64, 48, 10)).unwrap(), None);
        assert!(saver.take(&png(64, 48, 11)).unwrap().is_some());
        let files = std::fs::read_dir(&dir).unwrap().count();
        assert_eq!(files, 2, "no .part files left behind");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn icons_are_passed_over() {
        let dir = scratch("tiny");
        assert_eq!(saver(&dir).take(&png(16, 400, 0)).unwrap(), None);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn nothing_is_saved_once_turned_off() {
        let dir = scratch("off");
        let mut saver = saver(&dir);
        *saver.shared.folder.lock().unwrap() = None;
        assert_eq!(saver.take(&png(64, 64, 0)).unwrap(), None);
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 0);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_screenshot_a_tool_saved_and_copied_is_not_saved_again() {
        let dir = scratch("tool");
        let clips = dir.join("clips");
        let shots = dir.join("shots");
        std::fs::create_dir_all(&clips).unwrap();
        std::fs::create_dir_all(&shots).unwrap();
        let shot = shots.join("Screenshot.png");
        std::fs::write(&shot, png(80, 60, 200)).unwrap();

        let mut saver = saver(&clips);
        Fresh(saver.shared.clone())
            .note(&Event::new(EventKind::Create(notify::event::CreateKind::File)).add_path(shot));
        assert_eq!(saver.take(&png(80, 60, 200)).unwrap(), None);
        assert!(saver.take(&png(80, 60, 201)).unwrap().is_some());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn the_same_pixels_match_whatever_the_format() {
        let dir = scratch("format");
        let image = RgbaImage::from_pixel(40, 40, image::Rgba([1, 2, 3, 255]));
        let bmp = dir.join("a.bmp");
        image.save(&bmp).unwrap();
        assert_eq!(same_pixels(&bmp, &image), Some(true));
        let other = RgbaImage::from_pixel(40, 40, image::Rgba([1, 2, 4, 255]));
        assert_eq!(same_pixels(&bmp, &other), Some(false));
        assert_eq!(same_pixels(&dir.join("missing.png"), &image), None);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
