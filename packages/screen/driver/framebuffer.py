#!/usr/bin/env python3
"""Framebuffer driver for the screen lane (Linux/X11): capture, Tier-2 template locate, the
rendering and legibility oracles, and input synthesis.

WHERE THIS FITS. `atspi_bridge.py` reads a target through its accessibility tree (Tier 1). A target
reached over VNC or RDP has no such tree on this side of the wire -- only pixels -- and neither does
a canvas-drawn display. This script works on the pixels of an X display instead:

  capture   the display, or a region of it, to a PNG
  find      Tier 2: locate a frozen template image, uniquely, and return its coordinates
  compare   rendering oracle: diff a region against a committed golden image
  ocr       legibility oracle: read a region's text with the local Tesseract binary
  click / move / type / key    XTEST input at the coordinates `find` returned

No network and no model: `find` and `compare` are arithmetic on pixels, and `ocr` runs a local binary.
Functional truth stays with the target's own object/state channel -- these two oracles corroborate
it, they never replace it.

REMOTE TARGETS. `openViewer()` in index.mjs puts a VNC/RDP target's desktop full-screen on a local
X display, and every command here then runs against that display as if the target were local.
Nothing in this file knows about VNC or RDP.

DETERMINISM. Tier 2 is pixel-bound: a template only matches the DPI, resolution and theme it was
frozen at, which is why a Tier-2 locator carries a `stamp`. `find` refuses a template that matches in
two places for the same reason atspi_bridge refuses an ambiguous accessible name -- binding to the
first hit is how a spec ends up clicking the wrong control. `compare` is exact by default; loosen
`--tolerance` / `--max-diff-ratio`, or `--mask` a volatile region (a clock, a caret), deliberately and
per golden. A viewer draws the target's pointer into the picture, so park it with `move` before a
golden capture if it could sit over the region.

SYSTEM DEPENDENCIES, all distro packages (nothing here is pip-installed): the `gi` binding with the
Gdk 3 and GdkPixbuf typelibs, numpy, libX11 + libXtst, and -- for `ocr` only -- tesseract with its
language data. Run `framebuffer.py doctor` on a new host first. Same interpreter rule and contract
as atspi_bridge.py: the system python3 (3.9-safe syntax), argv in, JSON on stdout, exit 0 on success,
1 = not found / mismatch, 2 = bad arguments, 3 = this host cannot do it.

Commands:
  doctor
  capture <out.png> [--region X Y W H]         -> {"path":..,"x":..,"y":..,"width":..,"height":..}
  find <template.png> [--region X Y W H] [--max-error E] [--timeout S]
                                               -> {"x":..,"y":..,"width":..,"height":..,
                                                   "center":[x,y],"error":..}
  compare <golden.png> [--region X Y W H] [--mask X Y W H]... [--tolerance T]
          [--max-diff-ratio R] [--out DIR]     -> {"match":true,"diff_pixels":..,"diff_ratio":..}
                                                  (--mask is relative to the region; --tolerance is
                                                   the largest per-channel difference, 0-255, that
                                                   still counts as equal)
                                                  (a mismatch exits 1 and writes <out>/<golden>.actual.png
                                                   and .diff.png; a missing golden is written from this
                                                   capture and exits 1 for review;
                                                   MULTILANE_UPDATE_GOLDENS=1 rewrites it and passes)
  ocr [--region X Y W H] [--lang L] [--psm N] [--scale N]
                                               -> {"text":..,"confidence":..,"words":[..]}
  click <x> <y> [--button N] [--double]        -> {"clicked":[x,y]}
  move <x> <y>                                 -> {"moved":[x,y]}
  type <text>                                  -> {"typed":<characters>}
  key <combo>...     e.g. Return  Tab  ctrl+s  alt+F4
                                               -> {"pressed":[..]}
"""
import argparse
import ctypes
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

_PKG_HINT = ("RHEL/Fedora `dnf install python3-gobject gtk3 python3-numpy`, Debian/Ubuntu "
             "`apt install python3-gi gir1.2-gtk-3.0 python3-numpy`. These are system packages: "
             "they cannot be pip-installed into a venv.")
_TESSERACT_HINT = ("install Tesseract and its English data -- RHEL (EPEL) `dnf install tesseract "
                   "tesseract-langpack-eng`, Debian/Ubuntu `apt install tesseract-ocr` -- or point "
                   "MULTILANE_TESSERACT at the binary")

_NP = None
_GI = None
_X11 = None


class DriverError(Exception):
    """A result to report as JSON with a specific exit code (see the module docstring)."""

    def __init__(self, code, message, **extra):
        super().__init__(message)
        self.code = code
        self.extra = extra


# --- lazy imports: `doctor` and test_driver.py must work on a host where these are missing -------

def _np():
    global _NP
    if _NP is None:
        import numpy

        _NP = numpy
    return _NP


def _gi():
    global _GI
    if _GI is None:
        # Gdk picks Wayland when it can, and a Wayland session has no root window to capture.
        os.environ.setdefault("GDK_BACKEND", "x11")
        import gi

        try:
            gi.require_version("Gdk", "3.0")
            gi.require_version("GdkPixbuf", "2.0")
        except ValueError as exc:  # a missing typelib: a host problem, reported like a missing module
            raise ImportError(str(exc))
        from gi.repository import Gdk, GdkPixbuf, GLib

        _GI = (Gdk, GdkPixbuf, GLib)
    return _GI


def _x11():
    global _X11
    if _X11 is None:
        xlib = ctypes.CDLL("libX11.so.6")
        xtst = ctypes.CDLL("libXtst.so.6")
        ptr, uint, ulong, i = ctypes.c_void_p, ctypes.c_uint, ctypes.c_ulong, ctypes.c_int
        xlib.XOpenDisplay.restype = ptr
        xlib.XFlush.argtypes = [ptr]
        xlib.XSync.argtypes = [ptr, i]
        xlib.XCloseDisplay.argtypes = [ptr]
        xlib.XStringToKeysym.argtypes = [ctypes.c_char_p]
        xlib.XStringToKeysym.restype = ulong
        xlib.XKeysymToKeycode.argtypes = [ptr, ulong]
        xlib.XKeysymToKeycode.restype = ctypes.c_ubyte
        xlib.XkbKeycodeToKeysym.argtypes = [ptr, ctypes.c_ubyte, i, i]
        xlib.XkbKeycodeToKeysym.restype = ulong
        xtst.XTestQueryExtension.argtypes = [ptr] + [ctypes.POINTER(i)] * 4
        xtst.XTestFakeMotionEvent.argtypes = [ptr, i, i, i, ulong]
        xtst.XTestFakeButtonEvent.argtypes = [ptr, uint, i, ulong]
        xtst.XTestFakeKeyEvent.argtypes = [ptr, uint, i, ulong]
        _X11 = (xlib, xtst)
    return _X11


# --- pixels ---------------------------------------------------------------------------------------

def _pixbuf_to_array(pixbuf):
    np = _np()
    width, height = pixbuf.get_width(), pixbuf.get_height()
    stride, channels = pixbuf.get_rowstride(), pixbuf.get_n_channels()
    data = pixbuf.read_pixel_bytes().get_data()
    # GdkPixbuf does not pad the last row out to a full rowstride, so pad before reshaping.
    flat = np.zeros(stride * height, np.uint8)
    flat[:len(data)] = np.frombuffer(data, np.uint8)
    rows = flat.reshape(height, stride)[:, :width * channels]
    return rows.reshape(height, width, channels)[:, :, :3].copy()


def _array_to_pixbuf(array):
    np = _np()
    _, GdkPixbuf, GLib = _gi()
    array = np.ascontiguousarray(array, dtype=np.uint8)
    height, width = array.shape[:2]
    return GdkPixbuf.Pixbuf.new_from_bytes(GLib.Bytes.new(array.tobytes()),
                                           GdkPixbuf.Colorspace.RGB, False, 8, width, height,
                                           width * 3)


def _load_png(path):
    _, GdkPixbuf, GLib = _gi()
    try:
        return _pixbuf_to_array(GdkPixbuf.Pixbuf.new_from_file(path))
    except GLib.Error as exc:
        raise DriverError(2, f"cannot read image {path}: {exc.message}")


def _save_png(array, path):
    if os.path.dirname(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
    _array_to_pixbuf(array).savev(path, "png", [], [])


def _capture(region=None):
    Gdk = _gi()[0]
    root = Gdk.get_default_root_window()
    if root is None:
        raise DriverError(3, f"cannot open X display {os.environ.get('DISPLAY') or '(DISPLAY unset)'}",
                          hint="set DISPLAY to the X server the target (or its viewer) is on")
    width, height = root.get_width(), root.get_height()
    x, y, w, h = region or (0, 0, width, height)
    if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > width or y + h > height:
        raise DriverError(2, f"region {x},{y} {w}x{h} is not inside the {width}x{height} display")
    pixbuf = Gdk.pixbuf_get_from_window(root, x, y, w, h)
    if pixbuf is None:
        raise DriverError(3, "the X server returned no image for the root window")
    return _pixbuf_to_array(pixbuf)


def _error_map(haystack, template):
    """Mean squared error of `template` at every position where it fits in `haystack`, as 0..1.

    The sum of squared differences expands to sum(I^2) - 2*sum(I*T) + sum(T^2). The cross term for
    every position at once is one FFT correlation per channel, and sum(I^2) per window comes from an
    integral image -- the same quantity cv2.matchTemplate(TM_SQDIFF) computes. numpy is a distro
    package on every target OS; OpenCV is not, and a pip wheel cannot live next to the system `gi`.
    """
    np = _np()
    big, small = haystack.astype(np.float64), template.astype(np.float64)
    rows, cols = big.shape[:2]
    h, w = small.shape[:2]
    cross = 0.0
    for channel in range(3):
        spectrum = np.fft.rfft2(big[:, :, channel]) * np.fft.rfft2(small[::-1, ::-1, channel],
                                                                     (rows, cols))
        cross = cross + np.fft.irfft2(spectrum, (rows, cols))[h - 1:, w - 1:]
    integral = np.pad((big ** 2).sum(axis=2).cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    window = integral[h:, w:] - integral[:-h, w:] - integral[h:, :-w] + integral[:-h, :-w]
    ssd = window - 2 * cross + (small ** 2).sum()
    return np.clip(ssd, 0, None) / (h * w * 3 * 255.0 ** 2)


def _locate(haystack, template, max_error):
    """Best position of `template`, whether it is within `max_error`, and any second match.

    The rival search blanks every position overlapping the best one first, so a template never
    competes with itself shifted by a pixel.
    """
    np = _np()
    h, w = template.shape[:2]
    if h > haystack.shape[0] or w > haystack.shape[1]:
        raise DriverError(2, f"template {w}x{h} is larger than the searched "
                             f"{haystack.shape[1]}x{haystack.shape[0]} area")
    errors = _error_map(haystack, template)
    y, x = (int(v) for v in np.unravel_index(int(np.argmin(errors)), errors.shape))
    best = {"x": x, "y": y, "error": round(float(errors[y, x]), 6)}
    if errors[y, x] > max_error:
        return {"found": False, "best": best, "rival": None}
    errors[max(0, y - h + 1):y + h, max(0, x - w + 1):x + w] = np.inf
    ry, rx = (int(v) for v in np.unravel_index(int(np.argmin(errors)), errors.shape))
    rival = None
    if errors[ry, rx] <= max_error:
        rival = {"x": rx, "y": ry, "error": round(float(errors[ry, rx]), 6)}
    return {"found": True, "best": best, "rival": rival}


def _diff_mask(actual, golden, tolerance, masks):
    """Pixels whose largest channel difference exceeds `tolerance`, outside every mask."""
    np = _np()
    delta = np.abs(actual.astype(np.int16) - golden.astype(np.int16)).max(axis=2) > tolerance
    for x, y, w, h in masks:
        delta[max(0, y):y + h, max(0, x):x + w] = False
    return delta


def _evidence_stem(golden_path):
    """goldens/dialog/ok.png -> goldens__dialog__ok, so two goldens never share an evidence name."""
    stem = os.path.splitext(os.path.relpath(golden_path))[0]
    return "__".join(part for part in stem.split(os.sep) if part not in ("", ".", ".."))


# --- OCR ------------------------------------------------------------------------------------------

def _tesseract():
    exe = os.environ.get("MULTILANE_TESSERACT") or shutil.which("tesseract")
    if not exe or not os.path.exists(exe):
        raise DriverError(3, "tesseract not found", hint=_TESSERACT_HINT)
    return exe


def _parse_tsv(tsv, scale=1, origin=(0, 0)):
    """Words from `tesseract ... tsv`, joined into lines, with boxes mapped back to the screen."""
    lines, words = {}, []
    for row in tsv.splitlines()[1:]:
        cols = row.split("\t")
        # level 5 is a word; the other levels are page/block/paragraph/line with no text.
        if len(cols) < 12 or cols[0] != "5" or not cols[11].strip():
            continue
        left, top, width, height = (int(v) for v in cols[6:10])
        words.append({"text": cols[11], "confidence": float(cols[10]),
                      "x": origin[0] + left // scale, "y": origin[1] + top // scale,
                      "width": width // scale, "height": height // scale})
        lines.setdefault((int(cols[2]), int(cols[3]), int(cols[4])), []).append(cols[11])
    confidence = sum(w["confidence"] for w in words) / len(words) if words else 0.0
    return {"text": "\n".join(" ".join(ws) for _, ws in sorted(lines.items())),
            "confidence": round(confidence, 1), "words": words}


def _ocr(array, lang, psm, scale, origin):
    exe = _tesseract()
    pixbuf = _array_to_pixbuf(array)
    if scale != 1:
        # Screen text is ~10 px high; Tesseract is tuned for ~30. Measured on a GTK dialog at 96 DPI
        # over VNC: scale 1 and 2 misread the selected entry text, 3 read all four labels at 94%
        # mean confidence, 4 misread a digit. Hence the default of 3.
        GdkPixbuf = _gi()[1]
        pixbuf = pixbuf.scale_simple(pixbuf.get_width() * scale, pixbuf.get_height() * scale,
                                     GdkPixbuf.InterpType.BILINEAR)
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "region.png")
        pixbuf.savev(path, "png", [], [])
        run = subprocess.run([exe, path, "stdout", "-l", lang, "--psm", str(psm), "tsv"],
                             capture_output=True, text=True, timeout=120)
    if run.returncode != 0:
        raise DriverError(3, f"tesseract failed: {run.stderr.strip()[-400:]}", hint=_TESSERACT_HINT)
    return _parse_tsv(run.stdout, scale, origin)


# --- input ----------------------------------------------------------------------------------------

_MODIFIERS = {"ctrl": "Control_L", "control": "Control_L", "shift": "Shift_L", "alt": "Alt_L",
              "super": "Super_L", "meta": "Meta_L"}


def _keysym_for_char(ch):
    if ch == "\n":
        return 0xFF0D  # Return
    if ch == "\t":
        return 0xFF09  # Tab
    code = ord(ch)
    # Latin-1 characters are their own keysyms; everything else uses the X11 Unicode keysym range.
    return code if 0x20 <= code <= 0x7E or 0xA0 <= code <= 0xFF else 0x01000000 | code


def _parse_combo(combo):
    """'ctrl+shift+Tab' -> ['Control_L', 'Shift_L', 'Tab']. The last part is an X keysym name."""
    if combo == "+" or combo.endswith("++"):
        parts = combo[:-1].split("+")[:-1] + ["plus"]  # 'ctrl++' is ctrl and the plus key
    else:
        parts = combo.split("+")
    if any(not part for part in parts):
        raise DriverError(2, f"bad key combo: {combo!r}")
    unknown = [p for p in parts[:-1] if p.lower() not in _MODIFIERS]
    if unknown:
        raise DriverError(2, f"unknown modifier(s) {unknown} in {combo!r}; use {sorted(_MODIFIERS)}")
    return [_MODIFIERS[p.lower()] for p in parts[:-1]] + [parts[-1]]


class _Display:
    """An XTEST-capable display connection, closed on exit even when a command fails."""

    def __enter__(self):
        self.xlib, self.xtst = _x11()
        self.handle = self.xlib.XOpenDisplay(None)
        if not self.handle:
            raise DriverError(3, f"cannot open X display {os.environ.get('DISPLAY') or '(unset)'}")
        return self

    def __exit__(self, *_):
        self.xlib.XSync(self.handle, 0)
        self.xlib.XCloseDisplay(self.handle)

    def sync(self, pause):
        # A viewer forwards input asynchronously and a toolkit may drop a press and release that
        # arrive in the same instant, so every event is flushed and given a moment to land.
        self.xlib.XSync(self.handle, 0)
        time.sleep(pause)

    def move(self, x, y):
        self.xtst.XTestFakeMotionEvent(self.handle, -1, x, y, 0)
        self.sync(0.05)

    def button(self, button, press):
        self.xtst.XTestFakeButtonEvent(self.handle, button, 1 if press else 0, 0)
        self.sync(0.05 if press else 0.08)

    def keycode(self, keysym, label):
        code = self.xlib.XKeysymToKeycode(self.handle, keysym)
        if not code:
            raise DriverError(1, f"no key produces {label} in this display's keymap")
        return code

    def key(self, code, press):
        self.xtst.XTestFakeKeyEvent(self.handle, code, 1 if press else 0, 0)
        self.sync(0.02)

    def type_char(self, ch):
        keysym = _keysym_for_char(ch)
        code = self.keycode(keysym, f"U+{ord(ch):04X}")
        if self.xlib.XkbKeycodeToKeysym(self.handle, code, 0, 0) == keysym:
            shift = None
        elif self.xlib.XkbKeycodeToKeysym(self.handle, code, 0, 1) == keysym:
            shift = self.keycode(0xFFE1, "Shift_L")
        else:
            raise DriverError(1, f"U+{ord(ch):04X} needs a modifier other than Shift in this keymap")
        if shift:
            self.key(shift, True)
        self.key(code, True)
        self.key(code, False)
        if shift:
            self.key(shift, False)


# --- doctor ---------------------------------------------------------------------------------------

def _doctor():
    """Which of capture / input / OCR / the two viewers this host can run, and what to install."""
    checks = []

    def record(name, ok, detail, hint="", gates="capture"):
        entry = {"check": name, "gates": gates, "detail": detail,
                 "status": "pass" if ok else ("fail" if gates == "capture" else "warn")}
        if not ok and hint:
            entry["hint"] = hint
        checks.append(entry)
        return ok

    try:
        np_ok = record("numpy", True, f"numpy {_np().__version__}")
    except ImportError as exc:
        np_ok = record("numpy", False, str(exc), _PKG_HINT)
    try:
        _gi()
        gdk_ok = record("gdk", True, "gi + Gdk 3.0 + GdkPixbuf 2.0 import cleanly")
    except ImportError as exc:
        gdk_ok = record("gdk", False, str(exc), _PKG_HINT)

    display, wayland = os.environ.get("DISPLAY"), os.environ.get("WAYLAND_DISPLAY")
    display_ok = record("x11_display", bool(display), f"DISPLAY={display or '(unset)'}"
                        + (f" WAYLAND_DISPLAY={wayland}" if wayland else ""),
                        "set DISPLAY to the X server the target (or its viewer) runs on; under "
                        "Wayland use Xwayland. openViewer() starts an Xvfb itself when none is up")
    if np_ok and gdk_ok and display_ok:
        try:
            size = _capture().shape
            record("capture", True, f"{size[1]}x{size[0]} root window readable")
        except DriverError as exc:
            record("capture", False, str(exc), exc.extra.get("hint", "check DISPLAY and xhost"))

    try:
        _x11()
        libs_ok = record("x11_libraries", True, "libX11.so.6 + libXtst.so.6 load", gates="input")
    except OSError as exc:
        libs_ok = record("x11_libraries", False, str(exc), "install libX11 + libXtst (RHEL/Fedora "
                         "`libX11 libXtst`, Debian/Ubuntu `libx11-6 libxtst6`)", gates="input")
    if libs_ok:
        try:
            with _Display() as d:
                event, error, major, minor = (ctypes.c_int() for _ in range(4))
                present = d.xtst.XTestQueryExtension(d.handle, ctypes.byref(event),
                                                     ctypes.byref(error), ctypes.byref(major),
                                                     ctypes.byref(minor))
            record("xtest", bool(present), f"XTEST {major.value}.{minor.value}" if present else
                   "not advertised", "this X server has no XTEST extension; input cannot be "
                   "synthesised", gates="input")
        except DriverError as exc:
            record("xtest", False, str(exc), "check DISPLAY", gates="input")

    try:
        langs = subprocess.run([_tesseract(), "--list-langs"], capture_output=True, text=True,
                               timeout=30).stdout.split()
        record("tesseract", "eng" in langs, f"languages: {' '.join(langs[1:]) or 'none'}",
               _TESSERACT_HINT, gates="ocr")
    except DriverError as exc:
        record("tesseract", False, str(exc), _TESSERACT_HINT, gates="ocr")

    vnc = shutil.which("vncviewer")
    record("vncviewer", bool(vnc), vnc or "not on PATH", "the VNC bridge runs TigerVNC's viewer: "
           "RHEL/Fedora `dnf install tigervnc`, Debian/Ubuntu `apt install tigervnc-viewer`",
           gates="vnc")
    rdp = shutil.which("xfreerdp") or shutil.which("xfreerdp3")
    record("xfreerdp", bool(rdp), rdp or "not on PATH", "the RDP bridge runs FreeRDP: RHEL/Fedora "
           "`dnf install freerdp`, Debian/Ubuntu `apt install freerdp2-x11`", gates="rdp")
    for tool, package in (("Xvfb", "xorg-x11-server-Xvfb` / `xvfb"), ("xwininfo",
                                                                       "xorg-x11-utils` / `x11-utils")):
        found = shutil.which(tool)
        record(tool, bool(found), found or "not on PATH",
               f"openViewer() needs it: install `{package}` (RHEL / Debian)", gates="viewer")

    status = {c["check"]: c["status"] for c in checks}

    def passed(*names):
        return all(status.get(name) == "pass" for name in names)

    can_capture = passed("numpy", "gdk", "x11_display", "capture")
    return {
        "can_capture": can_capture,
        "can_input": passed("x11_libraries", "xtest"),
        "can_ocr": can_capture and passed("tesseract"),
        "can_view_vnc": passed("vncviewer", "xwininfo"),
        "can_view_rdp": passed("xfreerdp", "xwininfo"),
        "checks": checks,
    }


# --- commands -------------------------------------------------------------------------------------

def _cmd_capture(args):
    image = _capture(args.region)
    _save_png(image, args.out)
    x, y = (args.region or (0, 0))[:2]
    return {"path": args.out, "x": x, "y": y, "width": image.shape[1], "height": image.shape[0]}


def _cmd_find(args):
    template = _load_png(args.template)
    ox, oy = (args.region or (0, 0))[:2]
    h, w = template.shape[:2]
    deadline = time.monotonic() + args.timeout
    while True:
        result = _locate(_capture(args.region), template, args.max_error)
        best, rival = result["best"], result["rival"]
        if rival:
            raise DriverError(1, f"ambiguous template: {args.template} matches at "
                                 f"{ox + best['x']},{oy + best['y']} and {ox + rival['x']},"
                                 f"{oy + rival['y']} -- narrow it with --region",
                              best=best, rival=rival)
        if result["found"]:
            x, y = ox + best["x"], oy + best["y"]
            return {"x": x, "y": y, "width": w, "height": h,
                    "center": [x + w // 2, y + h // 2], "error": best["error"]}
        if time.monotonic() >= deadline:
            raise DriverError(1, f"template not found: {args.template} (best error "
                                 f"{best['error']} at {ox + best['x']},{oy + best['y']} > "
                                 f"--max-error {args.max_error})", best=best)
        time.sleep(0.25)


def _cmd_compare(args):
    actual = _capture(args.region)
    if os.environ.get("MULTILANE_UPDATE_GOLDENS") == "1":
        _save_png(actual, args.golden)
        return {"match": True, "updated": args.golden}
    if not os.path.exists(args.golden):
        _save_png(actual, args.golden)
        raise DriverError(1, f"no golden yet: wrote this capture to {args.golden} -- review it, "
                             "then commit it", golden=args.golden, created=True)
    golden = _load_png(args.golden)
    stem = os.path.join(args.out, _evidence_stem(args.golden))
    if golden.shape != actual.shape:
        _save_png(actual, stem + ".actual.png")
        raise DriverError(1, f"size differs: golden {golden.shape[1]}x{golden.shape[0]}, captured "
                             f"{actual.shape[1]}x{actual.shape[0]}", actual=stem + ".actual.png")
    delta = _diff_mask(actual, golden, args.tolerance, args.mask or [])
    count = int(delta.sum())
    result = {"match": count <= args.max_diff_ratio * delta.size, "diff_pixels": count,
              "diff_ratio": round(count / delta.size, 6), "golden": args.golden}
    if result["match"]:
        return result
    image = (actual // 3).astype(actual.dtype)  # dim the capture so the differing pixels stand out
    image[delta] = (255, 0, 0)
    _save_png(actual, stem + ".actual.png")
    _save_png(image, stem + ".diff.png")
    raise DriverError(1, f"{count} pixel(s) differ from {args.golden} (ratio {result['diff_ratio']}"
                         f" > {args.max_diff_ratio})", actual=stem + ".actual.png",
                      diff=stem + ".diff.png", **result)


def _cmd_ocr(args):
    if args.scale < 1:
        raise DriverError(2, "--scale must be at least 1")
    return _ocr(_capture(args.region), args.lang, args.psm, args.scale, (args.region or (0, 0))[:2])


def _cmd_click(args):
    with _Display() as d:
        d.move(args.x, args.y)
        for _ in range(2 if args.double else 1):
            d.button(args.button, True)
            d.button(args.button, False)
    return {"clicked": [args.x, args.y]}


def _cmd_move(args):
    with _Display() as d:
        d.move(args.x, args.y)
    return {"moved": [args.x, args.y]}


def _cmd_type(args):
    with _Display() as d:
        for ch in args.text:
            d.type_char(ch)
    return {"typed": len(args.text)}


def _cmd_key(args):
    combos = [_parse_combo(combo) for combo in args.combos]
    with _Display() as d:
        for names in combos:
            codes = []
            for name in names:
                keysym = d.xlib.XStringToKeysym(name.encode())
                if not keysym:
                    raise DriverError(2, f"unknown key name {name!r} (use X keysym names: Return, "
                                         "Escape, F4, a, ...)")
                codes.append(d.keycode(keysym, name))
            for code in codes:
                d.key(code, True)
            for code in reversed(codes):
                d.key(code, False)
    return {"pressed": args.combos}


class _Parser(argparse.ArgumentParser):
    def error(self, message):
        raise DriverError(2, f"{self.prog}: {message}")


def _parser():
    parser = _Parser(prog="framebuffer.py")
    sub = parser.add_subparsers(dest="command", required=True, parser_class=_Parser)
    region = {"nargs": 4, "type": int, "metavar": ("X", "Y", "W", "H")}
    sub.add_parser("doctor")
    p = sub.add_parser("capture")
    p.add_argument("out")
    p.add_argument("--region", **region)
    p.set_defaults(run=_cmd_capture)
    p = sub.add_parser("find")
    p.add_argument("template")
    p.add_argument("--region", **region)
    p.add_argument("--max-error", type=float, default=0.001)
    p.add_argument("--timeout", type=float, default=0.0)
    p.set_defaults(run=_cmd_find)
    p = sub.add_parser("compare")
    p.add_argument("golden")
    p.add_argument("--region", **region)
    p.add_argument("--mask", action="append", **region)
    p.add_argument("--tolerance", type=int, default=0)
    p.add_argument("--max-diff-ratio", type=float, default=0.0)
    p.add_argument("--out", default=os.path.join("results", "screen"))
    p.set_defaults(run=_cmd_compare)
    p = sub.add_parser("ocr")
    p.add_argument("--region", **region)
    p.add_argument("--lang", default="eng")
    p.add_argument("--psm", type=int, default=6)
    p.add_argument("--scale", type=int, default=3)
    p.set_defaults(run=_cmd_ocr)
    p = sub.add_parser("click")
    p.add_argument("x", type=int)
    p.add_argument("y", type=int)
    p.add_argument("--button", type=int, default=1)
    p.add_argument("--double", action="store_true")
    p.set_defaults(run=_cmd_click)
    p = sub.add_parser("move")
    p.add_argument("x", type=int)
    p.add_argument("y", type=int)
    p.set_defaults(run=_cmd_move)
    p = sub.add_parser("type")
    p.add_argument("text")
    p.set_defaults(run=_cmd_type)
    p = sub.add_parser("key")
    p.add_argument("combos", nargs="+")
    p.set_defaults(run=_cmd_key)
    return parser


def main():
    try:
        args = _parser().parse_args()
        if args.command == "doctor":
            report = _doctor()
            print(json.dumps(report, indent=2))
            sys.exit(0 if report["can_capture"] else 1)
        print(json.dumps(args.run(args)))
    except DriverError as exc:
        print(json.dumps({"error": str(exc), **exc.extra}))
        sys.exit(exc.code)
    except (ImportError, OSError) as exc:
        # Same contract as atspi_bridge.py: an unusable host answers in JSON (exit 3), never with a
        # traceback. ImportError: numpy, `gi` or a typelib; OSError: libX11/libXtst.
        print(json.dumps({"error": f"host cannot run this command: {type(exc).__name__}: {exc}",
                          "hint": f"run `framebuffer.py doctor` for a full diagnosis. {_PKG_HINT}"}))
        sys.exit(3)


if __name__ == "__main__":
    main()
