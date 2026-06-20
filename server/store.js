import fs from "node:fs/promises";
import path from "node:path";
import { dataDir as defaultDataDir, defaultAiConfig, defaultMcpConfig, defaultRuntimeState } from "./config.js";

const defaultApplyWorkbenchState = {
  criteria: {
    query: "",
    city: "",
    salary: "",
    count: 10,
  },
  jobs: [],
  updatedAt: null,
};

function currentDataDir() {
  return process.env.JARVIS_DATA_DIR || defaultDataDir;
}

function filePath(name) {
  return path.join(currentDataDir(), name);
}

export async function ensureStore() {
  await fs.mkdir(currentDataDir(), { recursive: true });
  await ensureJson(filePath("ai-config.json"), defaultAiConfig);
  await ensureJson(filePath("mcp-config.json"), defaultMcpConfig);
  await ensureJson(filePath("runtime-state.json"), defaultRuntimeState);
  await ensureJson(filePath("chat-history.json"), []);
  await ensureJson(filePath("apply-workbench.json"), defaultApplyWorkbenchState);
}

async function ensureJson(file, fallback) {
  try {
    await fs.access(file);
  } catch {
    await writeJson(file, fallback);
  }
}

export async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function getAiConfig() {
  return {
    ...defaultAiConfig,
    ...(await readJson(filePath("ai-config.json"), defaultAiConfig)),
  };
}

function maskApiKey(apiKey = "") {
  const key = String(apiKey || "");
  if (!key) return "";
  if (key.length <= 8) return "configured";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

const supportedVoiceProfiles = ["jarvis", "calm", "deep", "bright", "fast"];

export async function getPublicAiConfig() {
  const config = await getAiConfig();
  const hasApiKey = Boolean(config.apiKey);
  return {
    ...config,
    apiKey: "",
    hasApiKey,
    apiKeyPreview: hasApiKey ? maskApiKey(config.apiKey) : "",
  };
}

export async function saveAiConfig(nextConfig) {
  const current = await getAiConfig();
  const requestFormat = [
    "openai-compatible",
    "openai-responses",
    "openai-completions",
    "claude-compatible",
    "claude-bearer-compatible",
    "gemini-compatible",
    "codex-responses",
    "custom-template",
  ].includes(nextConfig.requestFormat)
    ? nextConfig.requestFormat
    : current.requestFormat || defaultAiConfig.requestFormat;
  const voiceProfile = supportedVoiceProfiles.includes(nextConfig.voiceProfile)
    ? nextConfig.voiceProfile
    : current.voiceProfile || defaultAiConfig.voiceProfile;
  const nextApiKey = Object.hasOwn(nextConfig, "apiKey") ? String(nextConfig.apiKey || "").trim() : undefined;
  const merged = {
    ...current,
    ...nextConfig,
    apiKey: nextApiKey === undefined || nextApiKey === "" ? current.apiKey || "" : nextApiKey,
    requestFormat,
    voiceProfile,
    temperature: Number(nextConfig.temperature ?? current.temperature ?? 0.4),
  };
  await writeJson(filePath("ai-config.json"), merged);
  await appendEvent("ai.config.saved", { provider: merged.provider, model: merged.model });
  return merged;
}

export async function resetAiConfig() {
  await writeJson(filePath("ai-config.json"), defaultAiConfig);
  await appendEvent("ai.config.reset", { provider: defaultAiConfig.provider });
  return defaultAiConfig;
}

function normalizeMcpServer(server = {}, index = 0) {
  const fallback = defaultMcpConfig.servers[index] || defaultMcpConfig.servers[0];
  const rawId = String(server.id || server.name || fallback?.id || `mcp-${index + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const env = server.env && typeof server.env === "object" && !Array.isArray(server.env)
    ? Object.fromEntries(Object.entries(server.env).map(([key, value]) => [String(key), String(value)]))
    : {};
  return {
    id: rawId || `mcp-${index + 1}`,
    name: String(server.name || fallback?.name || rawId || `MCP ${index + 1}`).trim(),
    enabled: server.enabled !== false,
    transport: server.transport === "stdio" ? "stdio" : "stdio",
    command: String(server.command || fallback?.command || "").trim(),
    args: Array.isArray(server.args) ? server.args.map((arg) => String(arg)) : [...(fallback?.args || [])],
    cwd: String(server.cwd || fallback?.cwd || "").trim(),
    env,
  };
}

export async function getMcpConfig() {
  const saved = await readJson(filePath("mcp-config.json"), defaultMcpConfig);
  const sourceServers = Array.isArray(saved?.servers) && saved.servers.length ? saved.servers : defaultMcpConfig.servers;
  return {
    servers: sourceServers.map(normalizeMcpServer).filter((server) => server.command),
  };
}

export async function saveMcpConfig(nextConfig = {}) {
  const sourceServers = Array.isArray(nextConfig.servers) ? nextConfig.servers : [];
  const servers = sourceServers.map(normalizeMcpServer).filter((server) => server.command);
  const config = {
    servers: servers.length ? servers : defaultMcpConfig.servers.map(normalizeMcpServer),
  };
  await writeJson(filePath("mcp-config.json"), config);
  await appendEvent("mcp.config.saved", { serverCount: config.servers.length });
  return config;
}

export async function getRuntimeState() {
  return {
    ...defaultRuntimeState,
    ...(await readJson(filePath("runtime-state.json"), defaultRuntimeState)),
  };
}

export async function saveRuntimeState(nextState) {
  const current = await getRuntimeState();
  const merged = {
    ...current,
    ...nextState,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(filePath("runtime-state.json"), merged);
  await appendEvent("runtime.state.saved", {
    awake: merged.awake,
    agentMode: merged.agentMode,
    visualTheme: merged.visualTheme,
  });
  return merged;
}

export async function getChatHistory() {
  const messages = await readJson(filePath("chat-history.json"), []);
  return Array.isArray(messages) ? messages.slice(-10) : [];
}

export async function addChatMessage(message) {
  const messages = await getChatHistory();
  const nextMessage = {
    id: message.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role: message.role || "user",
    text: String(message.text || ""),
    time: message.time || new Date().toISOString(),
  };
  const nextMessages = [...messages, nextMessage].slice(-10);
  await writeJson(filePath("chat-history.json"), nextMessages);
  await appendEvent("chat.message.added", { role: nextMessage.role });
  return nextMessage;
}

export async function replaceChatHistory(messages) {
  const safeMessages = Array.isArray(messages) ? messages.slice(-10) : [];
  await writeJson(filePath("chat-history.json"), safeMessages);
  await appendEvent("chat.history.replaced", { count: safeMessages.length });
  return safeMessages;
}

export async function clearChatHistory() {
  await writeJson(filePath("chat-history.json"), []);
  await appendEvent("chat.history.cleared", {});
  return [];
}

export async function getApplyWorkbenchState() {
  const saved = await readJson(filePath("apply-workbench.json"), defaultApplyWorkbenchState);
  return {
    ...defaultApplyWorkbenchState,
    ...saved,
    criteria: {
      ...defaultApplyWorkbenchState.criteria,
      ...(saved?.criteria || {}),
    },
    jobs: Array.isArray(saved?.jobs) ? saved.jobs : [],
    updatedAt: saved?.updatedAt || null,
  };
}

export async function saveApplyWorkbenchState(nextState = {}) {
  const current = await getApplyWorkbenchState();
  const merged = {
    ...current,
    ...nextState,
    criteria: {
      ...current.criteria,
      ...(nextState.criteria || {}),
    },
    jobs: Array.isArray(nextState.jobs) ? nextState.jobs : current.jobs,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(filePath("apply-workbench.json"), merged);
  await appendEvent("apply.workbench.saved", { jobCount: merged.jobs.length });
  return merged;
}

export async function appendEvent(type, payload) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    type,
    payload,
  });
  await fs.mkdir(currentDataDir(), { recursive: true });
  await fs.appendFile(filePath("events.jsonl"), `${line}\n`, "utf8");
}

export async function getRecentEvents(limit = 20) {
  try {
    const raw = await fs.readFile(filePath("events.jsonl"), "utf8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(-Math.max(1, Number(limit) || 20))
      .reverse();
  } catch {
    return [];
  }
}
