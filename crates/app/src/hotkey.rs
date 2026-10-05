//! The key that summons the window from anywhere. On Linux that's the
//! desktop's job (a shortcut in its settings runs `gyotaku-app`), but
//! Windows has no such thing for an arbitrary command, so the resident
//! process registers the key itself.

use futures::channel::mpsc::UnboundedSender;
use global_hotkey::hotkey::HotKey;
use global_hotkey::{GlobalHotKeyEvent, GlobalHotKeyManager, HotKeyState};
use gpui::{App, Global};

/// Win+S is Windows search and Win+Shift+S the snipping tool, so the
/// default stays clear of the Windows key.
pub const DEFAULT: &str = "alt-shift-s";

/// Kept alive for as long as the app runs; dropping it unregisters the key.
struct Registered(#[allow(dead_code)] GlobalHotKeyManager);

impl Global for Registered {}

/// Registers the summon key, sending a knock each time it's pressed, the
/// same knock a second launch sends. False if the key couldn't be had
/// (another program holds it), in which case launching gyotaku-app from
/// the Start menu still works.
pub fn register(key: &str, knocks: UnboundedSender<()>, cx: &mut App) -> bool {
    let Ok(hotkey) = key.replace('-', "+").parse::<HotKey>() else {
        return false;
    };
    let Ok(manager) = GlobalHotKeyManager::new() else {
        return false;
    };
    if manager.register(hotkey).is_err() {
        return false;
    }
    GlobalHotKeyEvent::set_event_handler(Some(move |e: GlobalHotKeyEvent| {
        if e.state == HotKeyState::Pressed {
            let _ = knocks.unbounded_send(());
        }
    }));
    cx.set_global(Registered(manager));
    true
}
