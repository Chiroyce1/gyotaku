//! OCR for screenshots: PP-OCRv6 detection and recognition models running on
//! ONNX Runtime, with the pre and post processing written for this project.

mod det;
mod models;
mod rec;

use std::path::Path;

use anyhow::{Context, Result};
use gyotaku_core::{Line, Rect};
use image::RgbImage;
use ort::session::{Session, builder::GraphOptimizationLevel};

pub use models::models_dir;

// Lines the recognizer isn't at least this sure about are mostly icons read as
// letters. Paddle's default.
const MIN_SCORE: f32 = 0.5;

pub struct Ocr {
    det: Session,
    rec: Session,
    alphabet: Vec<String>,
}

impl Ocr {
    /// Loads both models, downloading them on first use. `threads` is how many
    /// cores one screenshot may use.
    pub fn new(threads: usize) -> Result<Self> {
        let det = session(&models::ensure(&models::DET)?, threads)?;
        let rec = session(&models::ensure(&models::REC)?, threads)?;
        let alphabet = rec::alphabet(&rec)?;
        Ok(Self { det, rec, alphabet })
    }

    pub fn read(&mut self, img: &RgbImage) -> Result<Vec<Line>> {
        // Nothing readable fits in a sliver, and the models would choke on it.
        if img.width() < 8 || img.height() < 8 {
            return Ok(Vec::new());
        }
        let regions = det::detect(&mut self.det, img)?;
        let texts = rec::recognize(&mut self.rec, &self.alphabet, img, &regions)?;

        let (w, h) = (img.width() as f32, img.height() as f32);
        Ok(regions
            .iter()
            .zip(texts)
            .filter(|(_, (text, score))| *score >= MIN_SCORE && worth_keeping(text))
            .map(|(r, (text, score))| Line {
                text: text.trim().to_owned(),
                rect: Rect {
                    x: r.x0 as f32 / w,
                    y: r.y0 as f32 / h,
                    w: r.width() as f32 / w,
                    h: r.height() as f32 / h,
                },
                score,
            })
            .collect())
    }
}

/// UI icons get detected as text and come back as one confident character: a
/// bell reads as 白, a grid as 品, a hamburger menu as 三. A lone character is
/// never something anyone searches for, so those go.
fn worth_keeping(text: &str) -> bool {
    text.trim().chars().count() > 1
}

fn session(model: &Path, threads: usize) -> Result<Session> {
    let build = || -> ort::Result<Session> {
        // No arena and no memory pattern: every screenshot is a different size,
        // so both just hold on to the peak of the biggest one forever.
        Session::builder()?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_intra_threads(threads)?
            .with_execution_providers([ort::ep::CPU::default()
                .with_arena_allocator(false)
                .build()])?
            .with_memory_pattern(false)?
            .commit_from_file(model)
    };
    build().with_context(|| format!("loading {}", model.display()))
}

pub fn load_image(path: &Path) -> Result<RgbImage> {
    Ok(image::open(path)
        .with_context(|| format!("decoding {}", path.display()))?
        .into_rgb8())
}
