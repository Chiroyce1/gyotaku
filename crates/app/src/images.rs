//! Decoded images, least recently used first out.
//!
//! This used to go through gpui's own image loader behind an LRU cache, and
//! memory climbed about 9 MB per page of scrolling without ever coming back,
//! even with nothing painted and every cached image provably released. Doing
//! the decode here means every reference to a picture is ours, and dropping
//! one out of the cache actually frees it. notes.md has the measurements.

use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use gpui::{App, RenderImage, Window};
use image::{Frame, imageops::FilterType};
use smallvec::smallvec;

pub enum Lookup {
    Ready(Arc<RenderImage>),
    Pending,
    /// Not seen before, decode it at no more than this many pixels a side.
    Start(u32),
}

enum Slot {
    Loading,
    Ready(Arc<RenderImage>),
    Failed,
}

pub struct Images {
    slots: HashMap<PathBuf, Slot>,
    /// Least recently used at the front.
    order: VecDeque<PathBuf>,
    capacity: usize,
    /// Anything bigger gets scaled down on decode. A 28 megapixel scroll
    /// capture would otherwise be a 112 MB texture.
    max_side: u32,
}

impl Images {
    pub fn new(capacity: usize, max_side: u32) -> Self {
        Self {
            slots: HashMap::new(),
            order: VecDeque::new(),
            capacity,
            max_side,
        }
    }

    /// The image if it's ready. `Start` means the caller should kick off a
    /// decode for it, which happens once per path.
    pub fn get(&mut self, path: &Path, window: &mut Window, cx: &mut App) -> Lookup {
        if let Some(slot) = self.slots.get(path) {
            let found = match slot {
                Slot::Ready(image) => Lookup::Ready(image.clone()),
                Slot::Loading | Slot::Failed => Lookup::Pending,
            };
            self.touch(path);
            return found;
        }

        self.slots.insert(path.to_owned(), Slot::Loading);
        self.order.push_back(path.to_owned());
        while self.order.len() > self.capacity {
            let Some(oldest) = self.order.pop_front() else {
                break;
            };
            if let Some(Slot::Ready(image)) = self.slots.remove(&oldest) {
                // Frees the texture on the gpu, the pixels go with the Arc.
                cx.drop_image(image, Some(window));
            }
        }
        Lookup::Start(self.max_side)
    }

    /// Called when a decode finishes. If the slot was evicted in the meantime
    /// the image is just dropped.
    pub fn finish(&mut self, path: &Path, image: Option<Arc<RenderImage>>) {
        if let Some(slot) = self.slots.get_mut(path) {
            *slot = match image {
                Some(image) => Slot::Ready(image),
                None => Slot::Failed,
            };
        }
    }

    fn touch(&mut self, path: &Path) {
        if self.order.back().is_some_and(|p| p == path) {
            return;
        }
        if let Some(at) = self.order.iter().position(|p| p == path) {
            let p = self
                .order
                .remove(at)
                .expect("position came from the same deque");
            self.order.push_back(p);
        }
    }
}

/// Runs on a background thread.
pub fn decode(path: &Path, max_side: u32) -> Option<Arc<RenderImage>> {
    let mut img = image::open(path).ok()?;
    if img.width().max(img.height()) > max_side {
        img = img.resize(max_side, max_side, FilterType::Triangle);
    }
    let mut pixels = img.into_rgba8();
    // gpui wants BGRA.
    for px in pixels.chunks_exact_mut(4) {
        px.swap(0, 2);
    }
    Some(Arc::new(RenderImage::new(smallvec![Frame::new(pixels)])))
}
