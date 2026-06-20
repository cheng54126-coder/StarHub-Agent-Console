import { spawn } from "node:child_process";
import path from "node:path";
import { appendEvent, getMcpConfig } from "./store.js";

const bossMcpPath = "C:\\Users\\86156\\.local\\bin\\boss-mcp.exe";
const bossCliPath = "C:\\Users\\86156\\.local\\bin\\boss.exe";
const bossBinDir = path.dirname(bossMcpPath);
const bossToolScriptsDir = "C:\\Users\\86156\\AppData\\Roaming\\uv\\tools\\boss-agent-cli\\Scripts";
const defaultMcpCwd = process.env.USERPROFILE || "C:\\Users\\86156";
const mcpProtocolVersion = "2024-11-05";

function runCommand(command, args, timeoutMs = 10_000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}\nTimed out`.trim() });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, stdout, stderr: error.message });
    });
  });
}

function normalizeTool(tool = {}) {
  return {
    name: String(tool.name || ""),
    description: String(tool.description || ""),
    inputSchema: tool.inputSchema || { type: "object", properties: {} },
  };
}

function createMcpEnv(env = {}) {
  const merged = { ...process.env, ...env };
  const pathKey = Object.keys(merged).find((key) => key.toLowerCase() === "path") || "PATH";
  const separator = process.platform === "win32" ? ";" : ":";
  const currentPath = merged[pathKey] || "";
  const pathParts = currentPath.split(separator).filter(Boolean);
  const requiredPaths = [bossBinDir, bossToolScriptsDir];
  const missingPaths = requiredPaths.filter(
    (required) => !pathParts.some((item) => item.toLowerCase() === required.toLowerCase()),
  );

  merged[pathKey] = [...missingPaths, currentPath].filter(Boolean).join(separator);
  return merged;
}

function createMcpClient({
  command = bossMcpPath,
  args = ["--transport", "stdio"],
  timeoutMs = 15_000,
  cwd = defaultMcpCwd,
  env = {},
} = {}) {
  const child = spawn(command, args, {
    cwd,
    env: createMcpEnv(env),
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let nextId = 1;
  let stdoutBuffer = "";
  let stderr = "";
  let settled = false;
  const pending = new Map();

  const close = () => {
    if (!child.killed) child.kill();
  };

  const failAll = (error) => {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  };

  const timer = setTimeout(() => {
    settled = true;
    failAll(new Error(`MCP request timed out after ${timeoutMs}ms`));
    close();
  }, timeoutMs);

  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString("utf8");
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      const waiter = pending.get(message.id);
      if (!waiter) continue;
      pending.delete(message.id);
      if (message.error) {
        waiter.reject(new Error(message.error.message || `MCP error ${message.error.code || ""}`.trim()));
      } else {
        waiter.resolve(message.result);
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  child.on("error", (error) => {
    settled = true;
    failAll(error);
  });

  child.on("close", (code) => {
    clearTimeout(timer);
    if (settled || pending.size === 0) return;
    failAll(new Error(`MCP process exited with code ${code}${stderr ? `: ${stderr}` : ""}`));
  });

  const send = (message) => {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };

  const request = (method, params = {}) => {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      send({ jsonrpc: "2.0", id, method, params });
    });
  };

  const notify = (method, params = {}) => {
    send({ jsonrpc: "2.0", method, params });
  };

  return { request, notify, close };
}

async function withInitializedMcpClient(options, callback) {
  const client = createMcpClient(options);
  try {
    const initialized = await client.request("initialize", {
      protocolVersion: mcpProtocolVersion,
      capabilities: {},
      clientInfo: {
        name: "jarvis-wake-console",
        version: "0.1.0",
      },
    });
    client.notify("notifications/initialized");
    return await callback(client, initialized);
  } finally {
    client.close();
  }
}

function parseMcpContent(content = []) {
  const text = Array.isArray(content)
    ? content
      .filter((item) => item?.type === "text" && typeof item.text === "string")
      .map((item) => item.text)
      .join("\n")
    : "";
  if (!text.trim()) return { text };
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

export async function syncMcpTools(options = {}) {
  try {
    return await withInitializedMcpClient(options, async (client, initialized) => {
    const listed = await client.request("tools/list");
    const tools = Array.isArray(listed?.tools) ? listed.tools.map(normalizeTool).filter((tool) => tool.name) : [];
    const result = {
      ok: true,
      protocolVersion: initialized?.protocolVersion || mcpProtocolVersion,
      capabilities: initialized?.capabilities || {},
      server: {
        name: initialized?.serverInfo?.name || "boss",
        version: initialized?.serverInfo?.version || "",
        transport: "stdio",
        command: options.command || bossMcpPath,
        available: true,
      },
      tools,
      toolCount: tools.length,
      syncedAt: new Date().toISOString(),
    };
    await appendEvent("mcp.tools.synced", { ok: true, toolCount: tools.length });
    return result;
    });
  } catch (error) {
    await appendEvent("mcp.tools.synced", { ok: false, error: error.message });
    throw error;
  }
}

function publicServerStatus(configServer, syncResult = {}) {
  return {
    id: configServer.id,
    name: syncResult.server?.name || configServer.name,
    label: configServer.name,
    version: syncResult.server?.version || "",
    transport: configServer.transport,
    command: configServer.command,
    enabled: configServer.enabled,
    available: Boolean(syncResult.ok),
    error: syncResult.error || "",
    toolCount: syncResult.toolCount || 0,
    syncedAt: syncResult.syncedAt || null,
  };
}

export async function syncConfiguredMcpTools(options = {}) {
  const config = await getMcpConfig();
  const servers = [];
  const tools = [];

  for (const server of config.servers) {
    if (!server.enabled) {
      servers.push({
        id: server.id,
        name: server.name,
        label: server.name,
        version: "",
        transport: server.transport,
        command: server.command,
        enabled: false,
        available: false,
        error: "Disabled",
        toolCount: 0,
        syncedAt: null,
      });
      continue;
    }

    try {
      const result = await syncMcpTools({
        command: server.command,
        args: server.args,
        cwd: server.cwd || undefined,
        env: server.env || {},
        timeoutMs: options.timeoutMs || 15_000,
      });
      servers.push(publicServerStatus(server, result));
      for (const tool of result.tools) {
        tools.push({
          ...tool,
          name: `${server.id}.${tool.name}`,
          originalName: tool.name,
          serverId: server.id,
          serverName: server.name,
        });
      }
    } catch (error) {
      servers.push(publicServerStatus(server, { ok: false, error: error.message }));
    }
  }

  const availableServers = servers.filter((server) => server.available).length;
  await appendEvent("mcp.configured.synced", { serverCount: servers.length, availableServers, toolCount: tools.length });
  return {
    ok: availableServers > 0,
    servers,
    tools,
    toolCount: tools.length,
    syncedAt: new Date().toISOString(),
  };
}

export async function callMcpTool(name, argumentsObject = {}, options = {}) {
  try {
    return await withInitializedMcpClient(options, async (client, initialized) => {
      const result = await client.request("tools/call", {
        name,
        arguments: argumentsObject,
      });
      const parsed = parseMcpContent(result?.content);
      const response = {
        ok: !result?.isError,
        tool: name,
        arguments: argumentsObject,
        server: {
          name: initialized?.serverInfo?.name || "boss",
          version: initialized?.serverInfo?.version || "",
        },
        content: result?.content || [],
        data: parsed,
        isError: Boolean(result?.isError),
      };
      await appendEvent("mcp.tool.called", { tool: name, ok: response.ok });
      return response;
    });
  } catch (error) {
    await appendEvent("mcp.tool.called", { tool: name, ok: false, error: error.message });
    throw error;
  }
}

export async function getMcpStatus() {
  const [bossMcp, bossStatus, syncResult] = await Promise.all([
    runCommand(bossMcpPath, ["--help"], 10_000),
    runCommand(bossCliPath, ["status"], 15_000),
    syncConfiguredMcpTools({ timeoutMs: 15_000 }).catch((error) => ({ ok: false, error: error.message, tools: [], servers: [] })),
  ]);
  const primaryServer = syncResult.servers?.find((server) => server.available) || syncResult.servers?.[0] || {};
  await appendEvent("mcp.status.checked", {
    bossMcp: bossMcp.ok,
    bossStatus: bossStatus.ok,
    mcpHandshake: syncResult.ok,
  });

  return {
    ok: syncResult.ok,
    server: {
      id: primaryServer.id || "boss",
      name: primaryServer.name || "boss",
      version: primaryServer.version || "",
      transport: primaryServer.transport || "stdio",
      command: primaryServer.command || bossMcpPath,
      available: syncResult.ok,
      error: syncResult.error || "",
    },
    servers: syncResult.servers || [],
    boss: {
      available: bossStatus.ok,
      stdout: bossStatus.stdout.slice(0, 2000),
      stderr: bossStatus.stderr.slice(0, 2000),
    },
    tools: syncResult.tools || [],
    toolCount: syncResult.toolCount || 0,
  };
}

export async function runBossTool(action, payload = {}) {
  const allowed = new Map([
    ["status", ["status"]],
    ["doctor", ["doctor"]],
    ["search", ["search", payload.query || "", ...(payload.city ? ["--city", payload.city] : [])]],
    ["recommend", ["recommend"]],
  ]);

  if (!allowed.has(action)) {
    throw new Error(`Unsupported boss action: ${action}`);
  }

  const result = await runCommand(bossCliPath, allowed.get(action), 30_000);
  await appendEvent("mcp.boss.action", { action, ok: result.ok });
  return result;
}
