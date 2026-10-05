//! Moving screenshots to the system's trash, and back. Nothing here ever
//! deletes a file: if a screenshot can't be moved to a trash it can be
//! restored from, it stays where it is.
//!
//! Each system provides `Trashed` (what's needed to put one back), `trash`
//! for one file, and `restore_all`, which puts a batch back and reports on
//! each.

#[cfg(all(unix, not(target_os = "macos")))]
mod freedesktop;
#[cfg(all(unix, not(target_os = "macos")))]
pub use freedesktop::{Trashed, restore_all, trash};

#[cfg(windows)]
mod recycle_bin;
#[cfg(windows)]
pub use recycle_bin::{Trashed, restore_all, trash};

#[cfg(target_os = "macos")]
mod unsupported {
    use std::path::{Path, PathBuf};

    use anyhow::{Result, anyhow, bail};

    #[derive(Debug, Clone)]
    pub struct Trashed {
        pub original: PathBuf,
    }

    pub fn trash(_: &Path) -> Result<Trashed> {
        bail!("moving to the trash isn't supported on macOS yet")
    }

    pub fn restore_all(items: &[Trashed]) -> Vec<Result<()>> {
        items
            .iter()
            .map(|_| Err(anyhow!("moving to the trash isn't supported on macOS yet")))
            .collect()
    }
}
#[cfg(target_os = "macos")]
pub use unsupported::{Trashed, restore_all, trash};
