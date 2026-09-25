#!/usr/bin/env python3
"""Actuate a widget's context menu by classical X11 input synthesis (Linux, Qt/GTK).

WHY THIS EXISTS. Some test stimuli come from a GUI context menu rather than from a device-side
value, and a Qt popup menu is the one part of the UI that exposes **no accessible tree at all** --
`atspi_bridge.py` cannot see it, let alone drive it. This module is the escape hatch for exactly
that case, and nothing else.

THE SPRING-LOADED MENU. A Qt context menu maps on button-press and unmaps again on button-release.
Sampling the popup's X window *after* releasing therefore shows `IsUnMapped` and invites the
conclusion that the popup "never maps without a window manager". It does map; it is simply only
mapped while the button is held. Everything below follows from that:

  * the whole interaction happens inside ONE press ... release cycle. There is no "open the menu,
    then click an item" phase, because releasing anywhere is what ends the menu.
  * `Atspi.generate_mouse_event` is useless here: registry-routed synthesis silently does nothing
    when the `at-spi2-registryd` on the host is bound to another display. This module therefore
    calls `libXtst` directly.
  * a window manager is NOT required. The menu maps and actuates on a bare display.

THE ONE NON-OBVIOUS REQUIREMENT: MOTION MUST BE INCREMENTAL. Warping the pointer straight onto the
target row leaves the item unhighlighted and the release actuates nothing -- Qt updates the active
menu action from motion events, and a single jump does not produce the crossings it needs. Walking
the pointer in small steps highlights the row and the release actuates it. `_glide` exists solely
for this and its step count is deliberately not tuned to the minimum.

ADDRESSING, AND WHY THIS DOES NOT BREAK THE FROZEN-LOCATOR RULE. The popup has no accessible
nodes, so a menu item cannot be addressed by name, and pixel-derived addressing would normally be
runtime discovery in disguise. Two properties keep this honest:

  1. Menu structure is *declared product configuration*, not something discovered at runtime. A
     product that defines its menus in a committed file (Qt applications commonly do) lets a row
     index be read off that file and frozen into a reviewed locator, exactly like a table
     `columnOffset`. If your product does not declare its menus, freeze the index from a
     human-reviewed `peek` instead -- never from a guess.
  2. This module is a **stimulus**, never an oracle. It presses a menu item; it asserts nothing.
     Every assertion still runs through the ordinary frozen AT-SPI locators against the resulting
     dialog or table cell. Menus drive the system the way a device-side write drives it -- the
     difference between actuating by coordinate and *asserting* by coordinate is the whole point.

The caller passes the expected item label purely so the frozen locator documents what the index is
supposed to mean to a human reviewer; it cannot be verified against the popup, and this module does
not pretend otherwise.

MENU DEPTH IS NOT FIXED. The path is a list of row indices of any length, because product menu
nesting is rarely uniform -- the same command can sit two levels down one menu and three down
another that wraps it. Each level is descended the same way (hover the row, wait for the child
popup to map, identify it as the one popup not seen yet), so depth costs nothing beyond the loop.

CALIBRATION. A popup's row *count* is not introspectable, so it is inferred from the popup's
measured pixel height divided by a per-theme row height. That height is a property of the target's
Qt style and DPI, not of this code: set `MULTILANE_MENU_ROW_HEIGHT` for your environment. Measure
it once with `peek` (popup height / known item count) and freeze it alongside your locators.

Protocol: JSON result on stdout, exit 0 on success.
usage: menu_actuate.py <app> <anchor-accessible-name> <path> [column-header] [column-offset]
  where <path> is  <row>[,<sub-row>...]        actuate that item
                   peek                        measure the root menu, actuate nothing
                   peek,<row>[,<sub-row>...]   descend and measure, actuate nothing

The cell whose menu is opened is addressed exactly the way `atspi_bridge.py read_cell` addresses
one: by row anchor plus column offset, optionally scoped by a table column header. That matters
because the cell under test often has a repeated, non-unique accessible name (a status cell
reading "EN") and could never be addressed directly.
"""
import ctypes
import json
import os
import subprocess
import sys
import time

RIGHT_BUTTON = 3
MENU_SETTLE_S = 0.8
SUBMENU_SETTLE_S = 1.0

# Per-theme popup row height in pixels, used to infer a popup's row count from its measured
# height. 26 matches a default Qt style at 96 DPI; a different style, font size or DPI shifts it.
# ponytail: single global row height, move to a per-app value in the frozen locator if one
# estate ever drives two targets with different themes in the same run.
ROW_HEIGHT_PX = float(os.environ.get("MULTILANE_MENU_ROW_HEIGHT", "26"))

_X11 = None
_ATSPI = None


def _x11():
    """Load libX11/libXtst on first use.

    Deferred rather than done at import so the pure geometry helpers below (`_row_point`,
    `_point_clear_of`) can be imported and tested on a machine with no X libraries at all.
    """
    global _X11
    if _X11 is None:
        xlib = ctypes.CDLL("libX11.so.6")
        xtst = ctypes.CDLL("libXtst.so.6")
        xlib.XOpenDisplay.restype = ctypes.c_void_p
        xlib.XDefaultRootWindow.restype = ctypes.c_ulong
        _X11 = (xlib, xtst)
    return _X11


def _atspi():
    """Import the AT-SPI binding on first use, for the same reason as `_x11`."""
    global _ATSPI
    if _ATSPI is None:
        import gi

        gi.require_version("Atspi", "2.0")
        from gi.repository import Atspi

        _ATSPI = Atspi
    return _ATSPI


def _find_apps(name):
    Atspi = _atspi()
    desktop = Atspi.get_desktop(0)
    apps = []
    for i in range(desktop.get_child_count()):
        child = desktop.get_child_at_index(i)
        if child is not None and child.get_name() == name:
            apps.append(child)
    return apps


def _find_all_by_name(acc, target, out=None):
    out = [] if out is None else out
    if acc is None:
        return out
    if acc.get_name() == target:
        out.append(acc)
    for i in range(acc.get_child_count()):
        _find_all_by_name(acc.get_child_at_index(i), target, out)
    return out


def _table_has_column_header(node, header):
    """Scope a duplicated row anchor to one table, the same way atspi_bridge.py does."""
    Atspi = _atspi()
    table = node.get_parent()
    if table is None:
        return False
    try:
        columns = Atspi.Table.get_n_columns(table)
    except Exception:
        return False
    for column in range(columns):
        header_cell = Atspi.Table.get_column_header(table, column)
        if header_cell is not None and header_cell.get_name() == header:
            return True
    return False


def _viewable_popups():
    """Every viewable override-redirect window, i.e. the menus currently on screen.

    1x1 windows are skipped: a running window manager parks helper windows of that size, and they
    would otherwise be mistaken for a menu.
    """
    tree = subprocess.run(["xwininfo", "-root", "-tree"], capture_output=True, text=True,
                          timeout=15).stdout
    found = []
    for line in tree.splitlines():
        stripped = line.strip()
        if not stripped.startswith("0x"):
            continue
        window_id = stripped.split()[0]
        try:
            info = subprocess.run(["xwininfo", "-id", window_id], capture_output=True, text=True,
                                  timeout=10).stdout
        except Exception:
            continue
        if "Override Redirect State: yes" not in info or "IsViewable" not in info:
            continue

        def field(key):
            for candidate in info.splitlines():
                if key in candidate:
                    return int(candidate.split(":")[-1].strip())
            return -1

        width, height = field("Width"), field("Height")
        if width <= 2 and height <= 2:
            continue
        found.append({"id": window_id, "x": field("Absolute upper-left X"),
                      "y": field("Absolute upper-left Y"), "w": width, "h": height})
    return found


def _row_count(popup):
    """Infer a popup's item count from its pixel height. See CALIBRATION in the module docstring."""
    return int(round(popup["h"] / ROW_HEIGHT_PX)) or 1


def _glide(display, start, end, steps=8, dwell=0.06):
    """Move the pointer in increments. See module docstring: a single jump does not highlight."""
    xlib, xtst = _x11()
    (x0, y0), (x1, y1) = start, end
    for step in range(1, steps + 1):
        xtst.XTestFakeMotionEvent(display, -1,
                                  int(x0 + (x1 - x0) * step / steps),
                                  int(y0 + (y1 - y0) * step / steps), 0)
        xlib.XFlush(display)
        time.sleep(dwell)


def _row_point(popup, row_index, row_count):
    row_height = popup["h"] / row_count
    return (popup["x"] + popup["w"] // 2,
            int(popup["y"] + row_height * row_index + row_height / 2))


def _point_clear_of(popups):
    """A point on no popup, so releasing the button there actuates nothing.

    This is what makes a *descending* peek safe. Releasing actuates whatever row is highlighted, and
    the only way to highlight nothing is to leave the menus -- the same property the non-descending
    peek relies on by never moving at all. Candidates are tried above and to the left of the root
    popup, because submenus open downward and to the right.
    """
    root = popups[0]
    candidates = [(root["x"] + root["w"] // 2, root["y"] - 40),
                  (root["x"] - 80, root["y"] - 40),
                  (root["x"] - 80, root["y"] + root["h"] + 60)]
    for x, y in candidates:
        if x < 0 or y < 0:
            continue
        if all(not (p["x"] <= x <= p["x"] + p["w"] and p["y"] <= y <= p["y"] + p["h"])
               for p in popups):
            return (x, y)
    return None


def _leave_menus(display, current, popups):
    """Step the pointer off every open popup, then release the button, actuating nothing."""
    xlib, xtst = _x11()
    if popups:
        clear = _point_clear_of(popups)
        if clear is not None:
            _glide(display, current, clear, steps=6)
            time.sleep(0.3)
    xtst.XTestFakeButtonEvent(display, RIGHT_BUTTON, False, 0)
    xlib.XFlush(display)
    time.sleep(0.4)


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"error": "usage: menu_actuate.py <app> <cell> <row[,subrow]> [header]"}))
        sys.exit(2)

    xlib, xtst = _x11()
    Atspi = _atspi()

    app_name, cell_name, path_spec = sys.argv[1], sys.argv[2], sys.argv[3]
    column_header = sys.argv[4] if len(sys.argv) >= 5 and sys.argv[4] != "" else None
    column_offset = int(sys.argv[5]) if len(sys.argv) >= 6 else 0
    # "peek" alone opens the menu, measures it and releases without ever highlighting a row, so a
    # caller can check that the menu it froze an index against is the menu actually on screen. Menu
    # contents are state-dependent: an object that has only just been created settles into its full
    # menu some time after its own cells already read correctly -- measured, not assumed (the same
    # object offered 4 rows shortly after provisioning and 5 later). Without this a caller can only
    # find that out by actuating, which is exactly the blind click to avoid.
    # "peek,<i>,<j>..." additionally *descends* that path, measuring each submenu on the way, and
    # then leaves the menus before releasing so that it still actuates nothing. The descending form
    # exists because a row index is only meaningful together with the shape of the menu it indexes,
    # and the shape of a submenu cannot be read off the root: freezing a submenu index by analogy
    # with a neighbouring menu actuates the wrong item, which is the one thing a peek must prevent.
    peek = path_spec == "peek" or path_spec.startswith("peek,")
    path = []
    spec = path_spec[len("peek,"):] if path_spec.startswith("peek,") else path_spec
    if spec != "peek":
        try:
            path = [int(part) for part in spec.split(",")]
        except ValueError:
            print(json.dumps({"error": f"menu path must be integers: {path_spec}"}))
            sys.exit(2)
        if len(path) < 1:
            print(json.dumps({"error": "menu path must name at least one row"}))
            sys.exit(2)

    apps = _find_apps(app_name)
    if not apps:
        print(json.dumps({"error": f"app not found in AT-SPI desktop: {app_name}"}))
        sys.exit(1)

    matches = [
        node
        for app in apps
        for node in _find_all_by_name(app, cell_name)
        if column_header is None or _table_has_column_header(node, column_header)
    ]
    if len(matches) > 1:
        print(json.dumps({"error": f"ambiguous accessible: {cell_name} in app {app_name}"}))
        sys.exit(1)
    if not matches:
        print(json.dumps({"error": f"accessible not found: {cell_name} in app {app_name}"}))
        sys.exit(1)

    target_node = matches[0]
    if column_offset:
        table = target_node.get_parent()
        index = target_node.get_index_in_parent()
        row = Atspi.Table.get_row_at_index(table, index)
        column = Atspi.Table.get_column_at_index(table, index)
        cell = Atspi.Table.get_accessible_at(table, row, column + column_offset)
        if cell is None:
            print(json.dumps({"error": f"no cell {column_offset} columns right of {cell_name}"}))
            sys.exit(1)
        target_node = cell
    # `Atspi.Component.get_extents(node, ...)` rather than `node.get_component_iface()`: libatspi
    # deprecated that accessor (a warning on every call, and a removal would break this outright).
    # Duplicated from atspi_bridge.py on purpose -- each script stays independently copyable.
    if "Component" not in Atspi.Accessible.get_interfaces(target_node):
        print(json.dumps({"error": f"accessible has no component interface: {cell_name}"}))
        sys.exit(1)
    extents = Atspi.Component.get_extents(target_node, Atspi.CoordType.SCREEN)
    origin = (extents.x + extents.width // 2, extents.y + extents.height // 2)

    display = ctypes.c_void_p(xlib.XOpenDisplay(None))
    if not display:
        print(json.dumps({"error": "cannot open X display"}))
        sys.exit(1)

    trace = {"cell": cell_name, "pressed_at": list(origin), "path": path,
             "row_height_px": ROW_HEIGHT_PX}
    crossed = []      # every popup the pointer has entered, for stepping back off them safely
    current = origin  # where the pointer is now
    try:
        # A Qt popup that was dismissed by releasing off it (as `_leave_menus` does) stays mapped
        # and viewable rather than actually unmapping -- see the module docstring on spring-loading.
        # A prior invocation's leftover popup is therefore still `_viewable_popups()` material for
        # this one. Snapshotting before the press and keeping only what is new after it is what
        # makes `root_menu` this press's own popup rather than whichever stale one happens to be
        # largest -- measured live: a leftover 280x130 popup from an earlier actuation was silently
        # picked over a freshly opened 2-row menu until this snapshot was added.
        before_ids = {popup["id"] for popup in _viewable_popups()}

        xtst.XTestFakeMotionEvent(display, -1, origin[0], origin[1], 0)
        xlib.XFlush(display)
        time.sleep(0.3)
        xtst.XTestFakeButtonEvent(display, RIGHT_BUTTON, True, 0)
        xlib.XFlush(display)
        time.sleep(MENU_SETTLE_S)

        popups = _viewable_popups()
        opened_now = [p for p in popups if p["id"] not in before_ids]
        if not opened_now:
            raise RuntimeError("no context menu appeared while the button was held")
        root_menu = max(opened_now, key=lambda popup: popup["w"] * popup["h"])
        trace["menu"] = root_menu

        row_count = _row_count(root_menu)
        trace["row_count"] = row_count
        if peek and not path:
            # The pointer has not moved since the press, so no row is highlighted and the release
            # actuates nothing -- the same property that made warping straight to a row a dead end.
            xtst.XTestFakeButtonEvent(display, RIGHT_BUTTON, False, 0)
            xlib.XFlush(display)
            time.sleep(0.3)
            trace["actuated"] = False
            xlib.XCloseDisplay(display)
            print(json.dumps(trace))
            return
        if path[0] >= row_count:
            raise RuntimeError(f"row index {path[0]} outside menu of {row_count} rows")

        target = _row_point(root_menu, path[0], row_count)
        _glide(display, origin, target)
        time.sleep(SUBMENU_SETTLE_S if len(path) > 1 else 0.3)
        trace["hovered"] = list(target)

        # Descend one level per remaining index. The parent popups stay mapped while a child opens,
        # so the newly opened submenu is identified as the one viewable popup not seen yet rather
        # than by position -- which is what makes this work at any depth.
        # `before_ids` again: a submenu descent must not mistake some other stale leftover popup
        # (not just the root's own predecessor) for the child it just opened.
        seen = before_ids | {root_menu["id"]}
        crossed.append(root_menu)
        current = target
        counts = []
        for depth, index in enumerate(path[1:], start=1):
            opened = [p for p in _viewable_popups() if p["id"] not in seen]
            if not opened:
                raise RuntimeError(f"row {path[depth - 1]} did not open a submenu at depth {depth}")
            submenu = max(opened, key=lambda popup: popup["w"] * popup["h"])
            seen.add(submenu["id"])
            crossed.append(submenu)
            sub_rows = _row_count(submenu)
            counts.append(sub_rows)
            if depth == 1:  # kept for callers frozen against a two-level path
                trace["submenu"] = submenu
                trace["submenu_row_count"] = sub_rows
            if index >= sub_rows:
                raise RuntimeError(
                    f"submenu index {index} outside submenu of {sub_rows} rows at depth {depth}")
            sub_target = _row_point(submenu, index, sub_rows)
            _glide(display, current, sub_target, steps=6)
            time.sleep(SUBMENU_SETTLE_S if depth < len(path) - 1 else 0.4)
            current = sub_target
        if counts:
            trace["submenu_row_counts"] = counts
            trace["hovered_submenu"] = list(current)

        if peek:
            # Measured everything the path crosses, now leave without actuating any of it.
            _leave_menus(display, current, crossed)
            trace["actuated"] = False
        else:
            xtst.XTestFakeButtonEvent(display, RIGHT_BUTTON, False, 0)
            xlib.XFlush(display)
            time.sleep(0.6)
            trace["actuated"] = True
    except Exception as exc:
        # Release the button so a failure never leaves the pointer grabbed -- but step off the menus
        # first. A failure part-way down a path leaves a row highlighted, and releasing on it would
        # actuate whatever the path was in the middle of not being able to reach.
        _leave_menus(display, current, crossed)
        xlib.XCloseDisplay(display)
        print(json.dumps({"error": str(exc), **trace}))
        sys.exit(1)

    xlib.XCloseDisplay(display)
    print(json.dumps(trace))


if __name__ == "__main__":
    try:
        main()
    except (ImportError, OSError) as exc:
        # Same contract as atspi_bridge.py: an unusable host answers in JSON (exit 3), not with a
        # traceback. ImportError is the missing `gi` binding; OSError is a missing libX11/libXtst.
        print(json.dumps({
            "error": f"host cannot synthesise X11 input: {exc}",
            "hint": "run `atspi_bridge.py doctor` -- it reports the binding, the accessibility bus, "
                    "X11/XTEST and xwininfo, and names what to install",
        }))
        sys.exit(3)
