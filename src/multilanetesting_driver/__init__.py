"""
multilanetesting-driver — Python actuation layer for the screen-driver lane.

Complements @multilane/screen (JS): the JS side loads and validates frozen locators;
this package actuates them — input synthesis, image-template matching, OCR, and
object-introspection. AI is allowed at authoring time only; the runtime driver is
fully deterministic.

Implementation status: stub. Tier 1 (object introspection) is the starting point.

  Tier 1 — object introspection: pywinauto (Windows) / python-atspi (Linux).
  Tier 2 — image template: OpenCV template match against a frozen screenshot crop.
  Tier 3 — authoring-only discovery via offline OCR (paddleocr / easyocr extras).
"""

__version__ = "0.1.0"
