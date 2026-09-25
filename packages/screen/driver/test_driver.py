#!/usr/bin/env python3
"""Self-check for the parts of the driver that need no display. Run: python3 test_driver.py

Covers the pure geometry and pixel arithmetic, and the property that makes this lane diagnosable on
someone else's machine: every module must still *import* with no X libraries, no `gi` and no numpy,
so that `doctor` can report what is missing instead of dying at import. Everything else is I/O
against a live display and is proven by running a real scenario, not here. The pixel tests need
numpy and report a skip without it.
"""
import sys

import atspi_bridge as ab
import framebuffer as fb
import menu_actuate as ma

# Sampled here, at import, because that is what the claim is about -- and because `doctor` populates
# these same lazy caches as a side effect, so reading them from inside a test would only prove
# whichever test ran first.
_LAZY_AT_IMPORT = {"menu_actuate._X11": ma._X11, "menu_actuate._ATSPI": ma._ATSPI,
                   "atspi_bridge._ATSPI": ab._ATSPI, "framebuffer._NP": fb._NP,
                   "framebuffer._GI": fb._GI, "framebuffer._X11": fb._X11}


def test_imports_without_x():
    # Both modules must load on a machine with no X libraries and no accessibility binding at all.
    # If someone moves the ctypes.CDLL or `import gi` calls back to import time, `doctor` stops
    # being able to explain an unusable host -- and this file cannot even be imported.
    for name, value in _LAZY_AT_IMPORT.items():
        assert value is None, f"{name} must not be loaded at import time"


def test_doctor_reports_without_raising():
    # doctor must produce a verdict on ANY host, including one where every probe fails -- that is
    # the whole point of it. It must never raise, and must always answer both questions.
    report = ab._doctor()
    assert isinstance(report["can_read"], bool)
    assert isinstance(report["can_actuate_menus"], bool)
    # Menus need everything reading needs, plus X11: claiming actuation without reading is a bug.
    assert not (report["can_actuate_menus"] and not report["can_read"])
    names = [check["check"] for check in report["checks"]]
    for required in ("interpreter", "atspi_binding", "x11_display", "xwininfo"):
        assert required in names, f"doctor dropped the {required} check"
    for check in report["checks"]:
        assert check["status"] in ("pass", "fail", "warn"), check
        # A failing check with no remedy is the failure mode doctor exists to prevent.
        assert check["status"] == "pass" or check.get("hint"), f"no hint for failing {check}"


def test_row_count_uses_calibration():
    original = ma.ROW_HEIGHT_PX
    try:
        ma.ROW_HEIGHT_PX = 26.0
        assert ma._row_count({"h": 78}) == 3
        assert ma._row_count({"h": 130}) == 5
        # A popup shorter than one row still has one row, never zero -- a zero would make
        # _row_point divide by zero.
        assert ma._row_count({"h": 4}) == 1

        # The whole point of the knob: a taller theme must yield fewer rows for the same popup.
        ma.ROW_HEIGHT_PX = 40.0
        assert ma._row_count({"h": 120}) == 3
        assert ma._row_count({"h": 78}) == 2
    finally:
        ma.ROW_HEIGHT_PX = original


def test_row_point_centres_each_row():
    popup = {"x": 100, "y": 200, "w": 80, "h": 78}
    assert ma._row_point(popup, 0, 3) == (140, 213)
    assert ma._row_point(popup, 1, 3) == (140, 239)
    assert ma._row_point(popup, 2, 3) == (140, 265)
    # Every row point must land inside the popup, or the release actuates nothing.
    for index in range(3):
        _, y = ma._row_point(popup, index, 3)
        assert popup["y"] <= y <= popup["y"] + popup["h"]


def test_point_clear_of_is_outside_every_popup():
    popups = [
        {"x": 300, "y": 400, "w": 200, "h": 130},
        {"x": 500, "y": 450, "w": 180, "h": 104},
    ]
    point = ma._point_clear_of(popups)
    assert point is not None
    x, y = point
    for popup in popups:
        inside = (popup["x"] <= x <= popup["x"] + popup["w"]
                  and popup["y"] <= y <= popup["y"] + popup["h"])
        assert not inside, f"clear point {point} is inside {popup}"


def test_point_clear_of_refuses_rather_than_guessing():
    # A popup hard against the screen origin leaves no candidate with non-negative coordinates.
    # Returning None is correct: _leave_menus then releases without gliding, which is still safe
    # (the pointer never moved onto a row). Returning a negative or on-popup point would not be.
    assert ma._point_clear_of([{"x": 0, "y": 0, "w": 200, "h": 130}]) is None


def _numpy():
    try:
        return fb._np()
    except ImportError:
        return None


def _screen(np):
    """A deterministic 'screen': a gradient, so no two windows of it are alike."""
    rows, cols = np.mgrid[0:60, 0:90]
    return np.stack([rows * 4 % 256, cols * 3 % 256, (rows + cols) * 2 % 256], axis=2).astype(np.uint8)


def test_framebuffer_doctor_reports_without_raising():
    report = fb._doctor()
    for key in ("can_capture", "can_input", "can_ocr", "can_view_vnc", "can_view_rdp"):
        assert isinstance(report[key], bool), key
    # OCR is read off a capture: claiming it without capture is a bug.
    assert not (report["can_ocr"] and not report["can_capture"])
    for check in report["checks"]:
        assert check["status"] in ("pass", "fail", "warn"), check
        assert check["status"] == "pass" or check.get("hint"), f"no hint for failing {check}"


def test_locate_finds_a_planted_template_exactly():
    np = _numpy()
    if np is None:
        return "numpy not installed"
    screen = _screen(np)
    template = screen[20:32, 30:47].copy()
    result = fb._locate(screen, template, 0.001)
    assert result["found"] and result["rival"] is None, result
    assert (result["best"]["x"], result["best"]["y"]) == (30, 20), result
    assert result["best"]["error"] < 1e-6, result


def test_locate_refuses_rather_than_binding_to_the_first_match():
    np = _numpy()
    if np is None:
        return "numpy not installed"
    screen = _screen(np)
    template = screen[5:15, 5:20].copy()
    screen[40:50, 60:75] = template  # the same control drawn twice
    result = fb._locate(screen, template, 0.001)
    assert result["found"] and result["rival"] is not None, result
    assert {(result["best"]["x"], result["best"]["y"]),
            (result["rival"]["x"], result["rival"]["y"])} == {(5, 5), (60, 40)}, result


def test_locate_reports_the_best_miss():
    np = _numpy()
    if np is None:
        return "numpy not installed"
    screen = _screen(np)
    template = np.full((8, 8, 3), 255, np.uint8)  # pure white appears nowhere in the gradient
    result = fb._locate(screen, template, 0.001)
    assert not result["found"] and result["best"]["error"] > 0.001, result


def test_diff_mask_honours_tolerance_and_masks():
    np = _numpy()
    if np is None:
        return "numpy not installed"
    golden = _screen(np)
    actual = golden.copy()
    actual[2, 3] = (actual[2, 3].astype(int) + 5) % 256    # small drift
    actual[40:44, 50:54] = 0                               # a real change
    assert fb._diff_mask(actual, golden, 0, []).sum() == 17
    assert fb._diff_mask(actual, golden, 5, []).sum() == 16  # within tolerance -> equal
    assert fb._diff_mask(actual, golden, 5, [(50, 40, 4, 4)]).sum() == 0


def test_parse_tsv_joins_lines_and_maps_boxes_back():
    header = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext"
    rows = [
        "4\t1\t1\t1\t1\t0\t0\t0\t90\t30\t-1\t",
        "5\t1\t1\t1\t1\t1\t30\t60\t90\t30\t96\tCancel",
        "5\t1\t1\t1\t1\t2\t300\t60\t30\t30\t90\tOK",
        "5\t1\t1\t1\t2\t1\t30\t120\t60\t30\t80\tABC123",
        "5\t1\t1\t1\t2\t2\t99\t120\t9\t9\t0\t ",  # an empty word is noise, not text
    ]
    result = fb._parse_tsv("\n".join([header] + rows), scale=3, origin=(100, 200))
    assert result["text"] == "Cancel OK\nABC123", result
    assert result["confidence"] == round((96 + 90 + 80) / 3, 1), result
    # Boxes come back in screen coordinates: divided by the upscale, offset by the region origin.
    assert result["words"][0] == {"text": "Cancel", "confidence": 96.0, "x": 110, "y": 220,
                                  "width": 30, "height": 10}, result["words"][0]


def test_keysyms_and_combos():
    assert fb._keysym_for_char("a") == 0x61
    assert fb._keysym_for_char("\n") == 0xFF0D
    assert fb._keysym_for_char("\u00e9") == 0xE9          # Latin-1 is its own keysym
    assert fb._keysym_for_char("\u20ac") == 0x010020AC    # the rest use the Unicode range
    assert fb._parse_combo("ctrl+shift+Tab") == ["Control_L", "Shift_L", "Tab"]
    assert fb._parse_combo("ctrl++") == ["Control_L", "plus"]
    assert fb._parse_combo("Return") == ["Return"]
    for bad in ("a+", "ctrl+", "hyper+x", ""):
        try:
            fb._parse_combo(bad)
        except fb.DriverError as exc:
            assert exc.code == 2
        else:
            raise AssertionError(f"accepted bad combo {bad!r}")


def test_evidence_names_never_collide():
    assert fb._evidence_stem("goldens/dialog/ok.png") == "goldens__dialog__ok"
    assert fb._evidence_stem("goldens/other/ok.png") != fb._evidence_stem("goldens/dialog/ok.png")


def main():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    skipped = 0
    for test in tests:
        reason = test()
        skipped += bool(reason)
        print(f"skip {test.__name__}: {reason}" if reason else f"ok  {test.__name__}")
    print(f"\n{len(tests) - skipped} passed, {skipped} skipped")


if __name__ == "__main__":
    sys.exit(main())
