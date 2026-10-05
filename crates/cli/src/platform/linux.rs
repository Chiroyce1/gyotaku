pub fn become_idle() {
    unsafe {
        let param = libc::sched_param { sched_priority: 0 };
        libc::sched_setscheduler(0, libc::SCHED_IDLE, &param);
        // ioprio_set(IOPRIO_WHO_PROCESS, self, IOPRIO_CLASS_IDLE << 13). libc
        // has no wrapper for it.
        libc::syscall(libc::SYS_ioprio_set, 1, 0, 3 << 13);
    }
}

/// glibc keeps freed memory around for reuse; musl doesn't, so there's
/// nothing to hand back.
pub fn release_memory() {
    #[cfg(target_env = "gnu")]
    unsafe {
        libc::malloc_trim(0);
    }
}

/// Any laptop's kernel lists its batteries under /sys/class/power_supply,
/// and one that says Discharging means unplugged.
pub fn on_battery() -> bool {
    std::fs::read_dir("/sys/class/power_supply")
        .into_iter()
        .flatten()
        .flatten()
        .any(|supply| {
            let read = |f: &str| std::fs::read_to_string(supply.path().join(f)).unwrap_or_default();
            read("type").trim() == "Battery" && read("status").trim() == "Discharging"
        })
}
