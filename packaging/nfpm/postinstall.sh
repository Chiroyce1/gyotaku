#!/bin/sh
# Runs as root after the package is installed or upgraded. The background
# reader and the shortcut belong to each user, so nothing is started here:
# gyotaku-app sets up the reader the first time a user opens it.

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t /usr/share/icons/hicolor || true
fi

# An upgrade: a window or reader still running is the old version until it
# restarts. The reader under systemd restarts with the user's session; this
# only says so, it never kills anyone's processes.
if pgrep -x gyotaku-app >/dev/null 2>&1 || pgrep -f "gyotaku watch" >/dev/null 2>&1; then
    echo "gyotaku: a running copy keeps the old version until it's restarted:"
    echo "  pkill -x gyotaku-app; systemctl --user restart gyotaku-watch.service"
fi

exit 0
