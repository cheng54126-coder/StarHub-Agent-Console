import { appendEvent, getRuntimeState, saveRuntimeState } from "./store.js";

const commandResponses = {
  wake: {
    state: { awake: true, subtitleState: "Online" },
    subtitle: "晚上好。我已接管语音入口，正在等待你的下一条指令。",
    log: "Wake signal accepted.",
  },
  sleep: {
    state: { awake: false, subtitleState: "Standby" },
    subtitle: "收到。我会保持后台待命，必要时再次唤醒。",
    log: "Agent returned to standby.",
  },
  "检查麦克风": {
    subtitle: "我将检查麦克风权限。浏览器可能会弹出授权提示。",
    log: "Microphone check requested.",
  },
  "连接 MCP": {
    subtitle: "正在连接 MCP 网关。当前已配置 boss-mcp，可作为求职流程工具入口。",
    log: "MCP connection requested.",
  },
  "同步 MCP 工具": {
    subtitle: "正在同步 MCP 工具清单：搜索职位、推荐职位、读取聊天和指定职位投递。",
    log: "MCP tool sync requested.",
  },
  "测试 boss-mcp": {
    subtitle: "正在检查 boss-mcp 状态。",
    log: "boss-mcp status requested.",
  },
  "保存 AI 配置": {
    subtitle: "AI 配置已保存到本地后端。",
    log: "AI config save requested.",
  },
  "测试 AI 连接": {
    subtitle: "正在测试 AI 服务连接。",
    log: "AI connection test requested.",
  },
  "重置 AI 配置": {
    subtitle: "AI 配置已恢复为默认值。",
    log: "AI config reset requested.",
  },
  "打开任务中心": {
    subtitle: "任务中心已准备好。可以继续接入搜索、总结、文件整理和系统操作。",
    log: "Task center opened.",
  },
  "启动本地模型": {
    subtitle: "本地模型通道已标记为待启动。请确认 Ollama 或兼容 OpenAI 的服务正在运行。",
    log: "Local model start requested.",
  },
  "读取屏幕": {
    subtitle: "屏幕读取属于敏感权限，执行前需要你确认目标窗口。",
    log: "Screen read requested.",
  },
  "搜索网页": {
    subtitle: "网页搜索工具已排队。接入浏览器自动化后我可以打开、检索并总结结果。",
    log: "Web search requested.",
  },
};

const validThemes = new Set(["aurora", "ember", "frost"]);
const validModes = new Set(["standby", "operator", "silent"]);

function commandResult({ command, state, subtitle, log }) {
  return {
    command,
    state,
    subtitle: {
      state: state.subtitleState || (state.awake ? "Listening" : "Standby"),
      text: subtitle,
    },
    log,
  };
}

export async function runCommand({ command, payload = {} }) {
  if (command === "set-theme") {
    const visualTheme = validThemes.has(payload.visualTheme) ? payload.visualTheme : "aurora";
    const state = await saveRuntimeState({ visualTheme });
    const subtitle = `视觉风格已切换为 ${visualTheme}。`;
    await appendEvent("command.executed", { command, visualTheme, message: `Visual theme switched to ${visualTheme}.` });
    return commandResult({ command, state, subtitle, log: `Visual theme switched to ${visualTheme}.` });
  }

  if (command === "set-mode") {
    const agentMode = validModes.has(payload.agentMode) ? payload.agentMode : "standby";
    const state = await saveRuntimeState({ agentMode });
    const subtitle = `模式已切换为 ${agentMode}。`;
    await appendEvent("command.executed", { command, agentMode, message: `Mode switched to ${agentMode}.` });
    return commandResult({ command, state, subtitle, log: `Mode switched to ${agentMode}.` });
  }

  const response = commandResponses[command];
  if (!response) {
    throw new Error(`Unsupported command: ${command}`);
  }

  const current = await getRuntimeState();
  const nextState = await saveRuntimeState({
    ...response.state,
    subtitleText: response.subtitle,
    subtitleState: response.state?.subtitleState || current.subtitleState,
  });
  await appendEvent("command.executed", { command, message: response.log });
  return commandResult({
    command,
    state: nextState,
    subtitle: response.subtitle,
    log: response.log,
  });
}
