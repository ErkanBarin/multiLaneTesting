type JsonRpcId = number | string | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

const SERVER_NAME = "screen-driver";
const SERVER_VERSION = "0.1.0";
const MODE = process.env.SCREEN_DRIVER_MODE ?? "";

// Explicit opt-in: authoring-only server must never start implicitly (e.g. from a test-run
// environment that never set the mode).
if (MODE !== "authoring") {
  process.stderr.write(
    `[${SERVER_NAME}] Refusing to start: SCREEN_DRIVER_MODE must be set to "authoring" explicitly (got "${MODE}").\n`,
  );
  process.exit(1);
}

// MCP stdio transport: newline-delimited JSON-RPC messages.
let buffer = "";

process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line) {
      handlePayload(line);
    }
    newlineIndex = buffer.indexOf("\n");
  }
});

process.stdin.on("end", () => {
  process.exit(0);
});

function handlePayload(payload: string): void {
  let msg: JsonRpcRequest;
  try {
    msg = JSON.parse(payload) as JsonRpcRequest;
  } catch {
    return;
  }

  if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return;
  }

  if (msg.method === "notifications/initialized") {
    return;
  }

  if (typeof msg.id === "undefined") {
    // Ignore notifications that are not part of startup.
    return;
  }

  switch (msg.method) {
    case "initialize": {
      respond(msg.id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION,
        },
      });
      return;
    }

    case "tools/list": {
      respond(msg.id, {
        tools: [
          {
            name: "screen_driver.health",
            description:
              "Return server status and the current screen-driver MCP mode.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: "screen_driver.describe_authoring_flow",
            description:
              "Explain the deterministic authoring flow: discover, freeze, human review, replay.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: "screen_driver.list_channels",
            description:
              "Describe supported channel types used for discovery and runtime assertions.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: "screen_driver.freeze_locator_dry_run",
            description:
              "Validate and preview a locator freeze record without writing files.",
            inputSchema: {
              type: "object",
              properties: {
                area: { type: "string" },
                key: { type: "string" },
                tier: { type: "integer", enum: [1, 2] },
                resolver: { type: "string" },
                requirement_ref: { type: "string" },
              },
              required: ["area", "key", "tier", "resolver", "requirement_ref"],
              additionalProperties: false,
            },
          },
        ],
      });
      return;
    }

    case "tools/call": {
      const params = msg.params as ToolCallParams | undefined;
      if (!params || typeof params.name !== "string") {
        error(msg.id, -32602, "Invalid params for tools/call.");
        return;
      }

      handleToolCall(msg.id, params);
      return;
    }

    default: {
      error(msg.id, -32601, `Method not found: ${msg.method}`);
    }
  }
}

function handleToolCall(id: JsonRpcId, params: ToolCallParams): void {
  switch (params.name) {
    case "screen_driver.health": {
      respondTool(id, {
        ok: true,
        server: SERVER_NAME,
        version: SERVER_VERSION,
        mode: MODE,
        authoringOnly: true,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    case "screen_driver.describe_authoring_flow": {
      respondTool(id, {
        goal: "Authoring-time discovery and freeze of deterministic runtime locators.",
        flow: [
          "1) Discover control via object socket/control tree when available.",
          "2) Fallback to template-based Tier-2 discovery when no object channel exists.",
          "3) Optionally use local CV+offline OCR to propose a candidate (authoring only).",
          "4) Human reviews and freezes locator metadata (tier/resolver/requirement_ref).",
          "5) Runtime replays frozen locators only; no MCP discovery and no model in loop.",
        ],
        invariants: [
          "AI at authoring only, never at runtime.",
          "Replay into test partitions (never PROD).",
          "No host literals or secrets in committed artifacts.",
        ],
      });
      return;
    }

    case "screen_driver.list_channels": {
      respondTool(id, {
        channels: [
          {
            name: "object_socket",
            tier: 1,
            role: "Primary functional channel where available.",
          },
          {
            name: "native_ui_automation_tree",
            tier: 1,
            role: "Native control tree path for symbolic control resolution.",
          },
          {
            name: "template_match",
            tier: 2,
            role: "Pixel template fallback with DPI/resolution/theme stamp.",
          },
          {
            name: "local_cv_ocr_discovery",
            tier: 3,
            role: "Authoring-only candidate proposal, never runtime.",
          },
        ],
      });
      return;
    }

    case "screen_driver.freeze_locator_dry_run": {
      const args = params.arguments ?? {};
      const area = String(args.area ?? "").trim();
      const key = String(args.key ?? "").trim();
      const resolver = String(args.resolver ?? "").trim();
      const requirementRef = String(args.requirement_ref ?? "").trim();
      const tier = Number(args.tier);

      if (!area || !key || !resolver || !requirementRef || ![1, 2].includes(tier)) {
        error(id, -32602, "Invalid freeze_locator_dry_run arguments.");
        return;
      }

      respondTool(id, {
        valid: true,
        outputPath: `locators/${area}/${key}.json`,
        recordPreview: {
          tier,
          resolver,
          requirement_ref: requirementRef,
          last_verified: new Date().toISOString().slice(0, 10),
        },
        note: "Dry run only. No file was written by this tool.",
      });
      return;
    }

    default: {
      error(id, -32602, `Unknown tool: ${params.name}`);
    }
  }
}

function respondTool(id: JsonRpcId, payload: unknown): void {
  respond(id, {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  });
}

function respond(id: JsonRpcId, result: unknown): void {
  writeJson({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function error(id: JsonRpcId, code: number, message: string): void {
  writeJson({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  });
}

function writeJson(payload: unknown): void {
  process.stdout.write(JSON.stringify(payload) + "\n");
}
