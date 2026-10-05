// No console window behind the app on Windows.
#![cfg_attr(windows, windows_subsystem = "windows")]

mod app;
mod grid;
#[cfg(windows)]
mod hotkey;
mod images;
mod input;
mod keys;
mod resident;
mod setup;
mod spring;
mod stats;
mod theme;

use std::borrow::Cow;

use anyhow::Result;
use futures::StreamExt as _;
use gpui::{
    App, AppContext, Bounds, Entity, Global, QuitMode, Size, TitlebarOptions,
    WindowBackgroundAppearance, WindowBounds, WindowKind, WindowOptions, px, size,
};
use gpui_platform::application;
use gyotaku_core::Index;

use app::Gyotaku;

const FONTS: [&[u8]; 3] = [
    include_bytes!("../fonts/IBMPlexSans-Regular.ttf"),
    include_bytes!("../fonts/IBMPlexSans-Medium.ttf"),
    include_bytes!("../fonts/IBMPlexSans-SemiBold.ttf"),
];

fn main() -> Result<()> {
    // gpui reports window and gpu trouble through `log`, RUST_LOG=warn shows it.
    env_logger::Builder::from_default_env()
        .format_timestamp_millis()
        .init();
    let args: Vec<String> = std::env::args().collect();
    // --window skips the overlay and opens an ordinary window, for desktops
    // without layer shell (GNOME) or just for poking at it. --once exits when
    // the window closes instead of staying resident.
    let windowed = args.iter().any(|a| a == "--window");
    let once = args.iter().any(|a| a == "--once");
    // --background starts resident without a window, which is how it's
    // started at login on Windows, to be ready for the summon key.
    let background = args.iter().any(|a| a == "--background");

    let address = resident::address();
    if !once && resident::wake(&address) {
        return Ok(());
    }
    let listener = if once {
        None
    } else {
        resident::listen(&address)
    };
    keep_big_allocations_off_the_heap();

    let quit_mode = if listener.is_some() {
        QuitMode::Explicit
    } else {
        QuitMode::LastWindowClosed
    };
    application()
        .with_quit_mode(quit_mode)
        .run(move |cx: &mut App| {
            cx.text_system()
                .add_fonts(FONTS.iter().map(|f| Cow::Borrowed(*f)).collect())
                .expect("the bundled fonts load");
            let config = gyotaku_core::Config::load_or_default();
            keys::bind_all(cx, &config.keys);
            cx.set_global(Launch {
                windowed,
                resident: listener.is_some(),
            });
            if !(background && listener.is_some()) {
                toggle(cx);
            }
            // Started at login, the watcher comes up with it, unless one
            // already is.
            #[cfg(windows)]
            setup::resume_background();

            // The view lives on for next time, but most of its thumbnails
            // don't need to. Hand the freed pages back so an idle gyotaku
            // stays small.
            cx.on_window_closed(|cx, _| {
                if let Some(view) = cx.try_global::<Kept>().map(|k| k.0.clone()) {
                    view.update(cx, |view, cx| view.hidden(cx));
                }
                release_memory();
            })
            .detach();

            let Some(listener) = listener else { return };
            let (knocks, mut knocked) = futures::channel::mpsc::unbounded();
            #[cfg(windows)]
            {
                let key = config.keys.get("summon").map_or(hotkey::DEFAULT, |k| k);
                if !hotkey::register(key, knocks.clone(), cx) {
                    log::warn!("couldn't register {key}, another program may be using it");
                }
            }
            std::thread::spawn(move || {
                for stream in listener.incoming() {
                    if stream.is_ok() && knocks.unbounded_send(()).is_err() {
                        break;
                    }
                }
            });
            cx.spawn(async move |cx| {
                while knocked.next().await.is_some() {
                    cx.update(toggle);
                }
            })
            .detach();
        });
    Ok(())
}

/// How this process was started, for the parts of the app that need to
/// close and reopen the window themselves.
struct Launch {
    windowed: bool,
    resident: bool,
}

impl Global for Launch {}

/// Whether closing the window leaves the process running.
pub(crate) fn is_resident(cx: &App) -> bool {
    cx.try_global::<Launch>().is_some_and(|l| l.resident)
}

/// Opens the search window, or closes it if it's already up, so one key
/// both summons and dismisses it.
fn toggle(cx: &mut App) {
    if let Some(open) = cx.windows().first().copied() {
        let _ = open.update(cx, |_, window, _| window.remove_window());
        return;
    }
    summon(cx);
}

/// Opens the window if it isn't open.
pub(crate) fn summon(cx: &mut App) {
    if !cx.windows().is_empty() {
        return;
    }
    let windowed = cx.try_global::<Launch>().is_some_and(|l| l.windowed);
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
}

fn release_memory() {
    #[cfg(all(target_os = "linux", target_env = "gnu"))]
    unsafe {
        libc::malloc_trim(0);
    }
}

/// A decoded thumbnail is ~0.5 MB. glibc normally raises its mmap threshold
/// after the first few of those are freed, and from then on puts them on the
/// heap, where scrolling through thousands of them fragments it for good.
/// Pinning the threshold keeps every image in its own mapping that goes back
/// to the kernel when freed: paging through 80 screens peaked at ~140 MB with
/// this and ~250 MB without.
fn keep_big_allocations_off_the_heap() {
    #[cfg(all(target_os = "linux", target_env = "gnu"))]
    unsafe {
        libc::mallopt(libc::M_MMAP_THRESHOLD, 128 * 1024);
    }
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

/// The one view, kept across windows so every summon picks up where the
/// last one left off.
struct Kept(Entity<Gyotaku>);

impl Global for Kept {}

fn root(floating: bool, window: &mut gpui::Window, cx: &mut App) -> Entity<Gyotaku> {
    if let Some(view) = cx.try_global::<Kept>().map(|k| k.0.clone()) {
        view.update(cx, |view, cx| view.reopen(window, cx));
        return view;
    }
    let index = Index::open_default().expect("the index opens");
    let view = cx.new(|cx| Gyotaku::new(index, floating, window, cx));
    cx.set_global(Kept(view.clone()));
    view
}

/// On Windows, a borderless window that stays on top and out of the taskbar,
/// centred on the screen, the way a launcher sits.
#[cfg(windows)]
fn open_overlay(size: Size<gpui::Pixels>, cx: &mut App) -> Option<gpui::WindowHandle<Gyotaku>> {
    cx.open_window(
        WindowOptions {
            titlebar: None,
            window_bounds: Some(WindowBounds::Windowed(Bounds::centered(None, size, cx))),
            app_id: Some("gyotaku".into()),
            window_background: WindowBackgroundAppearance::Transparent,
            kind: WindowKind::PopUp,
            ..Default::default()
        },
        |window, cx| root(true, window, cx),
    )
    .ok()
}

/// On Wayland compositors with layer shell (niri, sway, Hyprland, KDE) the
/// window floats above everything like a launcher, with no title bar and all
/// keyboard input going to it.
#[cfg(not(windows))]
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
        |window, cx| root(true, window, cx),
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
        |window, cx| root(false, window, cx),
    )
    .expect("a window opens")
}
