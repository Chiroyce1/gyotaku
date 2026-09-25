use std::fs::{self, File};
use std::io::{BufWriter, Read, Write};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use sha2::{Digest, Sha256};

pub struct Model {
    pub file: &'static str,
    url: &'static str,
    sha256: &'static str,
}

// PP-OCRv6 exported to onnx by the RapidOCR folks. Same files their python
// package downloads, pinned by hash so a changed upstream file fails loudly
// instead of quietly reading text differently.
macro_rules! url {
    ($rest:literal) => {
        concat!(
            "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.9.2/onnx/PP-OCRv6",
            $rest
        )
    };
}

// Tiny detector, small recognizer. On 25 of my own screenshots the tiny
// detector ran 4.6x faster than small and kept 99.6% of the words (its misses
// are mostly word gaps, which substring search doesn't care about). The tiny
// recognizer genuinely misreads things (mock -> meek), so rec stays small.
// Numbers are in notes.md.
pub const DET: Model = Model {
    file: "PP-OCRv6_det_tiny.onnx",
    url: url!("/det/PP-OCRv6_det_tiny.onnx"),
    sha256: "f42c0fbd294d95eac1a550e131b277dac97462c8025fa4b6c3cec1b7894bd3d5",
};

pub const REC: Model = Model {
    file: "PP-OCRv6_rec_small.onnx",
    url: url!("/rec/PP-OCRv6_rec_small.onnx"),
    sha256: "6f327246b50388f3c176ae304bd95767ea6dc0c9ae92153ef8cbe210b3c14884",
};

pub fn models_dir() -> Result<PathBuf> {
    Ok(gyotaku_core::data_dir()?.join("models"))
}

/// Returns the path to the model, downloading it first if it isn't there yet.
pub fn ensure(model: &Model) -> Result<PathBuf> {
    let dir = models_dir()?;
    let path = dir.join(model.file);
    if path.exists() {
        return Ok(path);
    }
    fs::create_dir_all(&dir)?;
    eprintln!("downloading {} (first run only)", model.file);
    download(model, &path).with_context(|| format!("downloading {}", model.url))?;
    Ok(path)
}

fn download(model: &Model, dest: &Path) -> Result<()> {
    let part = dest.with_extension("part");
    let mut body = ureq::get(model.url).call()?.into_body().into_reader();
    let mut out = BufWriter::new(File::create(&part)?);
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 16];
    loop {
        let n = body.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        out.write_all(&buf[..n])?;
    }
    out.flush()?;

    let got = format!("{:x}", hasher.finalize());
    if got != model.sha256 {
        fs::remove_file(&part)?;
        bail!("checksum mismatch, expected {} got {got}", model.sha256);
    }
    // Rename last so a half downloaded file never looks like a real model.
    fs::rename(&part, dest)?;
    Ok(())
}
