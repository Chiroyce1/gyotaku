//! The Windows Recycle Bin, through the shell's own file operations, so a
//! screenshot moved there can be restored from the Recycle Bin like
//! anything deleted in Explorer.

use std::os::windows::ffi::OsStrExt as _;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};

#[derive(Debug, Clone)]
pub struct Trashed {
    pub original: PathBuf,
}

/// Only on fixed drives. A USB stick or a network share has no Recycle Bin,
/// and asking the shell to recycle there deletes the file for good.
pub fn trash(path: &Path) -> Result<Trashed> {
    let path = std::path::absolute(path)?;
    if !on_fixed_drive(&path) {
        bail!(
            "{} is on a drive without a Recycle Bin, so it was left alone",
            path.display()
        );
    }
    ::trash::delete(&path)
        .with_context(|| format!("can't move {} to the Recycle Bin", path.display()))?;
    Ok(Trashed { original: path })
}

/// Finds the most recently recycled file that came from this path and puts
/// it back. Refuses if something new has taken its place since.
pub fn restore(t: &Trashed) -> Result<()> {
    if std::fs::symlink_metadata(&t.original).is_ok() {
        bail!("{} exists again", t.original.display());
    }
    let parent = t.original.parent().context("no parent folder")?;
    let name = t.original.file_name().context("no file name")?;
    let item = ::trash::os_limited::list()
        .context("can't read the Recycle Bin")?
        .into_iter()
        .filter(|i| i.original_parent == parent && i.name == name)
        .max_by_key(|i| i.time_deleted)
        .with_context(|| format!("{} isn't in the Recycle Bin any more", t.original.display()))?;
    ::trash::os_limited::restore_all([item])
        .with_context(|| format!("can't put back {}", t.original.display()))?;
    Ok(())
}

fn on_fixed_drive(path: &Path) -> bool {
    use windows_sys::Win32::Storage::FileSystem::{GetDriveTypeW, GetVolumePathNameW};
    const DRIVE_FIXED: u32 = 3;

    let wide: Vec<u16> = path.as_os_str().encode_wide().chain([0]).collect();
    let mut root = [0u16; 261];
    let found = unsafe { GetVolumePathNameW(wide.as_ptr(), root.as_mut_ptr(), root.len() as u32) };
    found != 0 && unsafe { GetDriveTypeW(root.as_ptr()) } == DRIVE_FIXED
}
