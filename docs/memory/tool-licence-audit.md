# Tool Licence & Offline Audit — screen-driver lane

_Last verified: 2026-06-30. Decision rule: MIT/Apache preferred, zero runtime network egress, broadest Win32 + VNC coverage._

| Tool | SPDX Licence | Offline? | Date verified | Notes |
|---|---|---|---|---|
| pywinauto | BSD-3-Clause | Yes | 2026-06-30 | Tier-1 native UI automation on Win32/desktop application via MS UI Automation (`backend="uia"`). BSD since 0.6.0 (LGPL only ≤0.5.4). |
| OpenCV | Apache-2.0 | Yes | 2026-06-30 | Tier-2 template match + Tier-3 authoring region proposals. Apache since 4.x. |
| PaddleOCR | Apache-2.0 | Yes | 2026-06-30 | Primary OCR oracle; PP-OCRv6 strong on digital/dot-matrix readouts. Pre-provision weights offline. |
| EasyOCR | Apache-2.0 | Yes | 2026-06-30 | OCR fallback (was assumed MIT — actually Apache-2.0). Pre-provision weights into `~/.EasyOCR/model`. |
| Tesseract | Apache-2.0 | Yes | 2026-06-30 | Alternate OCR oracle. |
| Playwright / playwright-mcp | Apache-2.0 | n/a | 2026-06-30 | Web/DOM lane only; DOM/browser automation, no vision model. Not a VNC/RDP/Win32 driver. |
| screen-driver MCP (local) | repo-internal | Yes | 2026-06-30 | `tsx drivers/mcp/server.ts`, authoring mode; local launch, no network. No MS VNC/RDP MCP exists. |
| OmniParser v2 | AGPL-3.0 (icon_detect) / MIT (icon_caption) / CC-BY-4.0 (code) | Yes | 2026-06-30 | **Dropped.** YOLO-inherited AGPL on the detector is copyleft — prohibited even at authoring. |
| computer-use loop (OmniTool + external LLM) | proprietary / varies | No | 2026-06-30 | **Dropped.** Sends screenshots to external LLM APIs — no air-gapped egress permitted. |

Sources: github.com/microsoft/OmniParser (Model Weights License) + raw `LICENSE`; github.com/pywinauto/pywinauto; github.com/opencv/opencv; github.com/JaidedAI/EasyOCR; github.com/PaddlePaddle/PaddleOCR; github.com/microsoft/playwright-mcp.
