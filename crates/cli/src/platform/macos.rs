//! The macOS side of the reader's platform chores, all through libSystem and
//! the system frameworks every binary here already links.

/// The Darwin background band is the macOS equivalent of SCHED_IDLE plus
/// ioprio idle: one call lowers cpu and io priority together. Failing is
/// fine, it just runs at normal priority.
pub fn become_idle() {
    unsafe {
        libc::setpriority(libc::PRIO_DARWIN_PROCESS, 0, libc::PRIO_DARWIN_BG);
    }
}

/// The native equivalent of glibc's malloc_trim: hands freed pages back to
/// the kernel instead of keeping them for the next screenshot.
pub fn release_memory() {
    unsafe {
        malloc_zone_pressure_relief(malloc_default_zone(), 0);
    }
}

unsafe extern "C" {
    fn malloc_default_zone() -> *mut std::ffi::c_void;
    fn malloc_zone_pressure_relief(zone: *mut std::ffi::c_void, goal: usize) -> usize;
}

// Cloud files. iCloud Drive evicts a file's contents and leaves a
// placeholder with SF_DATALESS set in st_flags. Reading such a file starts
// a download, so the indexer leaves it until it is back on disk.

const SF_DATALESS: u32 = 0x4000_0000;

pub fn only_in_the_cloud(meta: &std::fs::Metadata) -> bool {
    use std::os::macos::fs::MetadataExt;
    meta.st_flags() & SF_DATALESS != 0
}

// Clipboard images. Watching the pasteboard needs the ObjC runtime, so
// macOS gets the handle that never sends anything; screenshots saved to
// disk are still read.

pub struct ClipboardWatch;

pub fn watch_clipboard(_: std::sync::mpsc::Sender<Vec<u8>>) -> ClipboardWatch {
    ClipboardWatch
}

/// IOKit lists the power sources, and one whose state is Battery Power
/// means unplugged. Desktops have no battery source, so they read as
/// plugged in. This runs at most every 30 seconds from the watcher.
pub fn on_battery() -> bool {
    const K_CF_STRING_ENCODING_ASCII: u32 = 0x0600;

    unsafe {
        // IOPSKeys.h only #defines the key as "Power Source State"; the
        // symbol isn't exported as linkable data on arm64, so make it.
        let key = CFStringCreateWithCString(
            std::ptr::null_mut(),
            c"Power Source State".as_ptr(),
            K_CF_STRING_ENCODING_ASCII,
        );
        if key.is_null() {
            return false;
        }
        let info = IOPSCopyPowerSourcesInfo();
        if info.is_null() {
            CFRelease(key);
            return false;
        }
        let list = IOPSCopyPowerSourcesList(info);
        if list.is_null() {
            CFRelease(info);
            CFRelease(key);
            return false;
        }

        let mut on_battery = false;
        for i in 0..CFArrayGetCount(list) {
            let source = CFArrayGetValueAtIndex(list, i);
            if source.is_null() {
                continue;
            }
            // Borrowed from the blob, which outlives this loop; never released.
            let desc = IOPSGetPowerSourceDescription(info, source);
            if desc.is_null() {
                continue;
            }
            let state = CFDictionaryGetValue(desc, key);
            if state.is_null() {
                continue;
            }
            let mut buf = [0 as std::ffi::c_char; 64];
            if CFStringGetCString(
                state,
                buf.as_mut_ptr(),
                buf.len() as isize,
                K_CF_STRING_ENCODING_ASCII,
            ) && std::ffi::CStr::from_ptr(buf.as_ptr()).to_bytes() == b"Battery Power"
            {
                on_battery = true;
                break;
            }
        }

        CFRelease(list);
        CFRelease(info);
        CFRelease(key);
        on_battery
    }
}

#[link(name = "IOKit", kind = "framework")]
unsafe extern "C" {
    // Copy semantics: we own both, and release them after walking the list.
    fn IOPSCopyPowerSourcesInfo() -> *mut std::ffi::c_void;
    fn IOPSCopyPowerSourcesList(blob: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    // Get semantics: the description belongs to the blob, so it is never released.
    fn IOPSGetPowerSourceDescription(
        blob: *mut std::ffi::c_void,
        source: *mut std::ffi::c_void,
    ) -> *mut std::ffi::c_void;
}

#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFArrayGetCount(array: *mut std::ffi::c_void) -> isize;
    fn CFArrayGetValueAtIndex(array: *mut std::ffi::c_void, index: isize) -> *mut std::ffi::c_void;
    fn CFDictionaryGetValue(
        dict: *mut std::ffi::c_void,
        key: *const std::ffi::c_void,
    ) -> *mut std::ffi::c_void;
    fn CFStringGetCString(
        s: *const std::ffi::c_void,
        buffer: *mut std::ffi::c_char,
        buffer_size: isize,
        encoding: u32,
    ) -> bool;
    fn CFStringCreateWithCString(
        alloc: *mut std::ffi::c_void,
        cstr: *const std::ffi::c_char,
        encoding: u32,
    ) -> *mut std::ffi::c_void;
    fn CFRelease(cf: *mut std::ffi::c_void);
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Apple's own tool is the oracle: whatever pmset says the machine is
    /// drawing from, on_battery must agree with it.
    #[test]
    fn battery_state_matches_pmset() {
        let Ok(out) = std::process::Command::new("pmset")
            .arg("-g")
            .arg("batt")
            .output()
        else {
            return;
        };
        let out = String::from_utf8_lossy(&out.stdout);
        if out.contains("Now drawing from 'AC Power'") {
            assert!(!on_battery());
        } else if out.contains("Now drawing from 'Battery Power'") {
            assert!(on_battery());
        }
    }
}
