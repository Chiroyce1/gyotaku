//! The few things the reader does differently on each system: getting out of
//! the way of everything else, handing memory back, and noticing a battery.
//! Each system has one file providing these with the same signatures.

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
use linux as imp;

#[cfg(windows)]
mod windows;
#[cfg(windows)]
use windows as imp;

#[cfg(not(any(target_os = "linux", windows)))]
compile_error!(
    "gyotaku runs on Linux and Windows so far. A port means adding a file next to \
     linux.rs and windows.rs that provides the same items."
);

/// Drops the process to the lowest priority the system has, so reading only
/// ever runs on time nothing else wants. Failing is fine, it just runs at
/// normal priority.
pub use imp::become_idle;

/// Gives memory freed after a screenshot back to the system. Right after OCR
/// that's a couple hundred MB nobody needs until the next screenshot, which
/// for the watcher can be hours away.
pub use imp::release_memory;

/// Whether the machine is running on battery right now. Desktops never are.
pub use imp::on_battery;
