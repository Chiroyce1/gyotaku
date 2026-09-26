use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::time::{Duration, Instant};

use anyhow::{Result, bail};
use notify::event::{AccessKind, AccessMode, ModifyKind, RenameMode};
use notify::{Event, EventKind, RecursiveMode, Watcher};

use crate::indexer::{self, Indexer, Outcome};

// How long a file has to sit untouched before it gets read. Some tools write a
// screenshot in several passes, and reading a half written png just fails.
const SETTLE: Duration = Duration::from_millis(400);

struct Watch {
    indexer: Indexer,
    /// Files that changed recently, read once they've been quiet for SETTLE.
    pending: HashMap<PathBuf, Instant>,
    /// Files that were renamed away. inotify reports the old name first and
    /// only pairs it with the new one in a later event, so forgetting right
    /// away would throw out the text of a file that only moved.
    leaving: HashMap<PathBuf, Instant>,
}

pub fn run(dirs: &[PathBuf], threads: usize) -> Result<()> {
    indexer::become_idle();
    let mut w = Watch {
        indexer: Indexer::new(threads)?,
        pending: HashMap::new(),
        leaving: HashMap::new(),
    };

    for path in w.indexer.index.paths()? {
        if !path.exists() {
            w.indexer.forget(&path)?;
        }
    }

    let (tx, rx) = mpsc::channel();
    let mut watcher = notify::recommended_watcher(tx)?;
    for dir in dirs {
        watcher.watch(dir, RecursiveMode::Recursive)?;
        eprintln!("watching {}", dir.display());
    }

    let mut backlog: VecDeque<PathBuf> = indexer::scan(dirs).into();
    let mut caught_up = backlog.is_empty();

    loop {
        // Block for as long as there is nothing else to do.
        let wait = if !w.pending.is_empty() || !w.leaving.is_empty() {
            SETTLE
        } else if !backlog.is_empty() {
            Duration::ZERO
        } else {
            Duration::from_secs(3600)
        };
        match rx.recv_timeout(wait) {
            Ok(event) => w.on_event(event?),
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => bail!("file watcher stopped"),
        }
        while let Ok(event) = rx.try_recv() {
            w.on_event(event?);
        }

        for path in settled(&mut w.leaving) {
            if !path.exists() {
                forget(&mut w.indexer, &path);
            }
        }

        // Fresh screenshots jump the queue: the one you took just now is the
        // one you're about to look for, even while an old library backfills.
        let fresh = settled(&mut w.pending);
        if !fresh.is_empty() {
            for path in fresh.iter().filter(|p| p.is_file()) {
                index(&mut w.indexer, path);
            }
            continue;
        }

        if let Some(path) = backlog.pop_front() {
            index(&mut w.indexer, &path);
        } else if !caught_up {
            caught_up = true;
            eprintln!(
                "caught up, {} screenshots searchable",
                w.indexer.index.visible_len()?
            );
        }
    }
}

/// Takes out every entry that's been quiet for at least SETTLE.
fn settled(map: &mut HashMap<PathBuf, Instant>) -> Vec<PathBuf> {
    let now = Instant::now();
    let ready: Vec<PathBuf> = map
        .iter()
        .filter(|(_, t)| now.duration_since(**t) >= SETTLE)
        .map(|(p, _)| p.clone())
        .collect();
    for p in &ready {
        map.remove(p);
    }
    ready
}

impl Watch {
    fn on_event(&mut self, event: Event) {
        let now = Instant::now();
        let images = event.paths.iter().filter(|p| indexer::is_image(p));

        match event.kind {
            EventKind::Remove(_) => {
                for path in images {
                    self.pending.remove(path);
                    forget(&mut self.indexer, path);
                }
            }
            EventKind::Modify(ModifyKind::Name(RenameMode::From)) => {
                for path in images {
                    self.pending.remove(path);
                    self.leaving.insert(path.clone(), now);
                }
            }
            // A rename inside the watched folders, finally with both names.
            EventKind::Modify(ModifyKind::Name(RenameMode::Both)) if event.paths.len() == 2 => {
                let (from, to) = (&event.paths[0], &event.paths[1]);
                self.leaving.remove(from);
                if indexer::is_image(from) && indexer::is_image(to) {
                    match self.indexer.rename(from, to) {
                        Ok(true) => eprintln!("moved {} -> {}", from.display(), to.display()),
                        Ok(false) => {
                            self.pending.insert(to.clone(), now);
                        }
                        Err(e) => eprintln!("failed to move {}: {e:#}", from.display()),
                    }
                } else if indexer::is_image(from) {
                    forget(&mut self.indexer, from);
                } else if indexer::is_image(to) {
                    self.pending.insert(to.clone(), now);
                }
            }
            EventKind::Create(_)
            | EventKind::Modify(_)
            | EventKind::Access(AccessKind::Close(AccessMode::Write)) => {
                for path in images {
                    self.pending.insert(path.clone(), now);
                }
            }
            _ => {}
        }
    }
}

fn index(indexer: &mut Indexer, path: &Path) {
    match indexer.index_file(path) {
        Ok(Outcome::Indexed { lines, took }) => {
            eprintln!("indexed {} ({lines} lines, {took:.1?})", path.display());
        }
        Ok(Outcome::Hidden(why)) => eprintln!("skipped {}: {why}", path.display()),
        Ok(Outcome::Unchanged | Outcome::Thumbnail) => {}
        // One bad file shouldn't take the watcher down with it.
        Err(e) => eprintln!("failed {}: {e:#}", path.display()),
    }
}

fn forget(indexer: &mut Indexer, path: &Path) {
    match indexer.forget(path) {
        Ok(true) => eprintln!("forgot {}", path.display()),
        Ok(false) => {}
        Err(e) => eprintln!("failed to forget {}: {e:#}", path.display()),
    }
}
