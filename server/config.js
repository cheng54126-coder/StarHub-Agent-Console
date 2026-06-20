import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "..");
export const dataDir = process.env.JARVIS_DATA_DIR || path.join(projectRoot, "data");
export const publicDir = projectRoot;

export const serverConfig = {
  host: process.env.JARVIS_HOST || "127.0.0.1",
  port: Number(process.env.JARVIS_PORT || 8787),
  maxBodyBytes: 1024 * 1024,
  requestTimeoutMs: 60_000,
};

const userProfile = process.env.USERPROFILE || "C:\\Users\\86156";
const defaultBossMcpPath = process.env.BOSS_MCP_PATH || path.join(userProfile, ".local", "bin", "boss-mcp.exe");

export const defaultAiConfig = {
  provider: "ollama",
  endpoint: "http://127.0.0.1:11434/v1",
  model: "qwen2.5:7b",
  apiKey: "",
  requestFormat: "openai-compatible",
  requestMethod: "POST",
  requestPath: "",
  headersTemplate: "",
  bodyTemplate: "",
  responsePath: "",
  temperature: 0.4,
  voiceInput: true,
  voiceOutput: true,
  voiceProfile: "jarvis",
  memory: false,
};

export const defaultRuntimeState = {
  awake: false,
  agentMode: "standby",
  visualTheme: "aurora",
  subtitleState: "Standby",
  subtitleText: "系统待命。点击核心唤醒我。",
  microphone: "Pending",
  screen: "Pending",
  webSearch: "Idle",
  mcp: "Configured",
  updatedAt: null,
};

export const defaultMcpConfig = {
  servers: [
    {
      id: "boss",
      name: "boss-mcp",
      enabled: true,
      transport: "stdio",
      command: defaultBossMcpPath,
      args: ["--transport", "stdio"],
      cwd: userProfile,
      env: {},
    },
  ],
};
