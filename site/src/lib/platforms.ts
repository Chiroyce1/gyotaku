// What the /mac, /windows and /linux pages say. Every fact here comes from the
// README, install.sh, install.ps1 or docs/, so keep it in step with those.

const INSTALL_SH = "curl -fsSL https://raw.githubusercontent.com/xevrion/gyotaku/main/install.sh | sh";
const INSTALL_PS = "irm https://raw.githubusercontent.com/xevrion/gyotaku/main/install.ps1 | iex";
const DOWNLOAD = "https://github.com/xevrion/gyotaku/releases/latest/download";

export type Slug = "mac" | "windows" | "linux";

export type Section = {
  title: string;
  /** Paragraphs of plain text. `code` spans are written as `like this`. */
  body: string[];
  /** Optional rows, shown as a two column list. */
  rows?: [string, string][];
  /** Optional commands, each in a copyable box. */
  commands?: { prompt: string; command: string; label?: string }[];
};

export type Platform = {
  slug: Slug;
  /** The system's name as people write it. */
  name: string;
  /** The page title, for search results and tabs. */
  title: string;
  description: string;
  h1: string;
  lede: string;
  prompt: string;
  command: string;
  commandNote: string;
  /** Downloads offered beside the command. */
  downloads?: { label: string; href: string }[];
  sections: Section[];
};

export const PLATFORMS: Record<Slug, Platform> = {
  mac: {
    slug: "mac",
    name: "macOS",
    title: "gyotaku for Mac: search your screenshots by text",
    description:
      "Find any screenshot on your Mac by typing a word you remember. gyotaku reads the text in your screenshots on your Mac, offline. Free and open source, for Apple Silicon Macs.",
    h1: "Search your screenshots on Mac",
    lede: "Screenshots on a Mac pile up on the Desktop with names like Screenshot 2026-10-06 at 14.02. gyotaku reads the text in each one, on your Mac, so pressing Option+Shift+S and typing a word you remember brings the right one back.",
    prompt: "$",
    command: INSTALL_SH,
    commandNote: "Paste it into Terminal. No admin rights needed. Apple Silicon Macs (M1 and later).",
    sections: [
      {
        title: "What gets installed",
        body: [
          "The installer downloads the release for Apple Silicon, checks its SHA-256 checksum and puts `gyotaku` and `gyotaku-app` in `~/.local/bin`, with ONNX Runtime beside them.",
          "It also adds `gyotaku.app` to `~/Applications`, so Spotlight and Launchpad can open it.",
        ],
      },
      {
        title: "How it runs",
        body: [
          "Like Raycast, gyotaku has no Dock icon. While it waits it sits in the menu bar, whose menu opens the search window or settings, and is where you quit it.",
          "Option+Shift+S (shown as Alt+Shift+S) opens the search window anywhere and closes it again. The key can be changed in settings. Cmd+W and Cmd+Q in the window just put it away.",
          "Turn on start at login in settings to read new screenshots in the background after a restart. It installs a launchd agent.",
        ],
      },
      {
        title: "Folders and permissions",
        body: [
          "On first run you pick the folders your screenshots are saved to. Desktop, Documents and Downloads are protected by macOS. If macOS stops gyotaku from reading one, gyotaku says so, and you can allow it in System Settings > Privacy & Security > Files and Folders.",
        ],
      },
      {
        title: "Where your data lives",
        body: ["Everything stays on your Mac, and gyotaku never changes or deletes your screenshots."],
        rows: [
          ["Settings, index, models", "~/Library/Application Support/gyotaku"],
          ["Thumbnails", "~/Library/Caches/gyotaku"],
        ],
      },
      {
        title: "Updating and uninstalling",
        body: [
          "Run the install command again to update. The index, settings and thumbnails are kept.",
          "To remove the programs, run the same script with `--uninstall`. It prints how to also remove the index and settings.",
        ],
        commands: [{ prompt: "$", command: `${INSTALL_SH} -s -- --uninstall`, label: "Uninstall" }],
      },
      {
        title: "Intel Macs",
        body: [
          "Microsoft publishes no ONNX Runtime build for Intel Macs, so the release only covers Apple Silicon. Intel Macs can build gyotaku from source with `ORT_DYLIB_PATH` pointing at an ONNX Runtime library; the README has the steps.",
          "Saving images you copy (without saving them as files) works on Linux and Windows, and is not on macOS yet.",
        ],
      },
    ],
  },

  windows: {
    slug: "windows",
    name: "Windows",
    title: "gyotaku for Windows: search your screenshots by text",
    description:
      "Find any screenshot on Windows by typing a word you remember. gyotaku reads the text in your screenshots on your PC, offline. Free and open source, for Windows 10 and 11.",
    h1: "Search your screenshots on Windows",
    lede: "Win+PrtScn and the Snipping Tool fill Pictures\\Screenshots with files nobody can search. gyotaku reads the text in each one on your PC, so pressing Alt+Shift+S and typing a word you remember brings the right one back.",
    prompt: "PS>",
    command: INSTALL_PS,
    commandNote: "Paste it into PowerShell. No administrator rights needed. Windows 10 and 11.",
    downloads: [{ label: "Download the setup (.exe)", href: `${DOWNLOAD}/gyotaku-setup-x86_64.exe` }],
    sections: [
      {
        title: "What gets installed",
        body: [
          "The command installs gyotaku to `%LOCALAPPDATA%\\Programs\\gyotaku`, adds it to the Start menu and opens it. Windows 10 and 11 on x64 are supported; ARM64 runs the x64 build through emulation.",
          "Prefer a regular installer? The setup installs the same files to the same folder, also without administrator rights, and lists gyotaku in Settings > Apps. It isn't code-signed yet, so SmartScreen may warn about an unknown publisher: choose More info, then Run anyway.",
        ],
      },
      {
        title: "How it runs",
        body: [
          "Alt+Shift+S opens the search window anywhere and closes it again. The key can be changed in settings.",
          "While it waits, gyotaku sits in the notification area: click its icon to open the window, right-click it for settings or to quit. The window never takes a taskbar button, and Alt+F4 just puts it away.",
          "On first run it suggests Pictures\\Screenshots, where Win+PrtScn and the Snipping Tool save, and can start when you sign in so new screenshots are read in the background.",
        ],
      },
      {
        title: "Where your data lives",
        body: ["Everything stays on your PC, and gyotaku never changes or deletes your screenshots."],
        rows: [
          ["Programs", "%LOCALAPPDATA%\\Programs\\gyotaku"],
          ["Settings", "%APPDATA%\\gyotaku"],
          ["Index", "%LOCALAPPDATA%\\gyotaku"],
        ],
      },
      {
        title: "Updating and uninstalling",
        body: [
          "Run the install command again, or the newest setup, to update. The two update each other's installs, and the index and settings are kept.",
          "Installed with the setup, gyotaku can be uninstalled from Settings > Apps, which asks whether to delete the index and settings too. Otherwise:",
        ],
        commands: [{ prompt: "PS>", command: `$env:GYOTAKU_UNINSTALL = 1; ${INSTALL_PS}`, label: "Uninstall" }],
      },
    ],
  },

  linux: {
    slug: "linux",
    name: "Linux",
    title: "gyotaku for Linux: search your screenshots by text",
    description:
      "Find any screenshot on Linux by typing a word you remember. gyotaku reads the text in your screenshots locally, on Wayland and X11. Free and open source, with .deb and .rpm packages.",
    h1: "Search your screenshots on Linux",
    lede: "Flameshot, Spectacle, grim or niri: whichever tool takes them, the screenshots end up as images nothing can search. gyotaku reads the text in each one on your machine, so a shortcut and a word you remember bring the right one back.",
    prompt: "$",
    command: INSTALL_SH,
    commandNote: "No root needed. x86_64 and arm64, on any distro with glibc 2.35 or newer.",
    downloads: [
      { label: ".deb for Debian and Ubuntu", href: `${DOWNLOAD}/gyotaku-x86_64-linux.deb` },
      { label: ".rpm for Fedora and openSUSE", href: `${DOWNLOAD}/gyotaku-x86_64-linux.rpm` },
    ],
    sections: [
      {
        title: "What gets installed",
        body: [
          "The script downloads the release for your machine, checks its SHA-256 checksum and installs `gyotaku` and `gyotaku-app` to `~/.local/bin`, with an entry in your app launcher. It changes nothing outside your home directory.",
          "Release builds run on Ubuntu 22.04, Debian 12, Fedora 36, Linux Mint 21, Pop!_OS 22.04 and later, as well as Kali, Arch Linux and openSUSE Tumbleweed, on Wayland and X11. The .deb and .rpm install to `/usr/bin` through your package manager (use the aarch64 files on ARM).",
        ],
        commands: [
          {
            prompt: "$",
            command: `curl -fsSLO ${DOWNLOAD}/gyotaku-x86_64-linux.deb && sudo apt install ./gyotaku-x86_64-linux.deb`,
            label: "Debian, Ubuntu",
          },
          { prompt: "$", command: `sudo dnf install ${DOWNLOAD}/gyotaku-x86_64-linux.rpm`, label: "Fedora" },
        ],
      },
      {
        title: "A keyboard shortcut",
        body: [
          "`gyotaku-app` opens the search window, and running it again closes it. Bind it to a key in your desktop's settings, using the full path `~/.local/bin/gyotaku-app`:",
        ],
        rows: [
          ["GNOME", "Settings > Keyboard > View and Customize Shortcuts > Custom Shortcuts"],
          ["KDE Plasma", "System Settings > Keyboard > Shortcuts > Add New > Command or Script"],
          ["Xfce", "Settings > Keyboard > Application Shortcuts > Add"],
          ["Cinnamon", "System Settings > Keyboard > Shortcuts > Custom Shortcuts"],
          ["sway, i3", "bindsym $mod+s exec ~/.local/bin/gyotaku-app"],
          ["Hyprland", "bind = SUPER, S, exec, ~/.local/bin/gyotaku-app"],
          ["niri", "Mod+S { spawn \"~/.local/bin/gyotaku-app\"; }"],
        ],
      },
      {
        title: "How it runs",
        body: [
          "On first run it suggests the folders of common screenshot tools (Flameshot, Spectacle, ksnip, grim, Hyprshot, niri) along with ~/Pictures/Screenshots, with the number of images in each.",
          "To read new screenshots in the background it installs a systemd user service, or an XDG autostart entry on systems without systemd. Saving images you copy without saving them is optional and needs wl-clipboard on Wayland or xclip on X11.",
        ],
      },
      {
        title: "Where your data lives",
        body: ["Everything stays on your machine, and gyotaku never changes or deletes your screenshots."],
        rows: [
          ["Settings", "~/.config/gyotaku/config.toml"],
          ["Index, models, runtime", "~/.local/share/gyotaku"],
          ["Thumbnails", "~/.cache/gyotaku/thumbs"],
        ],
      },
      {
        title: "Updating and uninstalling",
        body: [
          "Run the install command again to update; the background reader restarts on the new version and the index is kept. The .deb and .rpm don't update on their own yet.",
          "To remove it, run the script with `--uninstall`, then remove the keyboard shortcut yourself.",
        ],
        commands: [{ prompt: "$", command: `${INSTALL_SH} -s -- --uninstall`, label: "Uninstall" }],
      },
    ],
  },
};

export const SLUGS = Object.keys(PLATFORMS) as Slug[];
