#!/bin/sh
# Installs gyotaku from the latest release, or updates it.
#
#   curl -fsSL https://raw.githubusercontent.com/xevrion/gyotaku/main/install.sh | sh
#
# It downloads the build for this machine, checks it against the published
# checksum, and puts gyotaku and gyotaku-app in ~/.local/bin. No root, and
# nothing outside your home folder is touched.
#
#   sh install.sh --uninstall    removes it again (your screenshots are never touched)
#
# Environment:
#   GYOTAKU_INSTALL_DIR   where the programs go (default ~/.local/bin)
#   GYOTAKU_NO_LAUNCH=1   don't open gyotaku after a first install

set -eu

REPO="xevrion/gyotaku"
BIN_DIR="${GYOTAKU_INSTALL_DIR:-$HOME/.local/bin}"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"

if [ -t 1 ]; then
    bold=$(printf '\033[1m')
    dim=$(printf '\033[2m')
    red=$(printf '\033[31m')
    reset=$(printf '\033[0m')
else
    bold=""
    dim=""
    red=""
    reset=""
fi

say() { printf '%s\n' "$*"; }
step() { printf '%s\n' "${bold}$*${reset}"; }
fail() {
    printf '%s\n' "${red}gyotaku: $*${reset}" >&2
    exit 1
}

has() { command -v "$1" >/dev/null 2>&1; }

download() {
    if has curl; then
        curl -fsSL --proto '=https' --tlsv1.2 -o "$2" "$1"
    elif has wget; then
        wget -q --https-only -O "$2" "$1"
    else
        fail "needs curl or wget to download"
    fi
}

sha256() {
    if has sha256sum; then
        sha256sum "$1" | cut -d' ' -f1
    elif has shasum; then
        shasum -a 256 "$1" | cut -d' ' -f1
    else
        fail "needs sha256sum or shasum to check the download"
    fi
}

stop_background() {
    if has systemctl && systemctl --user is-enabled gyotaku-watch.service >/dev/null 2>&1; then
        systemctl --user disable --now gyotaku-watch.service >/dev/null 2>&1 || true
    fi
    rm -f "$CONFIG_HOME/systemd/user/gyotaku-watch.service" "$CONFIG_HOME/autostart/gyotaku-watch.desktop"
    has systemctl && systemctl --user daemon-reload >/dev/null 2>&1 || true
    if has pkill; then
        pkill -x gyotaku-app 2>/dev/null || true
        pkill -f "gyotaku watch" 2>/dev/null || true
    fi
}

APP_ID="dev.xevrion.gyotaku"
ICON_SIZES="16x16 24x24 32x32 48x48 64x64 128x128 256x256 512x512"

refresh_menus() {
    has update-desktop-database && update-desktop-database -q "$DATA_HOME/applications" 2>/dev/null || true
    has gtk-update-icon-cache && gtk-update-icon-cache -q -t "$DATA_HOME/icons/hicolor" 2>/dev/null || true
}

remove_menu_entry() {
    rm -f "$DATA_HOME/applications/$APP_ID.desktop" "$DATA_HOME/icons/hicolor/scalable/apps/$APP_ID.svg"
    for size in $ICON_SIZES; do
        rm -f "$DATA_HOME/icons/hicolor/$size/apps/$APP_ID.png"
    done
    refresh_menus
}

uninstall() {
    step "Removing gyotaku"
    stop_background
    rm -f "$BIN_DIR/gyotaku" "$BIN_DIR/gyotaku-app"
    remove_menu_entry
    say "Removed the programs from $BIN_DIR."
    say ""
    say "Your screenshots were not touched. The index, settings and thumbnails are"
    say "still there in case you come back. To remove those too:"
    say "  rm -rf $CONFIG_HOME/gyotaku $DATA_HOME/gyotaku $CACHE_HOME/gyotaku"
    say ""
    say "Remember to remove the keyboard shortcut you set up for gyotaku-app."
}

if [ "${1:-}" = "--uninstall" ]; then
    uninstall
    exit 0
fi

# What this machine is.
[ "$(uname -s)" = "Linux" ] ||
    fail "this installer is for Linux. On Windows, see https://github.com/$REPO#windows"
case "$(uname -m)" in
    x86_64 | amd64) arch=x86_64 ;;
    aarch64 | arm64) arch=aarch64 ;;
    *) fail "there's no build for $(uname -m) yet, see https://github.com/$REPO#build-from-source" ;;
esac

# The release builds need glibc 2.35 or newer (Ubuntu 22.04, Debian 12,
# Fedora 36 and anything since). musl systems like Alpine need a build from
# source.
glibc=$(ldd --version 2>&1 | head -n1 | grep -oE '[0-9]+\.[0-9]+$' || true)
if [ -z "$glibc" ]; then
    fail "this system doesn't use glibc, see https://github.com/$REPO#build-from-source"
fi
major=${glibc%%.*}
minor=${glibc#*.}
if [ "$major" -lt 2 ] || { [ "$major" -eq 2 ] && [ "$minor" -lt 35 ]; }; then
    fail "glibc $glibc is older than the 2.35 the release needs, see https://github.com/$REPO#build-from-source"
fi

first_install=true
[ -f "$CONFIG_HOME/gyotaku/config.toml" ] && first_install=false

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM

name="gyotaku-$arch-linux"
base="https://github.com/$REPO/releases/latest/download"
step "Downloading gyotaku for $arch Linux"
download "$base/$name.tar.gz" "$tmp/$name.tar.gz" || fail "couldn't download $base/$name.tar.gz"
download "$base/$name.tar.gz.sha256" "$tmp/$name.tar.gz.sha256" || fail "couldn't download the checksum"

expected=$(cut -d' ' -f1 <"$tmp/$name.tar.gz.sha256")
actual=$(sha256 "$tmp/$name.tar.gz")
[ "$expected" = "$actual" ] || fail "the download doesn't match its checksum, nothing was installed"

tar -xzf "$tmp/$name.tar.gz" -C "$tmp"

step "Installing to $BIN_DIR"
mkdir -p "$BIN_DIR"
# Each file is written beside its target and renamed over it, so a running
# copy keeps working and a failed install never leaves half a program.
for bin in gyotaku gyotaku-app; do
    cp "$tmp/$name/$bin" "$BIN_DIR/.$bin.new"
    chmod 755 "$BIN_DIR/.$bin.new"
    mv -f "$BIN_DIR/.$bin.new" "$BIN_DIR/$bin"
done

# The menu entry and icon, so gyotaku shows up in the app launcher. Its Exec
# is the full path, since launchers don't all search ~/.local/bin. Releases
# before 0.1.3 didn't carry these.
share="$tmp/$name/share"
if [ -f "$share/applications/$APP_ID.desktop" ]; then
    mkdir -p "$DATA_HOME/applications"
    sed "s|^Exec=gyotaku-app|Exec=$BIN_DIR/gyotaku-app|" "$share/applications/$APP_ID.desktop" \
        >"$DATA_HOME/applications/$APP_ID.desktop"
    for icon in "$share"/icons/hicolor/*/apps/*; do
        dest="$DATA_HOME/${icon#"$share"/}"
        mkdir -p "$(dirname "$dest")"
        cp "$icon" "$dest"
    done
    refresh_menus
fi

# A background reader set up by an earlier install whose program is gone
# (a build from source that was uninstalled, say) would fail every 30
# seconds forever, so it's pointed at this one. One that still works is
# left alone.
unit="$CONFIG_HOME/systemd/user/gyotaku-watch.service"
if [ -f "$unit" ]; then
    runs=$(sed -n 's/^ExecStart=\([^ ]*\).*/\1/p' "$unit" | sed "s|%h|$HOME|")
    if [ -n "$runs" ] && [ ! -x "$runs" ]; then
        sed -i "s|^ExecStart=.*|ExecStart=$BIN_DIR/gyotaku watch|" "$unit"
        if has systemctl && systemctl --user is-enabled gyotaku-watch.service >/dev/null 2>&1; then
            systemctl --user daemon-reload || true
            systemctl --user restart gyotaku-watch.service || true
        fi
        say "Pointed the background reader at the new install."
    fi
fi
autostart="$CONFIG_HOME/autostart/gyotaku-watch.desktop"
if [ -f "$autostart" ]; then
    runs=$(sed -n 's/^Exec=\([^ ]*\).*/\1/p' "$autostart")
    if [ -n "$runs" ] && [ ! -x "$runs" ]; then
        sed -i "s|^Exec=.*|Exec=$BIN_DIR/gyotaku watch|" "$autostart"
    fi
fi

# An update: the old window process and background reader are still the old
# version, so they're restarted onto the new one.
if [ "$first_install" = false ]; then
    has pkill && pkill -x gyotaku-app 2>/dev/null || true
    if has systemctl && systemctl --user is-active gyotaku-watch.service >/dev/null 2>&1; then
        systemctl --user restart gyotaku-watch.service || true
    fi
fi

version=$("$BIN_DIR/gyotaku" --version 2>/dev/null || echo gyotaku)
say "Installed $version."

# Libraries the window needs that every desktop has, unless this is a
# server or a very bare install.
missing=""
ldconfig=$(command -v ldconfig || { [ -x /sbin/ldconfig ] && echo /sbin/ldconfig; } || true)
if [ -n "$ldconfig" ]; then
    libs=$("$ldconfig" -p 2>/dev/null || true)
    for lib in libxkbcommon.so.0 libxkbcommon-x11.so.0 libxcb.so.1; do
        case "$libs" in
            *"$lib"*) ;;
            *) missing="$missing $lib" ;;
        esac
    done
fi
if [ -n "$missing" ]; then
    say ""
    say "${red}The search window needs these libraries, which aren't installed:${missing}${reset}"
    say "  Debian, Ubuntu:  sudo apt install libxkbcommon-x11-0 libxcb1"
    say "  Fedora:          sudo dnf install libxkbcommon-x11 libxcb"
    say "  Arch:            sudo pacman -S libxkbcommon-x11 libxcb"
fi

if [ -n "${WAYLAND_DISPLAY:-}" ] && ! has wl-copy; then
    say ""
    say "${dim}Optional: install wl-clipboard to copy images (text copies without it).${reset}"
fi

case ":$PATH:" in
    *":$BIN_DIR:"*)
        found=$(command -v gyotaku-app || true)
        if [ -n "$found" ] && [ "$found" != "$BIN_DIR/gyotaku-app" ]; then
            say ""
            say "${red}Another gyotaku-app at $found comes first on your PATH.${reset}"
            say "Remove it (cargo uninstall gyotaku gyotaku-app, if you built it) to use this one."
        fi
        ;;
    *)
        say ""
        say "$BIN_DIR isn't on your PATH, so add this to your shell's startup file:"
        say "  export PATH=\"$BIN_DIR:\$PATH\""
        ;;
esac

# The one thing left to do by hand: a key to open it with. Desktops keep
# shortcuts in their own settings, so it's explained for this one.
say ""
step "One last step: a keyboard shortcut"
say "Bind any key you like to run:  $BIN_DIR/gyotaku-app"
desktop=$(printf '%s' "${XDG_CURRENT_DESKTOP:-}" | tr '[:upper:]' '[:lower:]')
case "$desktop" in
    *gnome* | *ubuntu* | *unity* | *pop* | *cosmic*)
        say "  Settings > Keyboard > View and Customize Shortcuts > Custom Shortcuts > +" ;;
    *kde*)
        say "  System Settings > Keyboard > Shortcuts > Add New > Command or Script" ;;
    *xfce*)
        say "  Settings > Keyboard > Application Shortcuts > Add" ;;
    *cinnamon*)
        say "  System Settings > Keyboard > Shortcuts > Custom Shortcuts > Add custom shortcut" ;;
    *hyprland*)
        say "  in hyprland.conf:  bind = SUPER, S, exec, $BIN_DIR/gyotaku-app" ;;
    *sway* | *i3*)
        say "  in your config:  bindsym \$mod+s exec $BIN_DIR/gyotaku-app" ;;
    *niri*)
        say "  in config.kdl, inside binds:  Mod+S { spawn \"$BIN_DIR/gyotaku-app\"; }" ;;
    *)
        say "  in your desktop's keyboard settings, as a custom shortcut that runs a command" ;;
esac
say "Pressing it again closes the window."

if [ "$first_install" = true ] && [ "${GYOTAKU_NO_LAUNCH:-}" != "1" ] &&
    { [ -n "${WAYLAND_DISPLAY:-}" ] || [ -n "${DISPLAY:-}" ]; }; then
    say ""
    step "Opening gyotaku to pick your screenshot folders"
    nohup "$BIN_DIR/gyotaku-app" >/dev/null 2>&1 &
fi
