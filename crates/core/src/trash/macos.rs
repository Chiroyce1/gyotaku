//! The macOS trash through the Finder's own mechanism, so a screenshot
//! moved there lands in the real system trash and can be put back from it
//! like anything deleted in the Finder.

use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};

/// A screenshot sitting in the Finder trash, and where it came from.
#[derive(Debug, Clone)]
pub struct Trashed {
    pub original: PathBuf,
}

/// Asks the Finder to delete the file, its native way, which keeps Put
/// Back working. macOS has no fixed-drive restriction: every volume has a
/// trash.
pub fn trash(path: &Path) -> Result<Trashed> {
    let path = std::path::absolute(path)?;
    ::trash::delete(&path)
        .with_context(|| format!("can't move {} to the Finder trash", path.display()))?;
    Ok(Trashed { original: path })
}

/// The trash crate's os_limited is the only API that puts things back, and
/// it has no macOS backend, so restoring from here isn't possible yet.
/// Anything trashed above still gets the Finder's own Put Back.
fn restore(_: &Trashed) -> Result<()> {
    bail!("putting back from the Finder trash isn't supported on macOS yet")
}

/// Every restore fails on macOS, one error per item, unlike the systems
/// that have a put-back API.
pub fn restore_all(items: &[Trashed]) -> Vec<Result<()>> {
    items.iter().map(restore).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Moves a scratch file through this machine's real trash: the Finder
    /// must take it, and it must sit in ~/.Trash under its own name with
    /// its bytes intact. The test then removes its own scratch from the
    /// trash again, so nothing of the user's is touched.
    #[test]
    fn trashes_through_the_finder() {
        let dir = std::env::temp_dir().join(format!("gyotaku-trash-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let shot = dir.join(format!("gyotaku-scratch-{}.png", std::process::id()));
        std::fs::write(&shot, b"png").unwrap();

        let t = trash(&shot).unwrap();
        assert!(!shot.exists());
        assert_eq!(t.original, shot);

        let in_trash = home_trash().join(shot.file_name().unwrap());
        assert_eq!(std::fs::read(&in_trash).unwrap(), b"png");
        std::fs::remove_file(&in_trash).unwrap();
        std::fs::remove_dir_all(&dir).unwrap();
    }

    fn home_trash() -> PathBuf {
        directories::BaseDirs::new()
            .unwrap()
            .home_dir()
            .join(".Trash")
    }
}
