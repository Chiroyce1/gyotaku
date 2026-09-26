mod app;
mod grid;
mod images;
mod input;
mod spring;
mod theme;

use std::borrow::Cow;

use anyhow::Result;
use gpui::{
    App, AppContext, Bounds, KeyBinding, Size, TitlebarOptions, WindowBackgroundAppearance,
    WindowBounds, WindowKind, WindowOptions, px, size,
};
use gpui_platform::application;
use gyotaku_core::Index;

use app::Gyotaku;
use theme::Theme;

const FONTS: [&[u8]; 3] = [
    include_bytes!("../fonts/IBMPlexSans-Regular.ttf"),
    include_bytes!("../fonts/IBMPlexSans-Medium.ttf"),
    include_bytes!("../fonts/IBMPlexSans-SemiBold.ttf"),
];

fn main() -> Result<()> {
    // --window skips the overlay and opens an ordinary window, for desktops
    // without layer shell (GNOME) or just for poking at it.
    // gpui reports window and gpu trouble through `log`, RUST_LOG=warn shows it.
    env_logger::init();
    keep_big_allocations_off_the_heap();
    let windowed = std::env::args().any(|a| a == "--window");

    application().run(move |cx: &mut App| {
        cx.text_system()
            .add_fonts(FONTS.iter().map(|f| Cow::Borrowed(*f)).collect())
            .expect("the bundled fonts load");
        bind_keys(cx);

        let size = window_size(cx);
        let window = if windowed {
            None
        } else {
            open_overlay(size, cx)
        };
        let window = window.unwrap_or_else(|| open_window(size, cx));

        let _ = window.update(cx, |view, window, cx| {
            window.focus(&gpui::Focusable::focus_handle(view, cx), cx);
            cx.activate(true);
        });
    });
    Ok(())
}

/// A decoded thumbnail is ~0.5 MB. glibc normally raises its mmap threshold
/// after the first few of those are freed, and from then on puts them on the
/// heap, where scrolling through thousands of them fragments it for good.
/// Pinning the threshold keeps every image in its own mapping that goes back
/// to the kernel when freed: paging through 80 screens peaked at ~140 MB with
/// this and ~250 MB without.
fn keep_big_allocations_off_the_heap() {
    #[cfg(target_env = "gnu")]
    unsafe {
        libc::mallopt(libc::M_MMAP_THRESHOLD, 128 * 1024);
    }
}

fn bind_keys(cx: &mut App) {
    use app::*;
    use input::*;
    cx.bind_keys([
        KeyBinding::new("escape", Back, Some("Gyotaku")),
        KeyBinding::new("enter", Open, Some("Gyotaku")),
        KeyBinding::new("up", Up, Some("Gyotaku")),
        KeyBinding::new("down", Down, Some("Gyotaku")),
        KeyBinding::new("left", Left, Some("Gyotaku")),
        KeyBinding::new("right", Right, Some("Gyotaku")),
        KeyBinding::new("pageup", PageUp, Some("Gyotaku")),
        KeyBinding::new("pagedown", PageDown, Some("Gyotaku")),
        KeyBinding::new("ctrl-c", CopyText, Some("Gyotaku")),
        KeyBinding::new("ctrl-shift-c", CopyImage, Some("Gyotaku")),
        KeyBinding::new("ctrl-o", OpenExternal, Some("Gyotaku")),
        KeyBinding::new("ctrl-shift-o", Reveal, Some("Gyotaku")),
        KeyBinding::new("ctrl-q", Quit, Some("Gyotaku")),
        KeyBinding::new("backspace", Backspace, Some("TextInput")),
        KeyBinding::new("ctrl-backspace", DeleteWord, Some("TextInput")),
        KeyBinding::new("delete", Delete, Some("TextInput")),
        KeyBinding::new("ctrl-a", SelectAll, Some("TextInput")),
        KeyBinding::new("home", Home, Some("TextInput")),
        KeyBinding::new("end", End, Some("TextInput")),
        KeyBinding::new("ctrl-v", Paste, Some("TextInput")),
        KeyBinding::new("ctrl-x", Cut, Some("TextInput")),
    ]);
}

/// A generous palette, but never more than most of the screen.
fn window_size(cx: &App) -> Size<gpui::Pixels> {
    let screen = cx
        .primary_display()
        .map(|d| d.bounds().size)
        .unwrap_or(size(px(1920.), px(1080.)));
    size(
        px(1180.).min(screen.width * 0.86),
        px(780.).min(screen.height * 0.84),
    )
}

fn build(floating: bool, cx: &mut gpui::Context<Gyotaku>, window: &mut gpui::Window) -> Gyotaku {
    cx.set_global(Theme::for_appearance(window.appearance()));
    let index = Index::open_default().expect("the index opens");
    Gyotaku::new(index, floating, window, cx)
}

/// On Wayland compositors with layer shell (niri, sway, Hyprland, KDE) the
/// window floats above everything like a launcher, with no title bar and all
/// keyboard input going to it.
fn open_overlay(size: Size<gpui::Pixels>, cx: &mut App) -> Option<gpui::WindowHandle<Gyotaku>> {
    use gpui::layer_shell::*;
    std::env::var_os("WAYLAND_DISPLAY")?;
    cx.open_window(
        WindowOptions {
            titlebar: None,
            window_bounds: Some(WindowBounds::Windowed(Bounds::new(
                Default::default(),
                size,
            ))),
            app_id: Some("gyotaku".into()),
            window_background: WindowBackgroundAppearance::Transparent,
            kind: WindowKind::LayerShell(LayerShellOptions {
                namespace: "gyotaku".into(),
                layer: Layer::Overlay,
                keyboard_interactivity: KeyboardInteractivity::Exclusive,
                ..Default::default()
            }),
            ..Default::default()
        },
        |window, cx| cx.new(|cx| build(true, cx, window)),
    )
    .ok()
}

fn open_window(size: Size<gpui::Pixels>, cx: &mut App) -> gpui::WindowHandle<Gyotaku> {
    cx.open_window(
        WindowOptions {
            window_bounds: Some(WindowBounds::Windowed(Bounds::centered(None, size, cx))),
            titlebar: Some(TitlebarOptions {
                title: Some("gyotaku".into()),
                ..Default::default()
            }),
            app_id: Some("gyotaku".into()),
            ..Default::default()
        },
        |window, cx| cx.new(|cx| build(false, cx, window)),
    )
    .expect("a window opens")
}
