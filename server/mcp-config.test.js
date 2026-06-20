import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function withTempDataDir(fn) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jarvis-mcp-config-"));
  const previous = process.env.JARVIS_DATA_DIR;
  process.env.JARVIS_DATA_DIR = tempDir;
  try {
    await fn(tempDir);
  } finally {
    if (previous === undefined) {
      delete process.env.JARVIS_DATA_DIR;
    } else {
      process.env.JARVIS_DATA_DIR = previous;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function createFakeMcpServer(script) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jarvis-mcp-server-"));
  const fakeServer = path.join(tempDir, "fake-mcp-server.mjs");
  await writeFile(fakeServer, script, "utf8");
  return { tempDir, fakeServer };
}

const fakeServerScript = `
import readline from "node:readline";
const rl = readline.createInterface({ input: process.stdin });
function send(message) {
  process.stdout.write(JSON.stringify(message) + "\\n");
}
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "fake-config-mcp", version: "0.1.0" },
      },
    });
  }
  if (message.method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: { tools: [{ name: "fake_search", description: "search", inputSchema: { type: "object" } }] },
    });
  }
});
`;

test("MCP config defaults to enabled boss stdio server", async () => {
  await withTempDataDir(async () => {
    const { getMcpConfig } = await import(`./store.js?case=${Date.now()}-${Math.random()}`);
    const config = await getMcpConfig();

    assert.equal(config.servers.length, 1);
    assert.equal(config.servers[0].id, "boss");
    assert.equal(config.servers[0].enabled, true);
    assert.equal(config.servers[0].transport, "stdio");
    assert.match(config.servers[0].command, /boss-mcp\.exe$/);
  });
});

test("configured MCP sync only connects enabled servers and namespaces returned tools", async () => {
  await withTempDataDir(async () => {
    const { tempDir, fakeServer } = await createFakeMcpServer(fakeServerScript);
    try {
      const { saveMcpConfig } = await import(`./store.js?case=${Date.now()}-${Math.random()}`);
      const { syncConfiguredMcpTools } = await import(`./mcp.js?case=${Date.now()}-${Math.random()}`);
      await saveMcpConfig({
        servers: [
          {
            id: "fake",
            name: "Fake MCP",
            enabled: true,
            transport: "stdio",
            command: process.execPath,
            args: [fakeServer],
            env: {},
          },
          {
            id: "disabled",
            name: "Disabled MCP",
            enabled: false,
            transport: "stdio",
            command: "missing-command",
            args: [],
            env: {},
          },
        ],
      });

      const result = await syncConfiguredMcpTools({ timeoutMs: 5_000 });

      assert.equal(result.ok, true);
      assert.equal(result.toolCount, 1);
      assert.equal(result.servers.length, 2);
      assert.equal(result.servers.find((server) => server.id === "disabled").available, false);
      assert.deepEqual(result.tools.map((tool) => tool.name), ["fake.fake_search"]);
      assert.equal(result.tools[0].serverId, "fake");
      assert.equal(result.tools[0].originalName, "fake_search");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
