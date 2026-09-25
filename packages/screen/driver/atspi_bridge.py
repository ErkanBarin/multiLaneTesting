#!/usr/bin/env python3
"""Tier-1 AT-SPI introspection bridge for the screen lane (Linux).

Deterministic, offline, no model/vision in the loop -- this is a classical accessibility-tree
reader (GObject-introspection binding to libatspi), not AI. It exists so a driver in any language
can resolve and read frozen locators against a Qt/GTK target via the same mechanism the toolkit
uses in production (Qt: QAccessible -> AT-SPI on Linux).

INTERPRETER. `gi` is a *system* package; it cannot be pip-installed into a project venv. Run this
under the system interpreter (`/usr/bin/python3`), not under a venv that happens to be active --
`resolvePythonBin()` in this package's index.mjs is the JS side of that rule. Because the system
interpreter is the one that runs this file, keep it free of syntax newer than the oldest system
Python you must support (3.9 on RHEL 9). This file ships in the npm package, so the Python
package's own `requires-python` does not constrain it.

SYSTEM DEPENDENCIES. This lane needs things a package manager installs, not pip: the `gi` binding
(RHEL/Fedora `python3-gobject`, Debian/Ubuntu `python3-gi`), a running `at-spi2-core`, and -- for
`menu_actuate.py` only -- X11 with the XTEST extension plus the `xwininfo` binary. Run
`atspi_bridge.py doctor` on a new machine before anything else: it names exactly which of those is
missing and what to install, because otherwise a missing binding is a bare traceback and a missing
XTEST is a silent no-op. Wayland cannot work for menu actuation (no XTEST, no global coordinates).

Protocol: one JSON command per invocation on argv, JSON result on stdout, exit 0 on success.
Because the protocol is argv-in/JSON-out, any language can drive this; no Python client required.
Environment failures are reported as JSON too (exit 3), so a consumer never has to parse a
traceback to find out its host is not set up.

Every runtime command takes a resolver key (app name + accessible name path) that must already be
a frozen locator -- no discovery/guessing there. `dump_tree` is the one exception: an
authoring-only discovery command that walks the tree to find candidate accessible names for a
human to review and freeze. It must never be called by a lane spec.

Commands:
  doctor                                        -> {"can_read":..,"can_actuate_menus":..,"checks":[...]}
                                                   (host readiness; exit 0 when can_read)
  find_app <app_name>                          -> {"found":..,"instances":..,"windows":[[...]]}
  read <app_name> <accessible_name>             -> {"name":..,"role":..,"description":..}
  read_cell <app_name> <anchor_name> <offset> [table_column_header]
                                                -> {"name":..,"role":..,"description":..}
                                                   (the cell <offset> columns right of <anchor_name>,
                                                    same row -- the optional header scopes duplicate
                                                    anchors to one table)
  read_sibling <app_name> <caption_name> <offset>
                                                -> {"name":..,"role":..,"description":..}
                                                   (flat-container analogue of read_cell, for
                                                    dialogs that are a plain sequence of labels)
  table_dimensions <app_name> <anchor_name> [table_column_header]
                                                -> {"rows":..,"columns":..}
  do_action <app_name> <accessible_name> [action_name]
                                                -> {"actuated": <action name>}
  extents <app_name> <accessible_name>          -> {"x":..,"y":..,"width":..,"height":..}
  extents_cell <app_name> <anchor_name> <offset> [table_column_header]
                                                -> {"x":..,"y":..,"width":..,"height":..}
                                                   (screen extents of the row-anchor+offset cell,
                                                    for cropping a rendering-oracle screenshot of a
                                                    cell whose own text is too generic to address by
                                                    name)
  dump_tree <app_name>                          -> nested {"name":..,"role":..,"description":..,"children":[...]}
                                                    (authoring-only discovery)
"""
import ctypes
import json
import os
import shutil
import sys

_ATSPI = None

# What to install when the binding is missing. Named per distro family because "install gi" is not
# actionable and the pip name a newcomer reaches for (`pygobject`) builds against headers they also
# do not have.
_PKG_HINT = ("`gi` is a system package: RHEL/Fedora `dnf install python3-gobject at-spi2-core`, "
             "Debian/Ubuntu `apt install python3-gi at-spi2-core`. It cannot be pip-installed "
             "into a venv.")


def _atspi():
    """Import the AT-SPI binding on first use.

    Deferred rather than imported at module scope so that `doctor` can still report *why* this host
    cannot run the lane. An import-time failure would instead print a traceback to stderr and leave
    stdout empty, which a consumer parsing our JSON reads as a crash with no diagnosis.
    """
    global _ATSPI
    if _ATSPI is None:
        import gi

        gi.require_version("Atspi", "2.0")
        from gi.repository import Atspi

        _ATSPI = Atspi
    return _ATSPI


def _find_apps(name):
    # Two instances of the same product can register under one app name (e.g. the same binary
    # started twice against different configurations), so this must return every match -- binding
    # to the first silently hides the others.
    desktop = _atspi().get_desktop(0)
    apps = []
    for i in range(desktop.get_child_count()):
        app = desktop.get_child_at_index(i)
        if app is not None and app.get_name() == name:
            apps.append(app)
    return apps


def _find_by_name(acc, target):
    if acc.get_name() == target:
        return acc
    for i in range(acc.get_child_count()):
        child = acc.get_child_at_index(i)
        if child is None:
            continue
        found = _find_by_name(child, target)
        if found is not None:
            return found
    return None


def _find_all_by_name(acc, target):
    matches = []
    if acc.get_name() == target:
        matches.append(acc)
    for i in range(acc.get_child_count()):
        child = acc.get_child_at_index(i)
        if child is not None:
            matches.extend(_find_all_by_name(child, target))
    return matches


def _table_has_column_header(node, header):
    table = node.get_parent()
    if table is None or table.get_role_name() != "table":
        return False
    for i in range(table.get_child_count()):
        child = table.get_child_at_index(i)
        if (
            child is not None
            and child.get_role_name() == "table column header"
            and child.get_name() == header
        ):
            return True
    return False


def _has_iface(node, name):
    """Whether an accessible exposes an AT-SPI interface, e.g. "Component" or "Action".

    Replaces `node.get_component_iface()` / `node.get_action_iface()`: libatspi deprecated both
    accessors, so every call printed a DeprecationWarning to stderr, and they sit on a removal path
    that would break this driver outright on a newer distro. The static `Atspi.<Iface>.<call>(node,
    ...)` form below is the supported one. The guard itself stays -- asking a label for a table cell's
    geometry must still be a clean error, not a crash.
    """
    return name in _atspi().Accessible.get_interfaces(node)


def _screen_extents(node):
    """Screen extents of an accessible, or None when it exposes no Component interface."""
    if not _has_iface(node, "Component"):
        return None
    return _atspi().Component.get_extents(node, _atspi().CoordType.SCREEN)


def _describe(acc):
    return {
        "name": acc.get_name(),
        "role": acc.get_role_name(),
        "description": acc.get_description(),
    }


def _dump_tree(acc):
    return {
        "name": acc.get_name(),
        "role": acc.get_role_name(),
        "description": acc.get_description(),
        "children": [
            _dump_tree(acc.get_child_at_index(i))
            for i in range(acc.get_child_count())
            if acc.get_child_at_index(i) is not None
        ],
    }


def _doctor():
    """Report whether this host can run the screen lane, and what to install where it cannot.

    Exists because every one of these failures is otherwise invisible or misleading: a missing
    binding is a traceback, a stopped at-spi2-core is "app not found", and a missing XTEST or
    `xwininfo` makes menu actuation a silent no-op that looks like a product bug. Checks are split
    so a consumer that only *reads* the accessibility tree is not blocked by the X11 ones --
    `can_read` gates `atspi_bridge.py`, `can_actuate_menus` gates `menu_actuate.py`.
    """
    checks = []

    def record(name, ok, detail, hint="", gates="read"):
        entry = {"check": name, "gates": gates, "detail": detail,
                 "status": "pass" if ok else ("fail" if gates == "read" else "warn")}
        if not ok and hint:
            entry["hint"] = hint
        checks.append(entry)
        return ok

    # A venv is not itself fatal (it may inherit system site-packages), so this warns rather than
    # fails -- but when the binding check below also fails, this is almost always the reason.
    record("interpreter", sys.prefix == sys.base_prefix,
           f"{sys.executable} (Python {sys.version.split()[0]})",
           f"this interpreter is a virtualenv ({sys.prefix}); re-run with /usr/bin/python3 or set "
           f"SCREEN_ATSPI_PYTHON to it. {_PKG_HINT}",
           gates="info")

    try:
        atspi = _atspi()
        record("atspi_binding", True, "gi + Atspi 2.0 import cleanly")
    except Exception as exc:  # ImportError, or ValueError from require_version on an old libatspi
        record("atspi_binding", False, f"{type(exc).__name__}: {exc}", _PKG_HINT)
        atspi = None

    if atspi is not None and not any(os.environ.get(name) for name in
                                     ("DISPLAY", "WAYLAND_DISPLAY", "DBUS_SESSION_BUS_ADDRESS")):
        record("atspi_bus", False, "no display or D-Bus session configured",
               "start at-spi2-core alongside an X server (e.g. under Xvfb)")
    elif atspi is not None:
        try:
            count = atspi.get_desktop(0).get_child_count()
        except Exception as exc:
            record("atspi_bus", False, f"cannot reach the accessibility bus: {exc}",
                   "at-spi2-core is not running for this DISPLAY; on a headless host start it "
                   "alongside the X server (e.g. under Xvfb)")
        else:
            record("atspi_bus", True, f"reachable, {count} application(s) registered")
            # An empty bus is not a host fault -- the machine is ready and nothing is running on it
            # yet. Reported separately so `can_read` stays a claim about the host rather than about
            # whatever happens to be up when someone runs this.
            record("target_registered", count > 0, f"{count} application(s) registered",
                   "nothing has registered yet: start the target first. If it still does not "
                   "appear, launch it with QT_ACCESSIBILITY=1 (Qt) or "
                   "GTK_MODULES=gail:atk-bridge (GTK)",
                   gates="info")

    # --- below here: menu_actuate.py only ---
    display = os.environ.get("DISPLAY")
    wayland = os.environ.get("WAYLAND_DISPLAY")
    record("x11_display", bool(display) and not wayland,
           f"DISPLAY={display or '(unset)'} WAYLAND_DISPLAY={wayland or '(unset)'}",
           "menu actuation requires X11: Wayland has neither XTEST input synthesis nor the global "
           "pointer coordinates this depends on. Use Xorg, or Xwayland with DISPLAY set.",
           gates="menu")

    xwininfo = shutil.which("xwininfo")
    record("xwininfo", xwininfo is not None, xwininfo or "not on PATH",
           "popups are located with `xwininfo`: install xorg-x11-utils (RHEL/Fedora) or "
           "x11-utils (Debian/Ubuntu)",
           gates="menu")

    # Load through menu_actuate's own loader rather than a parallel probe, so this checks the exact
    # code path actuation will take. A consumer that copied only this file gets a skip, not a lie.
    xlib = xtst = None
    try:
        import menu_actuate

        xlib, xtst = menu_actuate._x11()
        record("x11_libraries", True, "libX11.so.6 + libXtst.so.6 load", gates="menu")
        record("menu_row_height", True,
               f"{menu_actuate.ROW_HEIGHT_PX} px per row (MULTILANE_MENU_ROW_HEIGHT); calibrate "
               "for your theme with a `peek` before freezing any row index",
               gates="info")
    except ImportError as exc:
        record("x11_libraries", False, f"menu_actuate.py not importable: {exc}",
               "keep menu_actuate.py alongside this script to actuate context menus",
               gates="menu")
    except OSError as exc:
        record("x11_libraries", False, str(exc),
               "install libX11 + libXtst (RHEL/Fedora `libX11 libXtst`, Debian/Ubuntu "
               "`libx11-6 libxtst6`)",
               gates="menu")

    if xlib is not None and display and not wayland:
        handle = ctypes.c_void_p(xlib.XOpenDisplay(None))
        if not handle:
            record("xtest", False, f"cannot open X display {display}",
                   "check DISPLAY, and that this user is allowed to connect (xhost)", gates="menu")
        else:
            event, error, major, minor = (ctypes.c_int() for _ in range(4))
            present = xtst.XTestQueryExtension(handle, ctypes.byref(event), ctypes.byref(error),
                                               ctypes.byref(major), ctypes.byref(minor))
            record("xtest", bool(present),
                   f"XTEST {major.value}.{minor.value}" if present else "not advertised by the "
                   "X server",
                   "this X server has no XTEST extension, so input cannot be synthesised; most "
                   "builds ship it -- check the server's module configuration",
                   gates="menu")
            xlib.XCloseDisplay(handle)

    status = {check["check"]: check["status"] for check in checks}
    can_read = all(status.get(name) == "pass" for name in ("atspi_binding", "atspi_bus"))
    return {
        "can_read": can_read,
        "can_actuate_menus": can_read and all(
            status.get(name) == "pass"
            for name in ("x11_display", "xwininfo", "x11_libraries", "xtest")),
        "checks": checks,
    }


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == "doctor":
        report = _doctor()
        print(json.dumps(report, indent=2))
        sys.exit(0 if report["can_read"] else 1)

    if len(sys.argv) < 3:
        print(json.dumps({
            "error": "usage: atspi_bridge.py <command> <app_name> [accessible_name] | doctor",
        }))
        sys.exit(2)

    command = sys.argv[1]
    app_name = sys.argv[2]

    Atspi = _atspi()
    apps = _find_apps(app_name)
    if not apps:
        print(json.dumps({"error": f"app not found in AT-SPI desktop: {app_name}"}))
        sys.exit(1)

    if command == "find_app":
        # Also report each instance's top-level window titles. One instance typically shows one
        # window, and two instances register under the same app name, so "an app exists" is not
        # evidence that the *wanted* window is up -- a caller that only checks `found` silently
        # binds whichever instance enumerated first.
        print(json.dumps({
            "found": True,
            "instances": len(apps),
            "windows": [
                [
                    app.get_child_at_index(i).get_name()
                    for i in range(app.get_child_count())
                    if app.get_child_at_index(i) is not None
                ]
                for app in apps
            ],
        }))
        return

    if command == "dump_tree":
        # Authoring-only, human-reviewed: dump every match so a second instance can't hide.
        trees = [_dump_tree(app) for app in apps]
        print(json.dumps(
            trees[0] if len(trees) == 1
            else {"name": app_name, "role": "desktop frame", "description": "", "children": trees}
        ))
        return

    if len(sys.argv) < 4:
        print(json.dumps({"error": "missing accessible_name argument"}))
        sys.exit(2)

    accessible_name = sys.argv[3]
    table_column_header = None
    if command in ("read_cell", "extents_cell") and len(sys.argv) >= 6:
        table_column_header = sys.argv[5]
    elif command == "table_dimensions" and len(sys.argv) >= 5:
        table_column_header = sys.argv[4]

    if table_column_header is None:
        node = next((n for n in (_find_by_name(a, accessible_name) for a in apps) if n is not None), None)
    else:
        matches = [
            node
            for app in apps
            for node in _find_all_by_name(app, accessible_name)
            if _table_has_column_header(node, table_column_header)
        ]
        if len(matches) > 1:
            print(json.dumps({
                "error": (
                    f"ambiguous accessible: {accessible_name} in table with column "
                    f"{table_column_header} in app {app_name}"
                )
            }))
            sys.exit(1)
        node = matches[0] if matches else None
    if node is None:
        scope = f" in table with column {table_column_header}" if table_column_header else ""
        print(json.dumps({"error": f"accessible not found: {accessible_name}{scope} in app {app_name}"}))
        sys.exit(1)

    if command == "read":
        print(json.dumps(_describe(node)))
        return

    if command == "do_action":
        # Actuating a real accessible action (e.g. a dialog's "Close" button). This is ordinary
        # AT-SPI actuation on a named, frozen accessible -- unlike menu popups, which expose no
        # accessible tree and need the separate XTEST path in menu_actuate.py.
        if not _has_iface(node, "Action"):
            print(json.dumps({"error": f"accessible has no action interface: {accessible_name}"}))
            sys.exit(1)
        count = Atspi.Action.get_n_actions(node)
        wanted = sys.argv[4] if len(sys.argv) >= 5 else None
        index = 0
        if wanted is not None:
            names = [Atspi.Action.get_action_name(node, i) for i in range(count)]
            if wanted not in names:
                print(json.dumps({"error": f"no action {wanted!r} on {accessible_name}; has {names}"}))
                sys.exit(1)
            index = names.index(wanted)
        elif count == 0:
            print(json.dumps({"error": f"accessible exposes no actions: {accessible_name}"}))
            sys.exit(1)
        # Resolve the name before actuating: a "Close" action destroys the accessible, so reading
        # it afterwards raises "No such object path" even though the action succeeded.
        name = Atspi.Action.get_action_name(node, index)
        Atspi.Action.do_action(node, index)
        print(json.dumps({"actuated": name}))
        return

    if command == "read_cell":
        if len(sys.argv) < 5:
            print(json.dumps({"error": "missing column offset argument"}))
            sys.exit(2)
        table = node.get_parent()
        index = node.get_index_in_parent()
        row = Atspi.Table.get_row_at_index(table, index)
        column = Atspi.Table.get_column_at_index(table, index)
        cell = Atspi.Table.get_accessible_at(table, row, column + int(sys.argv[4]))
        if cell is None:
            print(json.dumps({"error": f"no cell {sys.argv[4]} columns right of {accessible_name}"}))
            sys.exit(1)
        print(json.dumps(_describe(cell)))
        return

    if command == "read_sibling":
        # Flat-container analogue of read_cell's anchor+offset: a properties dialog is often a
        # plain sequence of labels ('Reachable', 'true', 'Managed', 'true', ...), so a value is
        # addressed as "n places after" its own caption rather than by its own text, which is
        # never unique.
        if len(sys.argv) < 5:
            print(json.dumps({"error": "missing sibling offset argument"}))
            sys.exit(2)
        parent = node.get_parent()
        if parent is None:
            print(json.dumps({"error": f"accessible has no parent: {accessible_name}"}))
            sys.exit(1)
        target_index = node.get_index_in_parent() + int(sys.argv[4])
        if not 0 <= target_index < parent.get_child_count():
            print(json.dumps({"error": f"sibling {sys.argv[4]} of {accessible_name} is out of range"}))
            sys.exit(1)
        print(json.dumps(_describe(parent.get_child_at_index(target_index))))
        return

    if command == "table_dimensions":
        table = node.get_parent()
        print(json.dumps({
            "rows": Atspi.Table.get_n_rows(table),
            "columns": Atspi.Table.get_n_columns(table),
        }))
        return

    if command == "extents":
        extents = _screen_extents(node)
        if extents is None:
            print(json.dumps({"error": f"accessible has no component interface: {accessible_name}"}))
            sys.exit(1)
        print(json.dumps({"x": extents.x, "y": extents.y, "width": extents.width, "height": extents.height}))
        return

    if command == "extents_cell":
        if len(sys.argv) < 5:
            print(json.dumps({"error": "missing column offset argument"}))
            sys.exit(2)
        table = node.get_parent()
        index = node.get_index_in_parent()
        row = Atspi.Table.get_row_at_index(table, index)
        column = Atspi.Table.get_column_at_index(table, index)
        cell = Atspi.Table.get_accessible_at(table, row, column + int(sys.argv[4]))
        if cell is None:
            print(json.dumps({"error": f"no cell {sys.argv[4]} columns right of {accessible_name}"}))
            sys.exit(1)
        extents = _screen_extents(cell)
        if extents is None:
            print(json.dumps({"error": f"cell has no component interface: {sys.argv[4]} columns right of {accessible_name}"}))
            sys.exit(1)
        print(json.dumps({"x": extents.x, "y": extents.y, "width": extents.width, "height": extents.height}))
        return

    print(json.dumps({"error": f"unknown command: {command}"}))
    sys.exit(2)


if __name__ == "__main__":
    try:
        main()
    except ImportError as exc:
        # A consumer reads our stdout as JSON, so an unusable host must answer in JSON rather than
        # with a traceback on stderr and nothing on stdout. Exit 3 distinguishes "this host is not
        # set up" from 1 (not found) and 2 (bad arguments) so a caller can tell a broken machine
        # from a broken locator.
        print(json.dumps({"error": f"AT-SPI binding unavailable: {exc}",
                          "hint": f"run `atspi_bridge.py doctor` for a full diagnosis. {_PKG_HINT}"}))
        sys.exit(3)
