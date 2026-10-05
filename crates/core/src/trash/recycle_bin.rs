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

/// Puts each one back: for each, the most recently recycled file that came
/// from its path. Refuses one where something new has taken its place since.
/// The Recycle Bin is read once for the lot, it can hold thousands of items.
pub fn restore_all(items: &[Trashed]) -> Vec<Result<()>> {
    let mut bin = match ::trash::os_limited::list() {
        Ok(bin) => bin,
        Err(e) => {
            let e = format!("can't read the Recycle Bin: {e}");
            return items
                .iter()
                .map(|_| Err(anyhow::anyhow!(e.clone())))
                .collect();
        }
    };
    items
        .iter()
        .map(|t| {
            if std::fs::symlink_metadata(&t.original).is_ok() {
                bail!("{} exists again", t.original.display());
            }
            let at = bin
                .iter()
                .enumerate()
                .filter(|(_, i)| came_from(i, &t.original))
                .max_by_key(|(_, i)| i.time_deleted)
                .map(|(at, _)| at)
                .with_context(|| {
                    format!("{} isn't in the Recycle Bin any more", t.original.display())
                })?;
            let item = bin.swap_remove(at);
            ::trash::os_limited::restore_all([item])
                .with_context(|| format!("can't put back {}", t.original.display()))
        })
        .collect()
}

/// Windows paths ignore case, and the Recycle Bin lists names the way
/// Explorer shows them, which hides the extension by default.
fn came_from(item: &::trash::TrashItem, original: &Path) -> bool {
    let same = |a: &std::ffi::OsStr, b: &std::ffi::OsStr| {
        a.to_string_lossy().to_lowercase() == b.to_string_lossy().to_lowercase()
    };
    let (Some(parent), Some(name)) = (original.parent(), original.file_name()) else {
        return false;
    };
    let stem = original.file_stem().unwrap_or(name);
    same(item.original_parent.as_os_str(), parent.as_os_str())
        && (same(&item.name, name) || same(&item.name, stem))
}

fn on_fixed_drive(path: &Path) -> bool {
    use windows_sys::Win32::Storage::FileSystem::{GetDriveTypeW, GetVolumePathNameW};
    const DRIVE_FIXED: u32 = 3;

    let wide: Vec<u16> = path.as_os_str().encode_wide().chain([0]).collect();
    let mut root = [0u16; 261];
    let found = unsafe { GetVolumePathNameW(wide.as_ptr(), root.as_mut_ptr(), root.len() as u32) };
    found != 0 && unsafe { GetDriveTypeW(root.as_ptr()) } == DRIVE_FIXED
}
