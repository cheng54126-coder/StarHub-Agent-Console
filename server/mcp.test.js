import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function createFakeMcpServer(script) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jarvis-mcp-"));
  const fakeServer = path.join(tempDir, "fake-mcp-server.mjs");
  await writeFile(fakeServer, script, "utf8");
  return { tempDir, fakeServer };
}

const fakeServerPrelude = `
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin });
function send(message) {
  process.stdout.write(JSON.stringify(message) + "\\n");
}
`;

test("MCP tool sync initializes stdio server and lists tools", async () => {
  const { tempDir, fakeServer } = await createFakeMcpServer(`${fakeServerPrelude}
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "fake-boss-mcp", version: "0.0.1" },
      },
    });
  }
  if (message.method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        tools: [
          { name: "boss_status", description: "status", inputSchema: { type: "object", properties: {} } },
          { name: "boss_search", description: "search", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
        ],
      },
    });
  }
});
`);

  try {
    const { syncMcpTools } = await import(`./mcp.js?case=${Date.now()}-${Math.random()}`);
    const result = await syncMcpTools({
      command: process.execPath,
      args: [fakeServer],
      timeoutMs: 5_000,
    });

    assert.equal(result.ok, true);
    assert.equal(result.server.name, "fake-boss-mcp");
    assert.equal(result.server.version, "0.0.1");
    assert.equal(result.tools.length, 2);
    assert.deepEqual(
      result.tools.map((tool) => tool.name),
      ["boss_status", "boss_search"],
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("MCP tool call invokes boss tool through stdio", async () => {
  const { tempDir, fakeServer } = await createFakeMcpServer(`${fakeServerPrelude}
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "fake-boss-mcp", version: "0.0.1" },
      },
    });
  }
  if (message.method === "tools/call") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        content: [{
          type: "text",
          text: JSON.stringify({
            ok: true,
            command: "search",
            data: [{ title: "qa engineer", city: message.params.arguments.city, salary: "10-15K" }],
            arguments: message.params.arguments,
          }),
        }],
      },
    });
  }
});
`);

  try {
    const { callMcpTool } = await import(`./mcp.js?case=${Date.now()}-${Math.random()}`);
    const result = await callMcpTool("boss_search", {
      query: "qa engineer",
      city: "zhengzhou",
      salary: "10-15K",
    }, {
      command: process.execPath,
      args: [fakeServer],
      timeoutMs: 5_000,
    });

    assert.equal(result.ok, true);
    assert.equal(result.tool, "boss_search");
    assert.equal(result.data.ok, true);
    assert.equal(result.data.arguments.query, "qa engineer");
    assert.equal(result.data.arguments.city, "zhengzhou");
    assert.equal(result.data.arguments.salary, "10-15K");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
