use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
use windows_sys::Win32::System::Threading::{
    GetCurrentProcess, PROCESS_MODE_BACKGROUND_BEGIN, SetPriorityClass,
};

/// Background mode lowers cpu, disk and memory priority all at once.
pub fn become_idle() {
    unsafe {
        SetPriorityClass(GetCurrentProcess(), PROCESS_MODE_BACKGROUND_BEGIN);
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
