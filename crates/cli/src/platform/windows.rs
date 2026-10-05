use std::os::windows::fs::MetadataExt as _;

use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
use windows_sys::Win32::System::Threading::{
    GetCurrentProcess, IDLE_PRIORITY_CLASS, SetPriorityClass,
};

/// Idle priority: the reader only gets cpu nobody else wants. Not
/// "background mode", which also caps the working set at a few tens of MB,
/// and reading a screenshot needs a few hundred.
pub fn become_idle() {
    unsafe {
        SetPriorityClass(GetCurrentProcess(), IDLE_PRIORITY_CLASS);
    }
}

/// The Windows heap gives freed pages back by itself.
pub fn release_memory() {}

/// AC line status 0 means unplugged. Desktops report 1, or 255 (unknown)
/// when there's no battery at all, and neither counts.
pub fn on_battery() -> bool {
    let mut status: SYSTEM_POWER_STATUS = unsafe { std::mem::zeroed() };
    (unsafe { GetSystemPowerStatus(&mut status) } != 0) && status.ACLineStatus == 0
}

const FILE_ATTRIBUTE_OFFLINE: u32 = 0x0000_1000;
const FILE_ATTRIBUTE_RECALL_ON_OPEN: u32 = 0x0004_0000;
const FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS: u32 = 0x0040_0000;

pub fn only_in_the_cloud(meta: &std::fs::Metadata) -> bool {
    meta.file_attributes()
        & (FILE_ATTRIBUTE_OFFLINE
            | FILE_ATTRIBUTE_RECALL_ON_OPEN
            | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS)
        != 0
}
