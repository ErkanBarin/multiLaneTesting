"""
multilanetesting-driver — Python actuation layer for the screen-driver lane.

Complements @erkanbarin/screen (JS): the JS side loads and validates frozen locators;
this package actuates them — input synthesis, image-template matching, OCR, and
object-introspection. AI is allowed at authoring time only; the runtime driver is
fully deterministic.

Implementation status:

  Tier 1 — object introspection.
      Linux/AT-SPI: IMPLEMENTED, but it does not live here. The two scripts ship inside the npm
      package @erkanbarin/screen (`packages/screen/driver/`), because npm is the channel consumers
      already install from and this Python package is not published anywhere. They speak
      argv-in / JSON-out, so nothing has to import them as a library; resolve them with
      `driverScriptPath()` from @erkanbarin/screen, and run them with the *system* interpreter
      (`gi` cannot be pip-installed into a venv).
      Windows/UIA: not started — pywinauto is declared in the a11y-windows extra only.
  Tier 2 — image template, plus capture, the golden-image (rendering) and offline-OCR (legibility)
      oracles, XTEST input, and a VNC/RDP viewer bridge: IMPLEMENTED in the same npm package
      (`driver/framebuffer.py`, `openViewer()`), for the same reason as Tier 1 — it must run under
      the system interpreter next to `gi`, and npm is the channel consumers install from. It uses
      numpy (a distro package) where this pyproject names OpenCV (a pip wheel).
  Tier 3 — authoring-only discovery via offline OCR (paddleocr / easyocr extras). The screen-driver
      MCP server in @erkanbarin/authoring-screen offers Tesseract word boxes for discovery.
      no-runtime-ai:allow — naming those two extras in a docstring is not importing them. This
      module has no runtime model dependency; when Tier 3 lands it goes under authoring/.

So this package is still a stub. Everything implemented so far went where it could be delivered.
"""

__version__ = "0.1.0"
