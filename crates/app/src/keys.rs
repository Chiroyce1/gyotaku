//! Every keyboard shortcut in one place: the commands that can be rebound in
//! settings (saved in config.toml under `[keys]`), and the keys that can't.
//! Moving around stays fixed on purpose, so no setting can leave someone
//! unable to get back out.

use std::collections::{BTreeMap, HashMap};

use gpui::{App, Global, KeyBinding, Keystroke, SharedString};

use crate::app::*;
use crate::input::*;

pub struct Shortcut {
    /// The name in config.toml.
    pub name: &'static str,
    pub label: &'static str,
    pub default: &'static str,
    bind: fn(&str) -> KeyBinding,
}

pub const SHORTCUTS: [Shortcut; 9] = [
    Shortcut {
        name: "copy_text",
        label: "copy text",
        default: "ctrl-c",
        bind: |k| KeyBinding::new(k, CopyText, Some("Gyotaku")),
    },
    Shortcut {
        name: "copy_image",
        label: "copy image",
        default: "ctrl-shift-c",
        bind: |k| KeyBinding::new(k, CopyImage, Some("Gyotaku")),
    },
    Shortcut {
        name: "open",
        label: "open in the image viewer",
        default: "ctrl-o",
        bind: |k| KeyBinding::new(k, OpenExternal, Some("Gyotaku")),
    },
    Shortcut {
        name: "reveal",
        label: "show in its folder",
        default: "ctrl-shift-o",
        bind: |k| KeyBinding::new(k, Reveal, Some("Gyotaku")),
    },
    Shortcut {
        name: "mark_all",
        label: "mark every result",
        default: "ctrl-shift-a",
        bind: |k| KeyBinding::new(k, MarkAll, Some("Gyotaku")),
    },
    Shortcut {
        name: "trash",
        label: "move to the trash",
        default: "ctrl-delete",
        bind: |k| KeyBinding::new(k, Trash, Some("Gyotaku")),
    },
    Shortcut {
        name: "undo",
        label: "undo moving to the trash",
        default: "ctrl-z",
        bind: |k| KeyBinding::new(k, Undo, Some("Gyotaku")),
    },
    Shortcut {
        name: "settings",
        label: "settings",
        default: "ctrl-,",
        bind: |k| KeyBinding::new(k, OpenSettings, Some("Gyotaku")),
    },
    Shortcut {
        name: "quit",
        label: "quit",
        default: "ctrl-q",
        bind: |k| KeyBinding::new(k, Quit, Some("Gyotaku")),
    },
];

/// Shown in settings next to the ones that can be changed.
pub const FIXED: [(&str, &str); 6] = [
    ("esc", "back"),
    ("enter", "open"),
    ("arrows", "move"),
    ("pgup pgdn", "jump"),
    ("shift arrows", "mark a run"),
    ("ctrl click", "mark one"),
];

// The search field edits text with these, and it sits closer to the focus
// than any shortcut, so a shortcut bound to one would never fire.
const TEXT_EDITING: [&str; 4] = ["ctrl-a", "ctrl-v", "ctrl-x", "ctrl-backspace"];

/// What each shortcut is bound to right now, ready to show, so hints on
/// screen always name the keys that actually work.
struct Bound(HashMap<&'static str, SharedString>);

impl Global for Bound {}

/// The keys for a shortcut, as shown on screen: `ctrl shift c`.
pub fn shown(name: &str, cx: &App) -> SharedString {
    cx.try_global::<Bound>()
        .and_then(|b| b.0.get(name).cloned())
        .unwrap_or_default()
}

/// The key a shortcut ends up on: its override when that's usable,
/// otherwise its default. A hand-edited config with a typo or a clash just
/// falls back, it never takes a shortcut away.
fn resolve(overrides: &BTreeMap<String, String>) -> Vec<String> {
    let mut taken: Vec<String> = Vec::new();
    let mut keys = Vec::new();
    for s in &SHORTCUTS {
        let wanted = overrides
            .get(s.name)
            .filter(|k| usable(k).is_ok() && !taken.contains(k))
            .cloned();
        let key = wanted.unwrap_or_else(|| s.default.to_string());
        taken.push(key.clone());
        keys.push(key);
    }
    keys
}

/// Why a key can't be a shortcut, if it can't.
pub fn usable(key: &str) -> Result<(), &'static str> {
    let Ok(k) = Keystroke::parse(key) else {
        return Err("that key can't be used");
    };
    let m = k.modifiers;
    let function_key =
        k.key.len() > 1 && k.key.starts_with('f') && k.key[1..].parse::<u8>().is_ok();
    if !(m.control || m.alt || m.platform || function_key) {
        return Err("use it with ctrl, alt or super, it would type otherwise");
    }
    if TEXT_EDITING.contains(&key) {
        return Err("the search field uses that one for editing");
    }
    Ok(())
}

/// The keys bound to a shortcut, by its place in SHORTCUTS.
pub fn current(i: usize, overrides: &BTreeMap<String, String>) -> String {
    resolve(overrides).swap_remove(i)
}

/// Which other shortcut already has this key, if any.
pub fn taken_by(key: &str, except: usize, overrides: &BTreeMap<String, String>) -> Option<usize> {
    resolve(overrides)
        .iter()
        .enumerate()
        .find(|(i, k)| *i != except && k.as_str() == key)
        .map(|(i, _)| i)
}

/// Throws out every binding and binds them all again, so a change in
/// settings applies straight away.
pub fn bind_all(cx: &mut App, overrides: &BTreeMap<String, String>) {
    cx.clear_key_bindings();
    cx.bind_keys([
        KeyBinding::new("escape", Back, Some("Gyotaku")),
        KeyBinding::new("enter", Open, Some("Gyotaku")),
        KeyBinding::new("up", Up, Some("Gyotaku")),
        KeyBinding::new("down", Down, Some("Gyotaku")),
        KeyBinding::new("left", Left, Some("Gyotaku")),
        KeyBinding::new("right", Right, Some("Gyotaku")),
        KeyBinding::new("pageup", PageUp, Some("Gyotaku")),
        KeyBinding::new("pagedown", PageDown, Some("Gyotaku")),
        KeyBinding::new("shift-up", MarkUp, Some("Gyotaku")),
        KeyBinding::new("shift-down", MarkDown, Some("Gyotaku")),
        KeyBinding::new("shift-left", MarkLeft, Some("Gyotaku")),
        KeyBinding::new("shift-right", MarkRight, Some("Gyotaku")),
        KeyBinding::new("space", Toggle, Some("Panel")),
        KeyBinding::new("delete", Remove, Some("Panel")),
        KeyBinding::new("backspace", Remove, Some("Panel")),
        KeyBinding::new("backspace", Backspace, Some("TextInput")),
        KeyBinding::new("ctrl-backspace", DeleteWord, Some("TextInput")),
        KeyBinding::new("delete", Delete, Some("TextInput")),
        KeyBinding::new("ctrl-a", SelectAll, Some("TextInput")),
        KeyBinding::new("home", Home, Some("TextInput")),
        KeyBinding::new("end", End, Some("TextInput")),
        KeyBinding::new("ctrl-v", Paste, Some("TextInput")),
        KeyBinding::new("ctrl-x", Cut, Some("TextInput")),
    ]);
    let keys = resolve(overrides);
    let mut bound = HashMap::new();
    for (s, key) in SHORTCUTS.iter().zip(&keys) {
        cx.bind_keys([(s.bind)(key)]);
        bound.insert(s.name, pretty(key));
    }
    cx.set_global(Bound(bound));
}

/// `ctrl-shift-c` as `ctrl shift c`, the way every hint in the app reads.
pub fn pretty(key: &str) -> SharedString {
    let Ok(k) = Keystroke::parse(key) else {
        return key.to_string().into();
    };
    let m = k.modifiers;
    let mut parts: Vec<&str> = Vec::new();
    for (on, name) in [
        (m.control, "ctrl"),
        (m.alt, "alt"),
        (m.platform, "super"),
        (m.shift, "shift"),
    ] {
        if on {
            parts.push(name);
        }
    }
    let key = match k.key.as_str() {
        "delete" => "del",
        "escape" => "esc",
        "backspace" => "bksp",
        "pageup" => "pgup",
        "pagedown" => "pgdn",
        other => other,
    };
    parts.push(key);
    parts.join(" ").into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_keys_and_editing_keys_are_refused() {
        assert!(usable("a").is_err());
        assert!(usable("shift-a").is_err());
        assert!(usable("delete").is_err());
        assert!(usable("ctrl-v").is_err());
        assert!(usable("ctrl-backspace").is_err());
        assert!(usable("ctrl-k").is_ok());
        assert!(usable("alt-shift-d").is_ok());
        assert!(usable("super-t").is_ok());
        assert!(usable("f5").is_ok());
    }

    #[test]
    fn overrides_apply_and_bad_ones_fall_back() {
        let ix = |name| SHORTCUTS.iter().position(|s| s.name == name).unwrap();
        let mut o = BTreeMap::new();
        o.insert("trash".to_string(), "ctrl-k".to_string());
        assert_eq!(current(ix("trash"), &o), "ctrl-k");
        o.insert("trash".to_string(), "x".to_string());
        assert_eq!(current(ix("trash"), &o), "ctrl-delete");
        // A clash with an earlier shortcut keeps the default instead.
        o.insert("trash".to_string(), "ctrl-c".to_string());
        assert_eq!(current(ix("trash"), &o), "ctrl-delete");
        assert_eq!(taken_by("ctrl-o", ix("trash"), &o), Some(ix("open")));
        assert_eq!(taken_by("ctrl-k", ix("trash"), &o), None);
    }

    #[test]
    fn defaults_are_all_usable_and_distinct() {
        for s in &SHORTCUTS {
            assert!(usable(s.default).is_ok(), "{}", s.default);
        }
        let none = BTreeMap::new();
        let keys = resolve(&none);
        for (i, s) in SHORTCUTS.iter().enumerate() {
            assert_eq!(keys[i], s.default);
        }
    }

    #[test]
    fn keys_read_like_the_hints() {
        assert_eq!(pretty("ctrl-shift-c"), "ctrl shift c");
        assert_eq!(pretty("ctrl-delete"), "ctrl del");
        assert_eq!(pretty("ctrl-,"), "ctrl ,");
    }
}
