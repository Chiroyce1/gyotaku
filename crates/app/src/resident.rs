//! Staying resident between searches.
//!
//! Most of a cold start is not ours. Our side is ready in about 60 ms, but
//! setting up the gpu (enumerating adapters, probing the GL driver, testing
//! the device) costs another 300 to 800 ms on this Nvidia laptop, and that's
//! far too slow for something bound to a key. So the first launch keeps the
//! process around after its window closes, and later launches just knock and
//! leave. The warm process opens a window in a few frames.

pub use imp::*;

#[cfg(unix)]
mod imp {
    use std::io::Write as _;
    use std::os::unix::net::{UnixListener, UnixStream};
    use std::path::PathBuf;

    pub type Listener = UnixListener;

    pub fn address() -> PathBuf {
        match std::env::var_os("XDG_RUNTIME_DIR") {
            Some(dir) => PathBuf::from(dir).join("gyotaku.sock"),
            None => {
                std::env::temp_dir().join(format!("gyotaku-{}.sock", unsafe { libc::getuid() }))
            }
        }
    }

    /// Asks a running instance to toggle its window. False if there isn't one.
    pub fn wake(socket: &PathBuf) -> bool {
        match UnixStream::connect(socket) {
            Ok(mut stream) => stream.write_all(b"toggle\n").is_ok(),
            Err(_) => false,
        }
    }

    /// Becomes the running instance. None if another process won the race
    /// to the socket, in which case this one just runs once and exits.
    pub fn listen(socket: &PathBuf) -> Option<Listener> {
        // Left behind by an instance that crashed or was killed, nobody
        // answered `wake` so nobody is using it.
        let _ = std::fs::remove_file(socket);
        UnixListener::bind(socket).ok()
    }
}

/// Windows has no unix sockets in std, so the running instance listens on a
/// loopback port and leaves the number in a file. The worst anyone else on
/// the machine could do with it is open or close the window.
#[cfg(windows)]
mod imp {
    use std::fs::File;
    use std::io::Write as _;
    use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
    use std::path::PathBuf;
    use std::time::Duration;

    pub struct Listener {
        tcp: TcpListener,
        /// Held while this process lives, so a second one starting at the
        /// same moment can't also become the resident.
        _lock: File,
    }

    impl Listener {
        pub fn incoming(&self) -> std::net::Incoming<'_> {
            self.tcp.incoming()
        }
    }

    pub fn address() -> PathBuf {
        gyotaku_core::data_dir()
            .unwrap_or_else(|_| std::env::temp_dir())
            .join("resident.port")
    }

    pub fn wake(port_file: &PathBuf) -> bool {
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

    pub fn listen(port_file: &PathBuf) -> Option<Listener> {
        let dir = port_file.parent()?;
        std::fs::create_dir_all(dir).ok()?;
        let lock = File::create(dir.join("resident.lock")).ok()?;
        lock.try_lock().ok()?;
        let tcp = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).ok()?;
        let port = tcp.local_addr().ok()?.port();
        std::fs::write(port_file, port.to_string()).ok()?;
        Some(Listener { tcp, _lock: lock })
    }
}
