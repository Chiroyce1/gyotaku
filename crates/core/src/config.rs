//! `~/.config/gyotaku/config.toml`, shared by the app (which writes it from
//! onboarding and settings) and the watcher (which follows it live).

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeChoice {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    /// Every image under these is read, subfolders included.
    pub folders: Vec<PathBuf>,
    pub theme: ThemeChoice,
    /// Cores one screenshot may use while being read.
    pub threads: usize,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            folders: pictures_dir().into_iter().collect(),
            theme: ThemeChoice::System,
            threads: 4,
        }
    }
}

impl Config {
    pub fn path() -> Result<PathBuf> {
        let dirs = directories::ProjectDirs::from("", "", "gyotaku")
            .context("could not work out a home directory")?;
        Ok(dirs.config_dir().join("config.toml"))
    }

    /// None before onboarding has ever been finished, which is how the app
    /// knows to show it.
    pub fn load() -> Result<Option<Self>> {
        Self::load_from(&Self::path()?)
    }

    /// The saved config, or the defaults if there isn't one yet.
    pub fn load_or_default() -> Self {
        Self::load().ok().flatten().unwrap_or_default()
    }

    pub fn load_from(path: &Path) -> Result<Option<Self>> {
        let text = match std::fs::read_to_string(path) {
            Ok(text) => text,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.into()),
        };
        let config =
            toml::from_str(&text).with_context(|| format!("reading {}", path.display()))?;
        Ok(Some(config))
    }

    pub fn save(&self) -> Result<()> {
        self.save_to(&Self::path()?)
    }

    pub fn save_to(&self, path: &Path) -> Result<()> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        // Written next to it and renamed over, so the watcher (which reloads
        // on every change) never reads half a file.
        let tmp = path.with_extension("toml.tmp");
        std::fs::write(&tmp, toml::to_string_pretty(self)?)?;
        std::fs::rename(&tmp, path)?;
        Ok(())
    }
}

pub fn pictures_dir() -> Option<PathBuf> {
    directories::UserDirs::new()
        .and_then(|d| d.picture_dir().map(Path::to_path_buf))
        .or_else(|| directories::BaseDirs::new().map(|d| d.home_dir().join("Pictures")))
}

/// `/home/you/Pictures` as `~/Pictures`, for showing to people.
pub fn tidy(path: &Path) -> String {
    let home = directories::BaseDirs::new().map(|d| d.home_dir().to_path_buf());
    match home.as_deref().and_then(|h| path.strip_prefix(h).ok()) {
        Some(rest) if rest.as_os_str().is_empty() => "~".into(),
        Some(rest) => format!("~/{}", rest.display()),
        None => path.display().to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("gyotaku-config-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir.join("config.toml")
    }

    #[test]
    fn missing_file_means_not_set_up_yet() {
        assert_eq!(Config::load_from(&scratch("missing")).unwrap(), None);
    }

    #[test]
    fn round_trips() {
        let path = scratch("round");
        let config = Config {
            folders: vec!["/a/b".into(), "/c".into()],
            theme: ThemeChoice::Dark,
            threads: 2,
        };
        config.save_to(&path).unwrap();
        assert_eq!(Config::load_from(&path).unwrap(), Some(config));
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn a_half_written_file_by_hand_still_loads() {
        let path = scratch("partial");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "theme = \"light\"\n").unwrap();
        let config = Config::load_from(&path).unwrap().unwrap();
        assert_eq!(config.theme, ThemeChoice::Light);
        assert_eq!(config.threads, 4);
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn home_is_shown_as_tilde() {
        let home = directories::BaseDirs::new()
            .unwrap()
            .home_dir()
            .to_path_buf();
        assert_eq!(tidy(&home.join("Pictures")), "~/Pictures");
        assert_eq!(tidy(&home), "~");
        assert_eq!(tidy(Path::new("/mnt/shots")), "/mnt/shots");
    }
}
