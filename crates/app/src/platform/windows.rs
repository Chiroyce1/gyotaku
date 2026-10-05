//! Windows: a borderless popup above everything, summoned by a global hotkey
//! the app registers itself, started at sign-in from the Run key.
//!
//! The reader (`gyotaku.exe watch`) is started by the app, hidden, whenever
//! the app runs and isn't already reading. It holds a lock file while it
//! runs, which is how the app knows.

use std::collections::BTreeMap;
use std::fs::File;
use std::io::Write as _;
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::os::windows::process::CommandExt as _;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use futures::channel::mpsc::UnboundedSender;
use global_hotkey::hotkey::HotKey;
use global_hotkey::{GlobalHotKeyEvent, GlobalHotKeyManager, HotKeyState};
use gpui::{
    App, Bounds, ClipboardItem, Entity, Global, Image, ImageFormat, Size, Window,
    WindowBackgroundAppearance, WindowBounds, WindowHandle, WindowKind, WindowOptions,
};

use super::{Service, Words};
use crate::app::Gyotaku;

pub const WORDS: Words = Words {
    background_setting: "start with windows",
    background_title: "start with windows?",
    background_body: "so it's ready the moment you need it, and a screenshot you take now is searchable a second later.",
    background_yes: (
        "yes, start with windows",
        "it waits hidden after you sign in, ready for alt shift s, and reads each new screenshot about a second after you take it",
    ),
    background_no: (
        "no, only when i open it",
        "open it from the Start menu, it reads new screenshots while it's running",
    ),
    chose_no: "reading your screenshots, they show up here as they're read",
    default_folder: "where Windows saves screenshots",
    copy_image_failed: "couldn't copy the image",
};

// Staying resident. std has no unix sockets on Windows, so the running copy
// listens on a loopback port and leaves the number in a file. The worst
// anyone else on the machine could do with it is open or close the window.

pub struct Listener {
    tcp: TcpListener,
    /// Held while this process lives, so a second one starting at the same
    /// moment can't also become the resident.
    _lock: File,
}

impl Listener {
    pub fn incoming(&self) -> std::net::Incoming<'_> {
        self.tcp.incoming()
    }
}

pub fn resident_address() -> PathBuf {
    gyotaku_core::data_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("resident.port")
}

pub fn wake(port_file: &Path) -> bool {
    let Some(port) = std::fs::read_to_string(port_file)
        .ok()
        .and_then(|p| p.trim().parse::<u16>().ok())
    else {
        return false;
    };
    let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    match TcpStream::connect_timeout(&addr, Duration::from_millis(300)) {
        Ok(mut stream) => stream.write_all(b"toggle\n").is_ok(),
        Err(_) => false,
    }
}

pub fn listen(port_file: &Path) -> Option<Listener> {
    let dir = port_file.parent()?;
    std::fs::create_dir_all(dir).ok()?;
    let lock = File::create(dir.join("resident.lock")).ok()?;
    lock.try_lock().ok()?;
    let tcp = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).ok()?;
    let port = tcp.local_addr().ok()?.port();
    std::fs::write(port_file, port.to_string()).ok()?;
    Some(Listener { tcp, _lock: lock })
}

// The window.

/// A borderless window that stays on top and out of the taskbar, centred on
/// the screen, the way a launcher sits.
pub fn open_launcher(
    size: Size<gpui::Pixels>,
    cx: &mut App,
    build: impl FnOnce(&mut Window, &mut App) -> Entity<Gyotaku> + 'static,
) -> Option<WindowHandle<Gyotaku>> {
    cx.open_window(
        WindowOptions {
            titlebar: None,
            window_bounds: Some(WindowBounds::Windowed(Bounds::centered(None, size, cx))),
            app_id: Some("gyotaku".into()),
            window_background: WindowBackgroundAppearance::Transparent,
            kind: WindowKind::PopUp,
            ..Default::default()
        },
        build,
    )
    .ok()
}

/// A popup that stays on top of everything has to be put away when you
/// click elsewhere, like the Start menu.
pub fn hides_when_inactive() -> bool {
    true
}

/// Win+S is Windows search and Win+Shift+S the Snipping Tool, so the
/// default stays clear of the Windows key.
const SUMMON: &str = "alt-shift-s";

/// Kept alive for as long as the app runs; dropping it unregisters the key.
struct Summon(#[allow(dead_code)] GlobalHotKeyManager);

impl Global for Summon {}

/// Windows has no way for the desktop to run a command on a key, so the
/// resident process registers the key itself, and each press sends the same
/// knock a second launch would. If another program holds the key, opening
/// gyotaku from the Start menu still works.
pub fn register_summon(knocks: UnboundedSender<()>, keys: &BTreeMap<String, String>, cx: &mut App) {
    let key = keys.get("summon").map_or(SUMMON, String::as_str);
    let registered = (|| {
        let hotkey = key.replace('-', "+").parse::<HotKey>().ok()?;
        let manager = GlobalHotKeyManager::new().ok()?;
        manager.register(hotkey).ok()?;
        Some(manager)
    })();
    let Some(manager) = registered else {
        log::warn!("couldn't register {key}, another program may be using it");
        return;
    };
    GlobalHotKeyEvent::set_event_handler(Some(move |e: GlobalHotKeyEvent| {
        if e.state == HotKeyState::Pressed {
            let _ = knocks.unbounded_send(());
        }
    }));
    cx.set_global(Summon(manager));
}

// The clipboard. Windows keeps its own copy of whatever is put there, so it
// outlives the window without any help.

pub fn copy_text(text: &str, cx: &mut App) {
    cx.write_to_clipboard(ClipboardItem::new_string(text.to_owned()));
}

pub fn copy_image(path: &Path, cx: &mut App) -> bool {
    let format = match path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("jpg" | "jpeg") => ImageFormat::Jpeg,
        Some("webp") => ImageFormat::Webp,
        _ => ImageFormat::Png,
    };
    let Ok(bytes) = std::fs::read(path) else {
        return false;
    };
    cx.write_to_clipboard(ClipboardItem::new_image(&Image::from_bytes(format, bytes)));
    true
}

// Memory. The Windows heap hands freed pages back by itself.

pub fn tune_allocator() {}

pub fn release_memory() {}

// Reading in the background. The switch in settings is "start with Windows";
// new screenshots are read whenever gyotaku runs either way, because nobody
// on Windows is going to start a reader from a terminal.

const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;

pub fn background_status(service: Service, _searchable: usize) -> String {
    match service {
        Service::Running => "on, waits hidden after you sign in".into(),
        Service::Stopped => "off, open it from the Start menu".into(),
    }
}

pub fn service_status() -> Service {
    if starts_at_sign_in() {
        Service::Running
    } else {
        Service::Stopped
    }
}

pub fn start_service() -> bool {
    let Ok(app) = std::env::current_exe() else {
        return false;
    };
    let command = format!("\"{}\" --background", app.display());
    let registered = hidden("reg")
        .args([
            "add", RUN_KEY, "/v", "gyotaku", "/t", "REG_SZ", "/d", &command, "/f",
        ])
        .status()
        .is_ok_and(|s| s.success());
    start_reader();
    registered
}

pub fn stop_service() -> bool {
    hidden("reg")
        .args(["delete", RUN_KEY, "/v", "gyotaku", "/f"])
        .status()
        .is_ok_and(|s| s.success())
}

/// Every start of the app (at sign-in, or from the Start menu) brings the
/// reader up, once there's a config saying what to read. Off the main
/// thread, since starting a process takes a moment.
pub fn on_launch() {
    std::thread::spawn(|| {
        if matches!(gyotaku_core::Config::load(), Ok(Some(_))) {
            start_reader();
        }
    });
}

/// Saying no to starting with Windows still reads while gyotaku is open.
pub fn keep_reading() {
    std::thread::spawn(start_reader);
}

fn start_reader() {
    if gyotaku_core::status::reader_running() {
        return;
    }
    let mut reader = hidden(&crate::setup::cli_path());
    reader
        .arg("watch")
        .creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
    // It runs with no console, so what it says goes to a file, kept short.
    if let Some(log) = reader_log() {
        if let Ok(err) = log.try_clone() {
            reader.stderr(err);
        }
        reader.stdout(log);
    }
    let _ = reader.spawn();
}

/// `watch.log` next to the index, started over once it passes 1 MB.
fn reader_log() -> Option<File> {
    let path = gyotaku_core::data_dir().ok()?.join("watch.log");
    let big = std::fs::metadata(&path).is_ok_and(|m| m.len() > 1 << 20);
    std::fs::OpenOptions::new()
        .create(true)
        .append(!big)
        .write(true)
        .truncate(big)
        .open(path)
        .ok()
}

/// reg and the reader are console programs. Started from a window app each
/// would flash a console up, so they get none.
fn hidden(program: &str) -> Command {
    let mut command = Command::new(program);
    command
        .creation_flags(CREATE_NO_WINDOW)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    command
}

fn starts_at_sign_in() -> bool {
    hidden("reg")
        .args(["query", RUN_KEY, "/v", "gyotaku"])
        .status()
        .is_ok_and(|s| s.success())
}

// Screenshot folders. Win+PrtScn and the Snipping Tool save to
// Pictures\Screenshots, which the shared defaults already offer.

/// Game Bar (Win+Alt+PrtScn, and what most PC games' capture key goes
/// through) and ShareX each have a folder of their own.
pub fn tool_folders(home: &Path) -> Vec<PathBuf> {
    let documents = directories::UserDirs::new()
        .and_then(|d| d.document_dir().map(Path::to_path_buf))
        .unwrap_or_else(|| home.join("Documents"));
    let videos = directories::UserDirs::new()
        .and_then(|d| d.video_dir().map(Path::to_path_buf))
        .unwrap_or_else(|| home.join("Videos"));
    vec![
        videos.join("Captures"),
        documents.join("ShareX").join("Screenshots"),
    ]
}
