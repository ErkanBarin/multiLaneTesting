# @multilane/screen

Screen-driver lane for multilanetesting. The **runtime** surface loads and validates *frozen*
locators and replays them. There is no discovery, vision or model in the run path; that is
authoring-only. It covers:

- the Tier-1 accessibility driver
- the pixel driver: capture, Tier-2 templates, golden-image and OCR oracles, and input
- a VNC/RDP viewer bridge

```js
import { loadFrozenLocator, assertFrozen } from '@multilane/screen';

const locator = loadFrozenLocator('example', 'appTitle'); // locators/example/appTitle.json
const { ok, errors } = assertFrozen(locator);             // Tier 1/2 + resolver + requirement_ref
```

**Safety-critical guard, not a default.** Every `loadFrozenLocator` call asserts
`SCREEN_RPS_PARTITION` is not `PROD` and throws if it is — the refusal is baked into the runtime
entry point itself, so it holds even if a spec runs outside `mlt verify` (which also runs this
same check as a hard-failing gate before any lane starts).

Replay always targets a **test partition** (`TEST_A`/`TEST_B`/`TEST_C`), never `PROD`.

## Tier-1 AT-SPI driver (Linux)

Two scripts ship under `driver/`. They speak **argv in, JSON on stdout, exit 0 on success**, so any
language can drive them — there is no Python client to install.

**Getting them into your project.** Use `@multilane/screen@0.2.0` or later for the framebuffer
path. In a consumer scaffold, run the engine clone's `scripts/install-tarballs.mjs` to pack and
install the matching packages locally; no public registry is required.

Then run **Check the host first** below before writing anything against it: `doctor` reads the
scripts out of `node_modules`, so it is also what catches a tarball that shipped without `driver/`.

A team that is not a Node project does not need any of this: the scripts have no Python
dependencies beyond the system `gi` binding, so copying `driver/` and running them is the whole
integration. Keep the two `.py` files together — `doctor` reports on both.

```js
import { driverScriptPath, resolvePythonBin } from '@multilane/screen';
import { spawnSync } from 'node:child_process';

const run = (...args) =>
  JSON.parse(spawnSync(resolvePythonBin(), [driverScriptPath('atspiBridge'), ...args],
    { encoding: 'utf8' }).stdout);

run('find_app', 'MyApp');                  // { found, instances, windows }
run('read', 'MyApp', 'Server state');      // { name, role, description }
run('read_cell', 'MyApp', 'row-anchor', '4', 'Status'); // anchor + column offset, scoped to a table
```

| Script | Commands |
| --- | --- |
| `atspi_bridge.py` | `find_app` · `read` · `read_cell` · `read_sibling` · `table_dimensions` · `do_action` · `extents` · `extents_cell` · `dump_tree` |
| `menu_actuate.py` | context-menu **stimulus** for popups that expose no accessible tree |

### Check the host first

```sh
python3 node_modules/@multilane/screen/driver/atspi_bridge.py doctor
```

Run this before writing a single locator on a new machine or in a new CI image. It exits 0 when the
host can read the accessibility tree, and reports per check what is missing and the command to
install it:

| Check | Gates | |
| --- | --- | --- |
| `interpreter` | info | warns when run from a venv, where `gi` is invisible |
| `atspi_binding` | read | `gi` + `Atspi 2.0` |
| `atspi_bus` | read | `at-spi2-core` reachable |
| `target_registered` | info | something is actually running — start your app, then re-run |
| `x11_display` | menu | X11, **not** Wayland |
| `xwininfo` | menu | the binary `menu_actuate.py` locates popups with |
| `x11_libraries` | menu | `libX11.so.6` + `libXtst.so.6` |
| `menu_row_height` | info | the calibration currently in effect |
| `xtest` | menu | XTEST input synthesis |

`can_read` gates `atspi_bridge.py`; `can_actuate_menus` gates `menu_actuate.py`. A consumer that
only reads the tree can ignore every `menu` row — reading needs no X11 at all.

**Wayland cannot drive menus.** There is no XTEST and no global pointer coordinate space. Reading
works; `menu_actuate.py` does not. Use Xorg, or Xwayland with `DISPLAY` set.

**Use the system interpreter.** `resolvePythonBin()` prefers `$SCREEN_ATSPI_PYTHON`, then
`/usr/bin/python3`, then PATH. The `gi` binding is a system package: a bare `python3` inside an
activated venv fails with `ModuleNotFoundError`.

**An unusable host answers in JSON, not with a traceback.** Both scripts report a missing binding or
missing X library as `{"error":..,"hint":..}` with **exit 3** — distinct from 1 (locator not found)
and 2 (bad arguments) — so a caller can tell a broken machine from a broken locator without parsing
stderr.

**`dump_tree` is authoring-only.** It is the one command that discovers rather than replays; a
human reviews its output and freezes a name into a locator. Never call it from a spec.

**`menu_actuate.py` actuates, it never asserts.** A Qt popup exposes no accessible nodes, so its
items are addressed by row index — read off the product's committed menu definition, or off a
reviewed `peek`, and frozen like a `columnOffset`. Every assertion still goes through normal frozen
locators on whatever the menu produced. Actuating by coordinate is not asserting by coordinate.
Run `peek` first: menu contents are state-dependent, and an object reaches its full menu some time
after its own cells already read correctly.

**Calibrate the row height.** A popup's row *count* is inferred from its pixel height divided by
`MULTILANE_MENU_ROW_HEIGHT` (default `26`, a stock Qt style at 96 DPI). A different style, font
size or DPI shifts it — measure once with `peek` (popup height ÷ known item count) and set the
variable for your environment.

## Pixels: capture, Tier-2 find, golden images, OCR (Linux/X11)

`driver/framebuffer.py` (0.2.0+) works on the pixels of an X display: for a target reached over
VNC/RDP, a canvas-drawn display, or anything else with no accessibility tree. Same contract as the
other scripts. `runDriver` runs any of them and throws the script's own error on a non-zero exit, so
a failed oracle fails the spec with the evidence paths in the message:

```js
import { loadFrozenLocator, runDriver } from '@multilane/screen';

const fb = (...args) => runDriver('framebuffer', args);

// Tier 2: a frozen template, found uniquely (two matches is an error, never "the first one").
const ok = loadFrozenLocator('dialog', 'okButton');   // resolver: "template:locators/dialog/okButton.png"
const hit = fb('find', ok.resolver.slice('template:'.length), '--timeout', 5);
fb('click', ...hit.center);

// Rendering oracle: the region against a committed golden image.
fb('compare', 'goldens/dialog/applied.png', '--region', 303, 240, 194, 120, '--mask', 13, 37, 168, 32);

// Legibility oracle: offline OCR of a region.
assert.match(fb('ocr', '--region', 303, 240, 194, 120).text, /Applied/);
```

| Command | What it does |
| --- | --- |
| `capture <out.png> [--region X Y W H]` | writes the display or a region to a PNG — how a template or golden is cut |
| `find <template.png> [--region] [--max-error E] [--timeout S]` | Tier 2: `{x,y,width,height,center,error}`; waits up to `S` seconds for it to appear |
| `compare <golden.png> [--region] [--mask X Y W H]… [--tolerance T] [--max-diff-ratio R]` | rendering oracle |
| `ocr [--region] [--lang eng] [--psm 6] [--scale 3]` | legibility oracle: `{text, confidence, words[]}` |
| `click x y` · `move x y` · `type <text>` · `key ctrl+s Return …` | XTEST input |

**Functional truth is still the gate.** These two oracles corroborate the target's own object/state
channel; a spec never passes on a picture alone.

**Tier-2 locators are pixel-bound.** A template only matches the DPI, resolution and theme it was cut
at, so record them in the locator's `stamp`. `find` matches exactly by default (`--max-error 0.001`,
a mean squared error on 0..1); a miss reports the best candidate's error so you can see how far off it
was before loosening anything.

**Goldens.** The first `compare` against a missing golden writes the current capture there and fails:
review the image, then commit it. `MULTILANE_UPDATE_GOLDENS=1` rewrites goldens and passes. That is a
supervised re-pin: review the diff before committing. A mismatch writes `<golden>.actual.png` and
`<golden>.diff.png` (differing pixels in red) under `results/screen/` for the CI to archive.
Comparison is exact by default. `--mask` a volatile area (a clock, a blinking caret; coordinates are
relative to the region), or raise `--tolerance` (per channel, 0–255) for anti-aliasing noise,
deliberately and per golden.

**OCR** runs the local `tesseract` binary: RHEL (EPEL) `dnf install tesseract
tesseract-langpack-eng`, Debian/Ubuntu `apt install tesseract-ocr`, or set `MULTILANE_TESSERACT`.
Screen text is small, so the region is upscaled 3× first. We measured that on a 96-DPI GTK dialog:
1× and 2× misread the selected field, 3× read every label at 94% confidence, and 4× misread a digit.
Use `--psm 7` for a single line.

**Input goes where X sends it.** On a display without a window manager, keyboard focus follows the
pointer: `click` the field before you `type`. A viewer draws the target's pointer into the picture,
so `move` it clear of a region before comparing that region.

`framebuffer.py doctor` reports `can_capture`, `can_input`, `can_ocr`, `can_view_vnc` and
`can_view_rdp`, and names the package for every missing piece (`gi` with the Gdk 3 and GdkPixbuf
typelibs, numpy, libX11/libXtst, tesseract, the viewers, Xvfb, xwininfo — all distro packages).

## Screen-only targets over VNC/RDP

`openViewer()` shows the target's desktop full-screen on a local X display. It starts an Xvfb there
if nothing serves it, and waits until the viewer is up. After that, every `framebuffer.py` command
works on the target as if it ran locally:

```js
import { after, before } from 'node:test';
import { openViewer, runDriver } from '@multilane/screen';

let viewer;
before(async () => { viewer = await openViewer(); });   // everything from the environment below
after(() => viewer.close());

const fb = (...args) => runDriver('framebuffer', args, { env: viewer.env });
```

| Variable | |
| --- | --- |
| `SCREEN_TARGET_PROTOCOL` | `vnc` or `rdp` |
| `SCREEN_TARGET_HOST` | VNC `host:display` or `host::port`; RDP `host[:port]` |
| `SCREEN_DISPLAY` | the local display for the viewer (default `:99`) |
| `SCREEN_GEOMETRY` | e.g. `1920x1080`: sizes the Xvfb, and must equal the target's desktop for VNC |
| `SCREEN_TARGET_USER` / `SCREEN_TARGET_PASSWORD` | credentials; required for RDP. They never reach a command line: TigerVNC reads them from its environment, FreeRDP from stdin |

`openViewer` refuses when `SCREEN_RPS_PARTITION` is `PROD`, exactly as `loadFrozenLocator` does.

The viewer flags are what make the picture usable as evidence:

- **Lossless.** TigerVNC runs with `-NoJPEG`; FreeRDP runs with `-gfx`, whose codecs are lossy.
- **1:1 with the target.** VNC never resizes the target; an RDP session takes the local display's
  size.
- **Unattended.** No F8 menu or notice is painted over the first frames, no error dialogs, and no
  certificate prompt: RDP certificates are accepted on first use, then pinned.

A VNC desktop smaller than `SCREEN_GEOMETRY` is centred, which shifts every coordinate. That is why
the geometry must match. `close()` stops the viewer, and the Xvfb if `openViewer` started it; it
escalates to `SIGKILL` because a viewer on a wedged connection can ignore `SIGTERM`.

Outside Node, the same bridge is two processes, for example:

```sh
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp &
VNC_PASSWORD="$SCREEN_TARGET_PASSWORD" DISPLAY=:99 vncviewer -FullScreen -RemoteResize=0 -NoJPEG \
  -Shared -MenuKey= -AlertOnFatalError=0 -ReconnectOnError=0 "$SCREEN_TARGET_HOST" &
```

**Verified:** the engine's live round trip covers VNC end to end: TigerVNC 1.13 into an Xvnc
target, then compare, find, type, OCR, and the target's own answer. The RDP command line is built
from FreeRDP 2.11's flags and checked up to the password prompt, but not yet against a live RDP
server.

## Self-checks

`python3 driver/test_driver.py` runs anywhere, with no display, `gi` or X libraries. It covers the
menu row-count maths, the template-search and diff arithmetic (these need numpy and skip without it),
OCR output parsing and key mapping. It also proves every `doctor` still reports on a host where
everything else is missing. Run it after changing `MULTILANE_MENU_ROW_HEIGHT`.

In an engine checkout, `MULTILANE_SCREEN_E2E=1 node --test packages/screen/test/*.test.mjs` also runs the live
VNC round trip. It needs Xvnc, zenity, vncviewer, Xvfb and xwininfo.
