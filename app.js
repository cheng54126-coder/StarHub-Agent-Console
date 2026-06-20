const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const orbCanvas = document.getElementById("orbScene");
const orbCtx = orbCanvas.getContext("2d");
const wakeButton = document.getElementById("wakeButton");
const statusBadge = document.getElementById("statusBadge");
const modeBadge = document.getElementById("modeBadge");
const themeBadge = document.getElementById("themeBadge");
const micState = document.getElementById("micState");
const logList = document.getElementById("logList");
const chatList = document.getElementById("chatList");
const clearChatButton = document.getElementById("clearChatButton");
const modalBackdrop = document.getElementById("modalBackdrop");
const clock = document.getElementById("clock");
const jarvisSubtitle = document.getElementById("jarvisSubtitle");
const subtitleState = document.getElementById("subtitleState");
const mcpBadge = document.getElementById("mcpBadge");
const mcpServerState = document.getElementById("mcpServerState");
const mcpToolChips = document.querySelector(".tool-chips");
const mcpServerList = document.getElementById("mcpServerList");
const mcpServerId = document.getElementById("mcpServerId");
const mcpServerName = document.getElementById("mcpServerName");
const mcpServerCommand = document.getElementById("mcpServerCommand");
const mcpServerArgs = document.getElementById("mcpServerArgs");
const mcpServerEnv = document.getElementById("mcpServerEnv");
const mcpServerEnabled = document.getElementById("mcpServerEnabled");
const applyBadge = document.getElementById("applyBadge");
const applyKeyword = document.getElementById("applyKeyword");
const applyCity = document.getElementById("applyCity");
const applySalary = document.getElementById("applySalary");
const applyCount = document.getElementById("applyCount");
const applyJobList = document.getElementById("applyJobList");
const applyGreeting = document.getElementById("applyGreeting");
const applyProgress = document.getElementById("applyProgress");
const applyDetailPanel = document.getElementById("applyDetailPanel");
const aiConfigBadge = document.getElementById("aiConfigBadge");
const aiProvider = document.getElementById("aiProvider");
const aiEndpoint = document.getElementById("aiEndpoint");
const aiModel = document.getElementById("aiModel");
const aiApiKey = document.getElementById("aiApiKey");
const aiKeyState = document.getElementById("aiKeyState");
const aiRequestFormat = document.getElementById("aiRequestFormat");
const aiRequestMethod = document.getElementById("aiRequestMethod");
const aiRequestPath = document.getElementById("aiRequestPath");
const aiHeadersTemplate = document.getElementById("aiHeadersTemplate");
const aiBodyTemplate = document.getElementById("aiBodyTemplate");
const aiResponsePath = document.getElementById("aiResponsePath");
const aiTemperature = document.getElementById("aiTemperature");
const aiVoiceProfile = document.getElementById("aiVoiceProfile");
const aiVoicePreview = document.getElementById("aiVoicePreview");
const temperatureValue = document.getElementById("temperatureValue");
const voiceInputEnabled = document.getElementById("voiceInputEnabled");
const voiceOutputEnabled = document.getElementById("voiceOutputEnabled");
const memoryEnabled = document.getElementById("memoryEnabled");
const screenState = document.getElementById("screenState");
const askForm = document.getElementById("askForm");
const askInput = document.getElementById("askInput");
const voiceAskButton = document.getElementById("voiceAskButton");
const modeButtons = document.querySelectorAll("[data-mode]");
const themeButtons = document.querySelectorAll(".segmented [data-theme]");
const commandButtons = document.querySelectorAll("[data-command]");
const modules = document.querySelectorAll(".module:not(.brand-module)");
const moduleHomes = new WeakMap();

let width = 0;
let height = 0;
let dpr = 1;
let active = false;
let pulse = 0;
let particles = [];
let orbPoints = [];
let orbWidth = 0;
let orbHeight = 0;
let subtitleTimer = 0;
let typingTimer = 0;
let visualTheme = "aurora";
let chatMessages = [];
let runtimeState = {};
let mcpConfig = { servers: [] };
let activeMcpServerId = "";
let applyWorkbench = { criteria: { query: "", city: "", salary: "", count: 10 }, jobs: [] };
let selectedApplyJobId = "";
let applySearchLoading = false;
let speechRecognition = null;
let speechPrimed = false;
let speechPlaybackToken = 0;
let lastSpokenText = "";
let lastSpokenAt = 0;
let listening = false;
let pendingAskMode = "chat";

const localAiConfigKey = "jarvis_ai_config";
const localChatKey = "jarvis_chat_history";
const defaultAskPlaceholder = askInput.getAttribute("placeholder") || "";

let providerDefaults = {
  ollama: {
    endpoint: "http://127.0.0.1:11434/v1",
    model: "qwen2.5:7b",
    requestFormat: "openai-compatible",
    requestMethod: "POST",
    requestPath: "/chat/completions",
    headersTemplate: "",
    bodyTemplate: "",
    responsePath: "choices[0].message.content",
    badge: "Local",
  },
  "openai-compatible": {
    endpoint: "http://127.0.0.1:8000/v1",
    model: "gpt-4.1-mini",
    requestFormat: "openai-compatible",
    requestMethod: "POST",
    requestPath: "/chat/completions",
    headersTemplate: "",
    bodyTemplate: "",
    responsePath: "choices[0].message.content",
    badge: "Compat",
  },
  openai: {
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    requestFormat: "openai-compatible",
    requestMethod: "POST",
    requestPath: "/chat/completions",
    headersTemplate: "",
    bodyTemplate: "",
    responsePath: "choices[0].message.content",
    badge: "Cloud",
  },
  anthropic: {
    endpoint: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-5",
    requestFormat: "claude-compatible",
    requestMethod: "POST",
    requestPath: "/messages",
    headersTemplate: "",
    bodyTemplate: "",
    responsePath: "content[0].text",
    badge: "Cloud",
  },
  gemini: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
    requestFormat: "gemini-compatible",
    requestMethod: "POST",
    requestPath: "/models/{{modelUrl}}:generateContent",
    headersTemplate: "",
    bodyTemplate: "",
    responsePath: "candidates[0].content.parts[0].text",
    badge: "Gemini",
  },
  custom: {
    endpoint: "http://127.0.0.1:3000/v1",
    model: "custom-agent",
    requestFormat: "openai-compatible",
    requestMethod: "POST",
    requestPath: "/chat/completions",
    headersTemplate: "",
    bodyTemplate: "",
    responsePath: "choices[0].message.content",
    badge: "Custom",
  },
};

const requestFormatDefaults = {
  "openai-compatible": {
    requestPath: "/chat/completions",
    responsePath: "choices[0].message.content",
  },
  "openai-responses": {
    requestPath: "/responses",
    responsePath: "output_text",
  },
  "openai-completions": {
    requestPath: "/completions",
    responsePath: "choices[0].text",
  },
  "claude-compatible": {
    requestPath: "/messages",
    responsePath: "content[0].text",
  },
  "claude-bearer-compatible": {
    requestPath: "/messages",
    responsePath: "content[0].text",
  },
  "gemini-compatible": {
    requestPath: "/models/{{modelUrl}}:generateContent",
    responsePath: "candidates[0].content.parts[0].text",
  },
  "codex-responses": {
    requestPath: "/responses",
    responsePath: "output_text",
  },
};

const palettes = {
  aurora: {
    label: "Aurora",
    particle: [111, 255, 210],
    active: [246, 201, 107],
    link: [120, 215, 255],
    core: [232, 255, 248],
  },
  ember: {
    label: "Ember",
    particle: [255, 178, 104],
    active: [255, 116, 96],
    link: [246, 201, 107],
    core: [255, 236, 206],
  },
  frost: {
    label: "Frost",
    particle: [138, 209, 255],
    active: [180, 245, 255],
    link: [159, 184, 255],
    core: [230, 249, 255],
  },
};

const orbStyles = {
  aurora: { count: 720, speed: 0.00042, tilt: 0.44, rings: 4, size: 0.46, sizeDepth: 1.35, halo: 9, flare: 5.2 },
  ember: { count: 620, speed: 0.00058, tilt: 0.33, rings: 3, size: 0.5, sizeDepth: 1.55, halo: 10, flare: 5.8 },
  frost: { count: 820, speed: 0.0003, tilt: 0.56, rings: 5, size: 0.42, sizeDepth: 1.25, halo: 8, flare: 4.8 },
};

const voiceProfiles = {
  jarvis: {
    label: "Jarvis",
    rate: 0.92,
    pitch: 0.88,
    fallbackIndex: 0,
    matches: [/Yunxi/i, /Kangkang/i, /Microsoft.*Natural.*zh/i],
  },
  calm: {
    label: "Calm",
    rate: 0.84,
    pitch: 0.92,
    fallbackIndex: 1,
    matches: [/Xiaoyi/i, /Yaoyao/i, /Huihui/i],
  },
  deep: {
    label: "Deep",
    rate: 0.86,
    pitch: 0.68,
    fallbackIndex: 2,
    matches: [/Yunyang/i, /Yunxi/i, /Kangkang/i, /David/i, /Male/i],
  },
  bright: {
    label: "Bright",
    rate: 0.98,
    pitch: 1.14,
    fallbackIndex: 3,
    matches: [/Xiaoxiao/i, /Xiaobei/i, /Jenny/i, /Female/i],
  },
  fast: {
    label: "Fast",
    rate: 1.12,
    pitch: 0.98,
    fallbackIndex: 4,
    matches: [/Yunjian/i, /Xiaoxiao/i, /Yunxi/i],
  },
};

const voicePreviewText = "你好，我是贾维斯。语音通道已就绪。";

const responses = {
  wake: "晚上好。我已接管语音入口，正在等待你的下一条指令。",
  sleep: "收到。我会保持后台待命，必要时再次唤醒。",
  "检查麦克风": "我将检查麦克风权限。浏览器可能会弹出授权提示。",
  "连接 MCP": "正在连接 MCP 网关。当前已配置 boss-mcp，可作为求职流程工具入口。",
  "同步 MCP 工具": "正在同步 MCP 工具清单：搜索职位、推荐职位、读取聊天和指定职位投递。",
  "测试 boss-mcp": "正在检查 boss-mcp 状态。",
  "保存 AI 配置": "AI 配置已保存到本地后端。真实密钥不要保存在前端页面里。",
  "测试 AI 连接": "正在测试 AI 服务连接。",
  "重置 AI 配置": "AI 配置已恢复为本地 Ollama 默认值。",
  "打开任务中心": "任务中心已准备好。你可以把搜索、总结、文件整理和系统操作接入这里。",
  "启动本地模型": "本地模型通道已标记为待启动。下一步可以接入 Ollama 或兼容 OpenAI 的服务。",
  "读取屏幕": "屏幕读取属于敏感权限，执行前需要你确认目标窗口。",
  "搜索网页": "网页搜索工具已排队。接入浏览器自动化后我可以打开、检索并总结结果。",
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  }
  return payload.data;
}

function rgba(name, alpha) {
  const color = palettes[visualTheme][name];
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

function rgbaFrom(color, alpha) {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

function nowIso() {
  return new Date().toISOString();
}

function timeLabel(value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return safeDate.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildParticles();
  resizeOrb();
}

function buildParticles() {
  const count = Math.max(70, Math.floor((width * height) / 17000));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.28,
    vy: (Math.random() - 0.5) * 0.28,
    size: Math.random() * 1.8 + 0.4,
    phase: Math.random() * Math.PI * 2,
  }));
}

function resizeOrb() {
  const rect = orbCanvas.getBoundingClientRect();
  orbWidth = Math.max(220, rect.width);
  orbHeight = Math.max(220, rect.height);
  orbCanvas.width = Math.floor(orbWidth * dpr);
  orbCanvas.height = Math.floor(orbHeight * dpr);
  orbCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildOrbPoints();
}

function buildOrbPoints() {
  const settings = orbStyles[visualTheme];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  orbPoints = Array.from({ length: settings.count }, (_, index) => {
    const y = 1 - (index / Math.max(settings.count - 1, 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = index * goldenAngle;
    const magnitude = Math.pow(Math.random(), 2.4);
    const bright = magnitude > 0.74 || index % 53 === 0;
    return {
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
      seed: Math.random() * Math.PI * 2,
      magnitude,
      bright,
      twinkle: 0.5 + Math.random() * 0.8,
      drift: (Math.random() - 0.5) * 0.018,
    };
  });
}

function drawGrid() {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "rgba(238,243,240,0.22)";
  ctx.lineWidth = 1;
  const spacing = 72;
  const offset = (performance.now() * 0.018) % spacing;
  for (let x = -spacing + offset; x < width + spacing; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + width * 0.18, height);
    ctx.stroke();
  }
  for (let y = -spacing + offset; y < height + spacing; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y - height * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(time) {
  const linkDistance = active ? 148 : 106;
  for (const particle of particles) {
    particle.x += particle.vx * (active ? 1.7 : 1);
    particle.y += particle.vy * (active ? 1.7 : 1);
    particle.phase += 0.01;
    if (particle.x < -10) particle.x = width + 10;
    if (particle.x > width + 10) particle.x = -10;
    if (particle.y < -10) particle.y = height + 10;
    if (particle.y > height + 10) particle.y = -10;
  }

  ctx.save();
  for (let i = 0; i < particles.length; i += 1) {
    const a = particles[i];
    for (let j = i + 1; j < particles.length; j += 1) {
      const b = particles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < linkDistance) {
        const alpha = (1 - distance / linkDistance) * (active ? 0.24 : 0.12);
        ctx.strokeStyle = rgba("link", alpha);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    const shimmer = 0.5 + Math.sin(time * 0.002 + a.phase) * 0.5;
    ctx.fillStyle = active
      ? rgba("active", 0.25 + shimmer * 0.48)
      : rgba("particle", 0.18 + shimmer * 0.34);
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFocus(time) {
  const cx = width * 0.5;
  const cy = height * 0.42;
  const base = Math.min(width, height) * 0.2;
  pulse += active ? 0.045 : 0.018;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * 0.0001);
  for (let i = 0; i < 5; i += 1) {
    const radius = base + i * 34 + Math.sin(pulse + i) * 7;
    ctx.strokeStyle = active ? rgba("active", 0.16 - i * 0.018) : rgba("particle", 0.13 - i * 0.016);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.42, radius * 0.68, i * 0.16, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function projectOrbPoint(point, time) {
  const settings = orbStyles[visualTheme];
  const spin = time * settings.speed + Math.sin(time * 0.00022 + point.seed) * point.drift;
  const breathe = active ? Math.sin(time * 0.002 + point.seed) * 0.025 : 0;
  const radius = Math.min(orbWidth, orbHeight) * (0.39 + breathe);
  const cosSpin = Math.cos(spin);
  const sinSpin = Math.sin(spin);
  const cosTilt = Math.cos(settings.tilt);
  const sinTilt = Math.sin(settings.tilt);
  const x = point.x * cosSpin - point.z * sinSpin;
  const z = point.x * sinSpin + point.z * cosSpin;
  const starY = point.y + Math.sin(time * 0.0007 + point.seed) * point.drift;
  const y = starY * cosTilt - z * sinTilt;
  const zTilted = starY * sinTilt + z * cosTilt;
  const perspective = 2.5 / (2.5 - zTilted);
  return {
    x: orbWidth / 2 + x * radius * perspective,
    y: orbHeight / 2 + y * radius * perspective,
    z: zTilted,
    perspective,
  };
}

function drawOrbRings(time) {
  const settings = orbStyles[visualTheme];
  const radius = Math.min(orbWidth, orbHeight) * 0.39;
  orbCtx.save();
  orbCtx.translate(orbWidth / 2, orbHeight / 2);
  orbCtx.rotate(Math.sin(time * 0.00025) * 0.12);
  for (let index = 0; index < settings.rings; index += 1) {
    const progress = index / Math.max(settings.rings - 1, 1);
    const ringY = (progress - 0.5) * radius * 1.28;
    const ringWidth = radius * Math.sqrt(Math.max(0.06, 1 - Math.pow(progress * 2 - 1, 2)));
    const alpha = active ? 0.13 - progress * 0.018 : 0.075 - progress * 0.012;
    orbCtx.strokeStyle = rgba("link", Math.max(0.045, alpha));
    orbCtx.lineWidth = 1;
    orbCtx.beginPath();
    orbCtx.ellipse(0, ringY, ringWidth, ringWidth * 0.14, time * 0.00018, 0, Math.PI * 2);
    orbCtx.stroke();
  }
  orbCtx.restore();
}

function drawStarFlare(star, alpha, size, color) {
  const flare = star.point.bright ? size * orbStyles[visualTheme].flare : 0;
  if (flare <= 0) return;

  orbCtx.save();
  orbCtx.globalCompositeOperation = "lighter";
  orbCtx.strokeStyle = rgbaFrom(color, alpha * 0.46);
  orbCtx.lineWidth = Math.max(0.45, size * 0.18);
  orbCtx.beginPath();
  orbCtx.moveTo(star.projected.x - flare, star.projected.y);
  orbCtx.lineTo(star.projected.x + flare, star.projected.y);
  orbCtx.moveTo(star.projected.x, star.projected.y - flare * 0.72);
  orbCtx.lineTo(star.projected.x, star.projected.y + flare * 0.72);
  orbCtx.stroke();

  orbCtx.strokeStyle = rgbaFrom(color, alpha * 0.18);
  orbCtx.translate(star.projected.x, star.projected.y);
  orbCtx.rotate(star.point.seed);
  orbCtx.beginPath();
  orbCtx.moveTo(-flare * 0.5, 0);
  orbCtx.lineTo(flare * 0.5, 0);
  orbCtx.moveTo(0, -flare * 0.36);
  orbCtx.lineTo(0, flare * 0.36);
  orbCtx.stroke();
  orbCtx.restore();
}

function drawStarHalo(star, alpha, size, color) {
  if (!star.point.bright) return;
  const radius = size * orbStyles[visualTheme].halo;
  const halo = orbCtx.createRadialGradient(
    star.projected.x,
    star.projected.y,
    0,
    star.projected.x,
    star.projected.y,
    radius,
  );
  halo.addColorStop(0, rgbaFrom(color, alpha * 0.42));
  halo.addColorStop(0.42, rgbaFrom(color, alpha * 0.12));
  halo.addColorStop(1, "rgba(0,0,0,0)");
  orbCtx.fillStyle = halo;
  orbCtx.beginPath();
  orbCtx.arc(star.projected.x, star.projected.y, radius, 0, Math.PI * 2);
  orbCtx.fill();
}

function drawOrb(time) {
  const settings = orbStyles[visualTheme];
  const activeBoost = active ? 1 : 0;
  const core = palettes[visualTheme].core;
  orbCtx.clearRect(0, 0, orbWidth, orbHeight);
  const glow = orbCtx.createRadialGradient(
    orbWidth / 2,
    orbHeight / 2,
    0,
    orbWidth / 2,
    orbHeight / 2,
    Math.min(orbWidth, orbHeight) * 0.48,
  );
  glow.addColorStop(0, rgba("particle", active ? 0.12 : 0.07));
  glow.addColorStop(0.52, rgba("link", active ? 0.075 : 0.04));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  orbCtx.fillStyle = glow;
  orbCtx.fillRect(0, 0, orbWidth, orbHeight);
  drawOrbRings(time);

  const projected = orbPoints
    .map((point) => ({ point, projected: projectOrbPoint(point, time) }))
    .sort((a, b) => a.projected.z - b.projected.z);

  orbCtx.save();
  orbCtx.globalCompositeOperation = "lighter";
  for (const item of projected) {
    const depth = (item.projected.z + 1) / 2;
    const twinkle = 0.48 + Math.sin(time * (0.0032 + item.point.twinkle * 0.0015) + item.point.seed) * 0.52;
    const alpha =
      0.08 +
      depth * (0.44 + activeBoost * 0.16) +
      item.point.magnitude * 0.28 +
      twinkle * item.point.twinkle * 0.1;
    const size =
      (settings.size + depth * settings.sizeDepth + activeBoost * 0.18) *
      (0.62 + item.point.magnitude * 1.55);
    const color = item.point.bright || depth > 0.74 ? core : palettes[visualTheme].particle;
    drawStarHalo(item, Math.min(0.9, alpha), size * item.projected.perspective, color);
    drawStarFlare(item, Math.min(0.86, alpha), size * item.projected.perspective, color);
    orbCtx.fillStyle = rgbaFrom(color, Math.min(0.96, alpha));
    orbCtx.beginPath();
    orbCtx.arc(item.projected.x, item.projected.y, size * item.projected.perspective, 0, Math.PI * 2);
    orbCtx.fill();
  }
  orbCtx.restore();
}

function render(time) {
  ctx.clearRect(0, 0, width, height);
  drawGrid();
  drawParticles(time);
  drawFocus(time);
  drawOrb(time);
  requestAnimationFrame(render);
}

function appendLog(message) {
  const item = document.createElement("li");
  const time = document.createElement("time");
  const text = document.createElement("span");
  time.textContent = timeLabel();
  text.textContent = message;
  item.append(time, text);
  logList.appendChild(item);
  while (logList.children.length > 7) {
    logList.removeChild(logList.firstElementChild);
  }
  logList.scrollTop = logList.scrollHeight;
}

function renderEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return;
  logList.textContent = "";
  for (const event of events.slice(0, 7).reverse()) {
    const message = event.payload?.message || event.type || "Runtime event";
    const item = document.createElement("li");
    const time = document.createElement("time");
    const text = document.createElement("span");
    time.textContent = timeLabel(event.time);
    text.textContent = message;
    item.append(time, text);
    logList.appendChild(item);
  }
  logList.scrollTop = logList.scrollHeight;
}

function applyRuntimeState(state = {}) {
  runtimeState = { ...runtimeState, ...state };
  if (runtimeState.subtitleState === "Harness") {
    runtimeState.subtitleState = "";
    runtimeState.subtitleText = "";
  }
  active = Boolean(runtimeState.awake);
  wakeButton.classList.toggle("is-awake", active);
  wakeButton.setAttribute("aria-pressed", String(active));
  statusBadge.textContent = active ? "Awake" : "Standby";

  const mode = runtimeState.agentMode || "standby";
  modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === mode));
  modeBadge.textContent = mode[0].toUpperCase() + mode.slice(1);

  visualTheme = palettes[runtimeState.visualTheme] ? runtimeState.visualTheme : "aurora";
  document.body.dataset.theme = visualTheme;
  themeBadge.textContent = palettes[visualTheme].label;
  themeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.theme === visualTheme));
  buildOrbPoints();

  micState.textContent = runtimeState.microphone || micState.textContent || "Pending";
  if (screenState) {
    screenState.textContent = runtimeState.screen || screenState.textContent || "Pending";
  }
  if (runtimeState.subtitleText && !typingTimer) {
    jarvisSubtitle.textContent = runtimeState.subtitleText;
    subtitleState.textContent = runtimeState.subtitleState || (active ? "Listening" : "Standby");
  }
}

function getVoiceProfile() {
  return voiceProfiles[aiVoiceProfile?.value] || voiceProfiles.jarvis;
}

function getPreferredVoice(profile = getVoiceProfile()) {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const describe = (voice) => `${voice.lang} ${voice.name}`;
  const namedMatch = (profile.matches || [])
    .map((matcher) => voices.find((voice) => matcher.test(describe(voice))))
    .find(Boolean);
  if (namedMatch) return namedMatch;

  const naturalChineseVoices = voices.filter(
    (voice) => /Natural|Neural|Online/i.test(describe(voice)) && /^zh/i.test(voice.lang),
  );
  const chineseVoices = voices.filter((voice) => /zh-CN|zh_Hans|Chinese/i.test(describe(voice)) || /^zh/i.test(voice.lang));
  const fallbackPool = naturalChineseVoices.length ? naturalChineseVoices : chineseVoices;
  if (fallbackPool.length) return fallbackPool[(profile.fallbackIndex || 0) % fallbackPool.length];
  return voices[(profile.fallbackIndex || 0) % Math.max(voices.length, 1)] || null;
}

function chunkSpeechText(message, maxLength = 160) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const chunks = [];
  let current = "";
  for (const part of text.split(/(?<=[。！？!?；;,.，])\s*/)) {
    if (!part) continue;
    if ((current + part).length > maxLength && current) {
      chunks.push(current.trim());
      current = "";
    }
    if (part.length > maxLength) {
      for (let index = 0; index < part.length; index += maxLength) {
        chunks.push(part.slice(index, index + maxLength).trim());
      }
    } else {
      current += part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function primeSpeechOutput() {
  if (speechPrimed || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.resume();
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    synth.speak(utterance);
    window.setTimeout(() => {
      if (synth.paused) synth.resume();
    }, 60);
    speechPrimed = true;
  } catch {
    speechPrimed = false;
  }
}

function speakAloud(message, options = {}) {
  if (!voiceOutputEnabled.checked || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  const normalized = String(message || "").replace(/\s+/g, " ").trim();
  if (!normalized) return;
  const now = Date.now();
  if (!options.force && normalized === lastSpokenText && now - lastSpokenAt < 8000) return;
  lastSpokenText = normalized;
  lastSpokenAt = now;

  const chunks = chunkSpeechText(message);
  if (!chunks.length) return;

  const synth = window.speechSynthesis;
  const token = ++speechPlaybackToken;
  const speakChunks = () => {
    if (token !== speechPlaybackToken) return;
    synth.cancel();
    synth.resume();
    window.setTimeout(() => {
      if (token === speechPlaybackToken && synth.paused) synth.resume();
    }, 60);
    const profile = options.profile || getVoiceProfile();
    const voice = getPreferredVoice(profile);
    let index = 0;
    const speakNext = () => {
      if (token !== speechPlaybackToken) return;
      const chunk = chunks[index];
      if (!chunk) return;
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = voice?.lang || "zh-CN";
      utterance.voice = voice;
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.onend = () => {
        index += 1;
        speakNext();
      };
      utterance.onerror = () => {
        index += 1;
        speakNext();
      };
      synth.speak(utterance);
    };
    speakNext();
  };

  if (synth.getVoices().length === 0) {
    let started = false;
    const startOnce = () => {
      if (started) return;
      started = true;
      synth.onvoiceschanged = null;
      speakChunks();
    };
    synth.onvoiceschanged = startOnce;
    window.setTimeout(startOnce, 250);
  } else {
    speakChunks();
  }
}

async function saveRuntimePatch(patch) {
  try {
    applyRuntimeState(await api("/api/state", {
      method: "POST",
      body: JSON.stringify(patch),
    }));
  } catch (error) {
    appendLog(`Runtime state save failed: ${error.message}`);
  }
}

async function loadRuntime() {
  try {
    applyRuntimeState(await api("/api/state"));
  } catch (error) {
    appendLog(`Runtime state unavailable: ${error.message}`);
  }
}

async function loadEvents() {
  try {
    renderEvents(await api("/api/events?limit=7"));
  } catch (error) {
    appendLog(`Runtime events unavailable: ${error.message}`);
  }
}

async function runBackendCommand(command, payload = {}) {
  const result = await api("/api/commands", {
    method: "POST",
    body: JSON.stringify({ command, payload }),
  });
  applyRuntimeState(result.state);
  if (result.log) appendLog(result.log);
  if (result.subtitle?.text) {
    speakSubtitle(result.subtitle.text, result.subtitle.state || "Speaking");
  }
  return result;
}

function normalizeMessage(message) {
  return {
    id: message.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role: message.role || "user",
    text: String(message.text || ""),
    time: message.time || nowIso(),
  };
}

function renderChat() {
  chatList.textContent = "";
  for (const message of chatMessages.slice(-10)) {
    const item = document.createElement("li");
    item.className = `chat-message is-${message.role}`;
    const meta = document.createElement("div");
    meta.className = "message-meta";
    const role = document.createElement("strong");
    role.textContent = message.role === "jarvis" ? "JARVIS" : message.role === "user" ? "YOU" : "SYSTEM";
    const time = document.createElement("time");
    time.textContent = timeLabel(message.time);
    const body = document.createElement("p");
    body.textContent = message.text;
    meta.append(role, time);
    item.append(meta, body);
    chatList.appendChild(item);
  }
  chatList.scrollTop = chatList.scrollHeight;
}

function persistLocalChat() {
  localStorage.setItem(localChatKey, JSON.stringify(chatMessages.slice(-10)));
}

function addChat(role, text, options = {}) {
  const message = normalizeMessage({ role, text });
  chatMessages = [...chatMessages, message].slice(-10);
  persistLocalChat();
  renderChat();

  if (options.remote !== false) {
    api("/api/chat", {
      method: "POST",
      body: JSON.stringify(message),
    }).catch((error) => appendLog(`Chat backend unavailable: ${error.message}`));
  }
  return message;
}

async function loadChat() {
  try {
    chatMessages = (await api("/api/chat")).map(normalizeMessage);
  } catch {
    try {
      chatMessages = JSON.parse(localStorage.getItem(localChatKey) || "[]").map(normalizeMessage);
    } catch {
      chatMessages = [];
    }
  }

  if (chatMessages.length === 0) {
    chatMessages = [
      normalizeMessage({ role: "system", text: "Console initialized. Latest 10 messages will stay here." }),
      normalizeMessage({ role: "jarvis", text: "系统待命。点击核心唤醒我。" }),
    ];
  }
  persistLocalChat();
  renderChat();
}

function speakSubtitle(message, state = "Speaking", options = {}) {
  window.clearTimeout(subtitleTimer);
  window.clearInterval(typingTimer);
  subtitleState.textContent = state;
  jarvisSubtitle.textContent = "";
  if (options.record !== false) {
    addChat("jarvis", message, { remote: options.remote });
  }
  if (options.voice !== false) {
    speakAloud(message, options.voiceOptions || {});
  }

  let index = 0;
  typingTimer = window.setInterval(() => {
    index += 1;
    jarvisSubtitle.textContent = message.slice(0, index);
    if (index >= message.length) {
      window.clearInterval(typingTimer);
    }
  }, Math.max(18, Math.min(38, 820 / Math.max(message.length, 1))));

  subtitleTimer = window.setTimeout(() => {
    subtitleState.textContent = active ? "Listening" : "Standby";
  }, 1800);
}

function previewVoiceProfile() {
  primeSpeechOutput();
  const profile = getVoiceProfile();
  subtitleState.textContent = "Voice";
  jarvisSubtitle.textContent = voicePreviewText;
  speakAloud(voicePreviewText, { force: true, profile });
  appendLog(`Voice preview played: ${profile.label}.`);
}

async function setWakeState(nextActive) {
  try {
    await runBackendCommand(nextActive ? "wake" : "sleep");
  } catch (error) {
    applyRuntimeState({ awake: nextActive });
    speakSubtitle(nextActive ? responses.wake : responses.sleep, nextActive ? "Online" : "Standby");
    appendLog(`Wake command backend failed: ${error.message}`);
  }
}

async function checkMicrophone() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    micState.textContent = "Unavailable";
    await saveRuntimePatch({ microphone: "Unavailable" });
    speakSubtitle("当前浏览器不支持麦克风 API。请换用现代浏览器或通过本地服务打开页面。", "Notice");
    appendLog("Microphone API unavailable.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    micState.textContent = "Granted";
    await saveRuntimePatch({ microphone: "Granted" });
    speakSubtitle("麦克风权限已获得。我可以开始接收语音输入。", "Ready");
    appendLog("Microphone permission granted.");
  } catch {
    micState.textContent = "Blocked";
    await saveRuntimePatch({ microphone: "Blocked" });
    speakSubtitle("麦克风权限被阻止。请在浏览器地址栏权限设置中允许麦克风。", "Blocked");
    appendLog("Microphone permission blocked.");
  }
}

async function askJarvis(text, source = "text") {
  const question = String(text || "").trim();
  if (!question) return;

  askInput.value = "";
  askInput.placeholder = defaultAskPlaceholder;
  pendingAskMode = "chat";
  addChat("user", question, { remote: false });
  appendLog(`${source === "voice" ? "Voice" : "Text"} question submitted.`);
  subtitleState.textContent = "Thinking";
  jarvisSubtitle.textContent = "正在思考...";

  try {
    const result = await api("/api/chat/complete", {
      method: "POST",
      body: JSON.stringify({ text: question, source }),
    });
    const answer = result.assistantMessage?.text || "我没有拿到有效回复。";
    chatMessages = (await api("/api/chat")).map(normalizeMessage);
    persistLocalChat();
    renderChat();
    speakSubtitle(answer, "JARVIS", { record: false });
    await saveRuntimePatch({ subtitleState: "JARVIS", subtitleText: answer });
  } catch (error) {
    const fallback = `AI 对话失败：${error.message}`;
    speakSubtitle(fallback, "Error", { record: false, voice: false });
    appendLog(fallback);
  }
}

async function requestScreenCapture() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    if (screenState) screenState.textContent = "Unavailable";
    await api("/api/screen/permission", {
      method: "POST",
      body: JSON.stringify({ status: "Unavailable", message: "当前浏览器不支持屏幕读取。" }),
    }).catch((error) => appendLog(`Screen state failed: ${error.message}`));
    speakSubtitle("当前浏览器不支持屏幕读取。请使用 Chrome 或 Edge 并通过本地服务打开页面。", "Screen");
    return;
  }

  try {
    speakSubtitle("请选择要共享的窗口或屏幕。授权后我只读取当前这一帧。", "Screen");
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    const captureWidth = settings.width || video.videoWidth || 1280;
    const captureHeight = settings.height || video.videoHeight || 720;
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = captureWidth;
    captureCanvas.height = captureHeight;
    captureCanvas.getContext("2d").drawImage(video, 0, 0, captureWidth, captureHeight);
    stream.getTracks().forEach((item) => item.stop());

    const previewDataUrl = captureCanvas.toDataURL("image/png", 0.72);
    const saved = await api("/api/screen/capture", {
      method: "POST",
      body: JSON.stringify({
        source: "browser-display-media",
        width: captureWidth,
        height: captureHeight,
        mimeType: "image/png",
        previewDataUrl,
      }),
    });
    if (screenState) screenState.textContent = "Granted";
    speakSubtitle(`屏幕读取完成：${saved.width} x ${saved.height}。你可以继续问我这屏幕上的内容。`, "Screen");
    appendLog(`Screen captured: ${saved.width}x${saved.height}.`);
  } catch (error) {
    if (screenState) screenState.textContent = "Blocked";
    await api("/api/screen/permission", {
      method: "POST",
      body: JSON.stringify({ status: "Blocked", message: "屏幕读取被取消或阻止。" }),
    }).catch((stateError) => appendLog(`Screen state failed: ${stateError.message}`));
    speakSubtitle("屏幕读取被取消或阻止。需要你在系统弹窗中选择要共享的窗口。", "Screen");
    appendLog(`Screen capture blocked: ${error.message}`);
  }
}

async function performWebSearch(query, source = "text") {
  const searchQuery = String(query || "").trim();
  if (!searchQuery) return;
  askInput.value = "";
  askInput.placeholder = defaultAskPlaceholder;
  pendingAskMode = "chat";

  try {
    speakSubtitle(`Searching and summarizing: ${searchQuery}`, "Search", { record: false });
    const task = await api("/api/web-search", {
      method: "POST",
      body: JSON.stringify({ query: searchQuery, provider: "bing", source }),
    });
    addChat("user", `Search web: ${task.query}`, { remote: false });
    addChat("jarvis", task.answer, { remote: false });
    speakSubtitle(task.answer, "Search", { record: false });
    appendLog(`Web search answered: ${task.query}; results=${task.results?.length || 0}.`);
  } catch (error) {
    speakSubtitle(`Web search failed: ${error.message}`, "Search", { voice: false });
    appendLog(`Web search failed: ${error.message}`);
  }
}

async function requestWebSearch() {
  const inlineQuery = askInput.value.trim();
  if (inlineQuery) {
    performWebSearch(inlineQuery, "text");
    return;
  }

  pendingAskMode = "web-search";
  askInput.placeholder = "Type a web search query, or speak after clicking Voice";
  askInput.focus();
  speakSubtitle("Web search is ready. Type a query and press Ask, or speak your search request.", "Search", {
    record: false,
  });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (voiceInputEnabled.checked && SpeechRecognition) startVoiceQuestion("web-search");
}

function startVoiceQuestion(mode = "chat") {
  pendingAskMode = mode;
  if (!voiceInputEnabled.checked) {
    speakSubtitle("语音输入当前关闭，请先在 AI Config 里开启 Voice in。", "Voice");
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    speakSubtitle("当前浏览器不支持语音识别。你可以直接输入文字提问。", "Voice");
    return;
  }

  if (!speechRecognition) {
    speechRecognition = new SpeechRecognition();
    speechRecognition.lang = "zh-CN";
    speechRecognition.interimResults = true;
    speechRecognition.continuous = false;
    speechRecognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join("")
        .trim();
      askInput.value = transcript;
      if (event.results[event.results.length - 1]?.isFinal) {
        if (pendingAskMode === "web-search") {
          performWebSearch(transcript, "voice");
        } else {
          askJarvis(transcript, "voice");
        }
      }
    };
    speechRecognition.onerror = (event) => {
      listening = false;
      voiceAskButton.classList.remove("is-listening");
      speakSubtitle(`语音识别失败：${event.error}`, "Voice", { voice: false });
    };
    speechRecognition.onend = () => {
      listening = false;
      voiceAskButton.classList.remove("is-listening");
    };
  }

  if (listening) {
    speechRecognition.stop();
    return;
  }
  listening = true;
  voiceAskButton.classList.add("is-listening");
  speakSubtitle("我在听，请直接说出你的问题。", "Listening", { record: false });
  speechRecognition.start();
}

async function setMode(mode) {
  applyRuntimeState({ agentMode: mode });
  try {
    await runBackendCommand("set-mode", { agentMode: mode });
  } catch (error) {
    appendLog(`Mode backend failed: ${error.message}`);
    speakSubtitle(`模式已切换为 ${mode}。`, "Mode");
  }
}

async function setTheme(theme) {
  applyRuntimeState({ visualTheme: theme });
  try {
    await runBackendCommand("set-theme", { visualTheme: theme });
  } catch (error) {
    appendLog(`Theme backend failed: ${error.message}`);
    speakSubtitle(`视觉风格已切换为 ${palettes[visualTheme].label}。`, "Theme");
  }
}

function readAiConfig() {
  const config = {
    provider: aiProvider.value,
    endpoint: aiEndpoint.value.trim(),
    model: aiModel.value.trim(),
    requestFormat: aiRequestFormat.value,
    requestMethod: aiRequestMethod.value,
    requestPath: aiRequestPath.value.trim(),
    headersTemplate: aiHeadersTemplate.value.trim(),
    bodyTemplate: aiBodyTemplate.value.trim(),
    responsePath: aiResponsePath.value.trim(),
    temperature: Number(aiTemperature.value).toFixed(2),
    voiceInput: voiceInputEnabled.checked,
    voiceOutput: voiceOutputEnabled.checked,
    voiceProfile: aiVoiceProfile.value,
    memory: memoryEnabled.checked,
  };
  const apiKey = aiApiKey.value.trim();
  if (apiKey) config.apiKey = apiKey;
  return config;
}

function publicAiConfig(config) {
  const { apiKey, hasApiKey, apiKeyPreview, ...publicConfig } = config;
  return {
    ...publicConfig,
    hasApiKey: Boolean(hasApiKey),
    apiKeyPreview: apiKeyPreview || "",
  };
}

function applyAiConfig(config) {
  const provider = providerDefaults[config.provider] ? config.provider : "ollama";
  const defaults = providerDefaults[provider];
  aiProvider.value = provider;
  aiEndpoint.value = config.endpoint || defaults.endpoint;
  aiModel.value = config.model || defaults.model;
  aiRequestFormat.value = config.requestFormat || defaults.requestFormat || "openai-compatible";
  const formatDefaults = requestFormatDefaults[aiRequestFormat.value] || {};
  aiRequestMethod.value = config.requestMethod || defaults.requestMethod || "POST";
  aiRequestPath.value = config.requestPath || formatDefaults.requestPath || defaults.requestPath || "";
  aiHeadersTemplate.value = config.headersTemplate || defaults.headersTemplate || "";
  aiBodyTemplate.value = config.bodyTemplate || defaults.bodyTemplate || "";
  aiResponsePath.value = config.responsePath || formatDefaults.responsePath || defaults.responsePath || "";
  aiTemperature.value = config.temperature || "0.40";
  temperatureValue.textContent = Number(aiTemperature.value).toFixed(2);
  voiceInputEnabled.checked = config.voiceInput ?? true;
  voiceOutputEnabled.checked = config.voiceOutput ?? true;
  aiVoiceProfile.value = voiceProfiles[config.voiceProfile] ? config.voiceProfile : "jarvis";
  memoryEnabled.checked = config.memory ?? false;
  aiConfigBadge.textContent = defaults.badge;
  aiApiKey.value = "";
  aiKeyState.textContent = config.hasApiKey ? `Saved: ${config.apiKeyPreview || "configured"}` : "Not set";
  aiApiKey.placeholder = config.hasApiKey ? "Leave blank to keep saved key" : "Paste provider key";
}

function applyAiProviders(providers) {
  if (!providers || typeof providers !== "object") return;
  providerDefaults = providers;
  aiProvider.textContent = "";
  for (const [value, provider] of Object.entries(providerDefaults)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = provider.label || value;
    aiProvider.appendChild(option);
  }
}

function renderMcpTools(tools = []) {
  if (!mcpToolChips) return;
  const safeTools = Array.isArray(tools) ? tools.filter((tool) => tool?.name).slice(0, 12) : [];
  mcpToolChips.textContent = "";
  for (const tool of safeTools) {
    const chip = document.createElement("span");
    chip.textContent = tool.name;
    chip.title = tool.description || tool.name;
    mcpToolChips.appendChild(chip);
  }
  if (safeTools.length === 0) {
    for (const name of ["boss_status", "boss_search", "boss_detail", "boss_apply"]) {
      const chip = document.createElement("span");
      chip.textContent = name;
      mcpToolChips.appendChild(chip);
    }
  }
}

function parseMcpArgs(value = "") {
  return String(value || "")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readMcpEnv() {
  const raw = mcpServerEnv?.value.trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Env JSON must be an object.");
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [String(key), String(value)]));
}

function selectMcpServer(serverId) {
  const server = mcpConfig.servers.find((item) => item.id === serverId) || mcpConfig.servers[0];
  if (!server) return;
  activeMcpServerId = server.id;
  mcpServerId.value = server.id;
  mcpServerName.value = server.name || server.id;
  mcpServerCommand.value = server.command || "";
  mcpServerArgs.value = Array.isArray(server.args) ? server.args.join(" ") : "";
  mcpServerEnv.value = server.env && Object.keys(server.env).length ? JSON.stringify(server.env, null, 2) : "";
  mcpServerEnabled.checked = server.enabled !== false;
  renderMcpServers();
}

function renderMcpServers(statusServers = []) {
  if (!mcpServerList) return;
  const statusById = new Map(statusServers.map((server) => [server.id, server]));
  mcpServerList.textContent = "";
  for (const server of mcpConfig.servers) {
    const status = statusById.get(server.id);
    const button = document.createElement("button");
    button.type = "button";
    button.classList.toggle("is-active", server.id === activeMcpServerId);
    button.addEventListener("click", () => selectMcpServer(server.id));
    const label = document.createElement("span");
    label.textContent = server.name || server.id;
    const meta = document.createElement("small");
    meta.textContent = status
      ? `${status.available ? "online" : "offline"} / ${status.toolCount || 0} tools`
      : `${server.enabled === false ? "disabled" : "enabled"} / ${server.transport}`;
    button.append(label, meta);
    mcpServerList.appendChild(button);
  }
}

function newMcpServer() {
  const nextIndex = mcpConfig.servers.length + 1;
  const server = {
    id: `mcp-${nextIndex}`,
    name: `MCP ${nextIndex}`,
    enabled: true,
    transport: "stdio",
    command: "",
    args: [],
    env: {},
  };
  mcpConfig = { servers: [...mcpConfig.servers, server] };
  selectMcpServer(server.id);
}

async function loadMcpConfig() {
  try {
    mcpConfig = await api("/api/config/mcp");
    activeMcpServerId = mcpConfig.servers[0]?.id || "";
    renderMcpServers();
    if (activeMcpServerId) selectMcpServer(activeMcpServerId);
    mcpServerState.textContent = `${mcpConfig.servers.length} configured`;
  } catch (error) {
    appendLog(`MCP config unavailable: ${error.message}`);
  }
}

async function saveMcpConfig() {
  try {
    const id = mcpServerId.value.trim();
    const command = mcpServerCommand.value.trim();
    if (!id || !command) throw new Error("Server ID and command are required.");
    const nextServer = {
      id,
      name: mcpServerName.value.trim() || id,
      enabled: mcpServerEnabled.checked,
      transport: "stdio",
      command,
      args: parseMcpArgs(mcpServerArgs.value),
      env: readMcpEnv(),
    };
    const existingIndex = mcpConfig.servers.findIndex((server) => server.id === activeMcpServerId || server.id === id);
    const servers = [...mcpConfig.servers];
    if (existingIndex >= 0) {
      servers[existingIndex] = nextServer;
    } else {
      servers.push(nextServer);
    }
    mcpConfig = await api("/api/config/mcp", {
      method: "POST",
      body: JSON.stringify({ servers }),
    });
    activeMcpServerId = nextServer.id;
    selectMcpServer(activeMcpServerId);
    mcpBadge.textContent = `${mcpConfig.servers.length} MCP`;
    speakSubtitle(`MCP 配置已保存：${nextServer.name}。`, "MCP", { record: false });
  } catch (error) {
    speakSubtitle(`MCP 配置保存失败：${error.message}`, "MCP", { record: false, voice: false });
  }
}

function applyStatusLabel(status = "pending") {
  return {
    pending: "待处理",
    opened: "已打开",
    applied: "已投",
    skipped: "已跳过",
  }[status] || "待处理";
}

function getSelectedApplyJob() {
  return (applyWorkbench.jobs || []).find((job) => job.id === selectedApplyJobId) || null;
}

function findNextApplyJobId(jobs = [], currentId = "") {
  const actionable = (job) => !["applied", "skipped"].includes(job.status);
  if (!jobs.length) return "";
  if (!currentId) return jobs.find(actionable)?.id || jobs[0]?.id || "";
  const foundIndex = jobs.findIndex((job) => job.id === currentId);
  const currentIndex = foundIndex >= 0 ? foundIndex : -1;
  for (let offset = 1; offset <= jobs.length; offset += 1) {
    const job = jobs[(currentIndex + offset) % jobs.length];
    if (actionable(job)) return job.id;
  }
  return jobs[0]?.id || "";
}

function criteriaInputValue(criteria = {}, key, currentValue = "", fallback = "") {
  const forceValue = applySearchLoading || Boolean(applyWorkbench.updatedAt);
  if (!forceValue && !criteria[key]) return currentValue || fallback;
  return criteria[key] ?? fallback;
}

function setApplyCriteriaInputs(criteria = {}) {
  if (applyKeyword && document.activeElement !== applyKeyword) {
    applyKeyword.value = criteriaInputValue(criteria, "query", applyKeyword.value, "");
  }
  if (applyCity && document.activeElement !== applyCity) {
    applyCity.value = criteriaInputValue(criteria, "city", applyCity.value, "");
  }
  if (applySalary && document.activeElement !== applySalary) {
    applySalary.value = criteriaInputValue(criteria, "salary", applySalary.value, "");
  }
  if (applyCount && document.activeElement !== applyCount) {
    applyCount.value = criteriaInputValue(criteria, "count", applyCount.value, 10);
  }
}

function setApplySearchLoading(isLoading, criteria = null) {
  if (isLoading && criteria) {
    applyWorkbench = {
      ...applyWorkbench,
      criteria: {
        ...(applyWorkbench.criteria || {}),
        ...criteria,
      },
    };
  }
  applySearchLoading = Boolean(isLoading);
  document.querySelectorAll("[data-apply-action]").forEach((button) => {
    button.setAttribute("data-apply-busy", applySearchLoading ? "true" : "false");
    if (button.dataset.applyAction === "search") {
      button.disabled = applySearchLoading;
      button.textContent = applySearchLoading ? "搜索中" : "搜索";
    }
  });
  if (applyBadge) applyBadge.textContent = applySearchLoading ? "Searching" : applyBadge.textContent;
  renderApplyJobs();
}

function readJobField(job = {}, keys = []) {
  for (const key of keys) {
    const value = job?.[key] ?? job?.raw?.[key];
    if (value != null && String(value).trim()) return value;
  }
  return "";
}

function formatJobList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" / ");
  return String(value || "");
}

function selectedApplyIndex(jobs = []) {
  const index = jobs.findIndex((job) => job.id === selectedApplyJobId);
  return index >= 0 ? index + 1 : 0;
}

function updateApplyProgress(jobs = []) {
  if (!applyProgress) return;
  const total = jobs.length;
  const handled = jobs.filter((job) => ["applied", "skipped"].includes(job.status)).length;
  const opened = jobs.filter((job) => job.status === "opened").length;
  const current = selectedApplyIndex(jobs);
  applyProgress.textContent = total
    ? `${current || 1} / ${total} current · ${handled} handled · ${opened} opened`
    : "0 / 0 pending";
}

function renderApplyDetail() {
  if (!applyDetailPanel) return;
  const selected = getSelectedApplyJob();
  applyDetailPanel.textContent = "";
  if (!selected) {
    applyDetailPanel.classList.add("is-empty");
    applyDetailPanel.textContent = "选择岗位后展示详情。";
    return;
  }

  applyDetailPanel.classList.remove("is-empty");
  const title = document.createElement("strong");
  title.className = "apply-detail-title";
  title.textContent = selected.title || "Unknown role";

  const meta = document.createElement("p");
  meta.className = "apply-detail-meta";
  meta.textContent = [selected.company, selected.salary, selected.city].filter(Boolean).join(" / ");

  const facts = [
    ["经验", readJobField(selected, ["experience", "jobExperience", "experienceName"])],
    ["学历", readJobField(selected, ["education", "jobDegree", "degreeName"])],
    ["招聘人", [readJobField(selected, ["boss_name", "bossName"]), readJobField(selected, ["boss_title", "bossTitle"])].filter(Boolean).join(" / ")],
    ["状态", readJobField(selected, ["boss_active", "activeTimeDesc"]) || applyStatusLabel(selected.status)],
    ["技能", formatJobList(readJobField(selected, ["skills", "jobLabels"]))],
    ["福利", formatJobList(readJobField(selected, ["welfare"]))],
    ["job_id", selected.jobId || "-"],
    ["security_id", selected.securityId || "-"],
  ].filter(([, value]) => value);

  const list = document.createElement("dl");
  list.className = "apply-detail-list";
  for (const [label, value] of facts) {
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = String(value);
    list.append(term, detail);
  }

  const handoff = document.createElement("p");
  handoff.className = "apply-handoff";
  handoff.textContent = "参照 boss 工具：投递或沟通回到 BOSS 官方页面由用户手动完成。";

  applyDetailPanel.append(title, meta, list, handoff);
}

function renderApplyJobs() {
  if (!applyJobList) return;
  const jobs = Array.isArray(applyWorkbench.jobs) ? applyWorkbench.jobs : [];
  if (!selectedApplyJobId || !jobs.some((job) => job.id === selectedApplyJobId)) {
    selectedApplyJobId = jobs.find((job) => !["applied", "skipped"].includes(job.status))?.id || jobs[0]?.id || "";
  }

  setApplyCriteriaInputs(applyWorkbench.criteria || {});
  applyJobList.textContent = "";
  updateApplyProgress(jobs);
  if (applySearchLoading) {
    const loading = document.createElement("li");
    loading.className = "apply-loading";
    loading.textContent = "正在搜索岗位，请稍等...";
    applyJobList.appendChild(loading);
    if (applyGreeting) applyGreeting.value = "";
    renderApplyDetail();
    return;
  }

  if (jobs.length === 0) {
    const empty = document.createElement("li");
    empty.className = "apply-empty";
    empty.textContent = applyWorkbench.updatedAt ? "没有返回岗位，调整关键词、城市或薪资后再试。" : "暂无岗位，先搜索一次。";
    applyJobList.appendChild(empty);
  }

  for (const job of jobs) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.classList.toggle("is-active", job.id === selectedApplyJobId);
    button.title = job.detailUrl || `${job.title} / ${job.company}`;
    button.addEventListener("click", () => {
      selectedApplyJobId = job.id;
      renderApplyJobs();
    });

    const title = document.createElement("span");
    title.className = "apply-job-title";
    title.textContent = job.title || "Unknown role";
    const meta = document.createElement("span");
    meta.className = "apply-job-meta";
    meta.textContent = [job.company, job.city, job.salary].filter(Boolean).join(" / ") || "No metadata";
    const ids = document.createElement("span");
    ids.className = "apply-job-ids";
    ids.textContent = `job_id: ${job.jobId || "-"} | security_id: ${job.securityId || "-"}`;
    const status = document.createElement("span");
    status.className = "apply-job-status";
    status.textContent = applyStatusLabel(job.status);

    button.append(title, meta, ids, status);
    item.appendChild(button);
    applyJobList.appendChild(item);
  }

  const selected = getSelectedApplyJob();
  if (applyGreeting) applyGreeting.value = selected?.greeting || "";
  renderApplyDetail();
  if (applyBadge) {
    const done = jobs.filter((job) => ["applied", "skipped"].includes(job.status)).length;
    applyBadge.textContent = jobs.length ? `${done}/${jobs.length}` : "Idle";
  }
}

function readApplyCriteria() {
  return {
    query: applyKeyword?.value.trim() || "",
    city: applyCity?.value.trim() || "",
    salary: applySalary?.value.trim() || "",
    count: Number(applyCount?.value || 10),
  };
}

async function loadApplyWorkbench() {
  if (!applyJobList) return;
  try {
    applyWorkbench = await api("/api/apply-workbench");
    selectedApplyJobId = findNextApplyJobId(applyWorkbench.jobs || [], selectedApplyJobId);
    renderApplyJobs();
  } catch (error) {
    appendLog(`Apply workbench unavailable: ${error.message}`);
  }
}

async function searchApplyWorkbench() {
  if (applySearchLoading) return;
  const criteria = readApplyCriteria();
  if (!criteria.query) {
    speakSubtitle("请输入岗位关键词后再搜索。", "Apply", { record: false, voice: false });
    return;
  }

  setApplySearchLoading(true, criteria);
  try {
    applyWorkbench = await api("/api/apply-workbench/search", {
      method: "POST",
      body: JSON.stringify(criteria),
    });
    selectedApplyJobId = findNextApplyJobId(applyWorkbench.jobs || [], "");
    renderApplyJobs();
    speakSubtitle(`已找到 ${applyWorkbench.jobs?.length || 0} 个岗位，选择一条后打开详情页手动投递。`, "Apply", {
      record: false,
    });
    appendLog(`Apply search: ${criteria.city || "any city"} / ${criteria.query} / ${criteria.salary || "any salary"}.`);
  } catch (error) {
    if (applyBadge) applyBadge.textContent = "Failed";
    speakSubtitle(`岗位搜索失败：${error.message}`, "Apply", { record: false, voice: false });
    appendLog(`Apply search failed: ${error.message}`);
  } finally {
    setApplySearchLoading(false);
  }
}

async function markSelectedApplyJob(status) {
  const selected = getSelectedApplyJob();
  if (!selected) {
    speakSubtitle("请先选择一个岗位。", "Apply", { record: false, voice: false });
    return;
  }
  applyWorkbench = await api("/api/apply-workbench/status", {
    method: "POST",
    body: JSON.stringify({ id: selected.id, status }),
  });
  selectedApplyJobId = ["applied", "skipped"].includes(status)
    ? findNextApplyJobId(applyWorkbench.jobs || [], selected.id)
    : selected.id;
  renderApplyJobs();
  appendLog(`Apply job ${selected.id} marked ${status}.`);
}

async function openApplyJobInSystemBrowser(selected) {
  if (!selected?.id) throw new Error("请先选择一个岗位。");
  applyWorkbench = await api("/api/apply-workbench/open", {
    method: "POST",
    body: JSON.stringify({ id: selected.id }),
  });
  selectedApplyJobId = selected.id;
  renderApplyJobs();
}

async function openSelectedApplyJob() {
  const selected = getSelectedApplyJob();
  if (!selected?.detailUrl) {
    speakSubtitle("当前岗位没有可打开的详情链接。", "Apply", { record: false, voice: false });
    return;
  }
  await openApplyJobInSystemBrowser(selected);
  speakSubtitle(`已用系统浏览器打开 ${selected.company || ""} ${selected.title || ""}，请在 Boss 页面手动完成投递。`, "Apply", {
    record: false,
  });
}

async function writeSelectedGreetingToClipboard() {
  const selected = getSelectedApplyJob();
  const text = selected?.greeting || applyGreeting?.value || "";
  if (!text.trim()) throw new Error("当前没有可复制的话术。");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    applyGreeting.focus();
    applyGreeting.select();
    document.execCommand("copy");
  }
  return text;
}

async function copySelectedGreeting() {
  const selected = getSelectedApplyJob();
  const text = selected?.greeting || applyGreeting?.value || "";
  if (!text.trim()) {
    speakSubtitle("当前没有可复制的招呼语。", "Apply", { record: false, voice: false });
    return;
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    applyGreeting.focus();
    applyGreeting.select();
    document.execCommand("copy");
  }
  speakSubtitle("招呼语已复制，可以粘贴到 Boss 沟通窗口。", "Apply", { record: false });
  appendLog("Apply greeting copied.");
}

async function prepareSelectedApplyJob() {
  const selected = getSelectedApplyJob();
  if (!selected) {
    speakSubtitle("请先选择一个岗位。", "Apply", { record: false, voice: false });
    return;
  }

  let opened = false;
  try {
    if (selected.detailUrl) {
      await openApplyJobInSystemBrowser(selected);
      opened = true;
    }
  } catch (error) {
    appendLog(`Apply job open failed: ${error.message}`);
  }

  try {
    await writeSelectedGreetingToClipboard();
  } catch (error) {
    appendLog(`Apply greeting copy failed: ${error.message}`);
  }

  speakSubtitle(
    opened
      ? "已用系统浏览器打开岗位页并复制话术。请在 Boss 官方页面手动完成投递或沟通。"
      : "话术已复制，但岗位页没有成功打开。请检查浏览器或稍后重试。",
    "Apply",
    { record: false },
  );
}

function selectNextApplyJob() {
  selectedApplyJobId = findNextApplyJobId(applyWorkbench.jobs || [], selectedApplyJobId);
  renderApplyJobs();
}

function handleApplyAction(action) {
  if (action === "search") searchApplyWorkbench();
  if (action === "next") selectNextApplyJob();
  if (action === "open") openSelectedApplyJob();
  if (action === "prepare") prepareSelectedApplyJob().catch((error) => {
    speakSubtitle(`处理失败：${error.message}`, "Apply", { record: false, voice: false });
  });
  if (action === "copy") copySelectedGreeting().catch((error) => {
    speakSubtitle(`复制失败：${error.message}`, "Apply", { record: false, voice: false });
  });
  if (action === "applied") markSelectedApplyJob("applied").catch((error) => {
    speakSubtitle(`状态更新失败：${error.message}`, "Apply", { record: false, voice: false });
  });
  if (action === "skip") markSelectedApplyJob("skipped").catch((error) => {
    speakSubtitle(`状态更新失败：${error.message}`, "Apply", { record: false, voice: false });
  });
}

function handleApplyShortcut(event) {
  const panel = document.getElementById("applyWorkbench");
  if (!panel?.classList.contains("is-open")) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName)) return;

  const key = event.key.toLowerCase();
  const actionByKey = new Map([
    ["enter", "prepare"],
    ["a", "applied"],
    ["s", "skip"],
    ["n", "next"],
    ["c", "copy"],
  ]);
  const action = actionByKey.get(key);
  if (!action) return;
  event.preventDefault();
  handleApplyAction(action);
}

async function saveAiConfig() {
  const config = readAiConfig();
  localStorage.setItem(localAiConfigKey, JSON.stringify(publicAiConfig(config)));
  try {
    await runBackendCommand("保存 AI 配置");
    const saved = await api("/api/config/ai", {
      method: "POST",
      body: JSON.stringify(config),
    });
    applyAiConfig(saved);
    localStorage.setItem(localAiConfigKey, JSON.stringify(publicAiConfig(saved)));
    speakSubtitle(`AI 配置已保存：${saved.provider}，模型 ${saved.model}。`, "AI");
  } catch (error) {
    speakSubtitle(`AI 配置已保存在浏览器，本地后端不可用：${error.message}`, "AI");
  }
  appendLog(`AI config saved: ${config.provider} / ${config.model}.`);
}

async function loadAiConfig() {
  try {
    applyAiProviders(await api("/api/config/ai/providers"));
    applyAiConfig(await api("/api/config/ai"));
  } catch {
    try {
      applyAiConfig(JSON.parse(localStorage.getItem(localAiConfigKey) || "null") || { provider: "ollama" });
    } catch {
      applyAiConfig({ provider: "ollama" });
    }
  }
}

async function resetAiConfig() {
  localStorage.removeItem(localAiConfigKey);
  try {
    await runBackendCommand("重置 AI 配置");
    applyAiConfig(await api("/api/config/ai/reset", { method: "POST" }));
  } catch {
    applyAiConfig({ provider: "ollama" });
  }
  appendLog("AI config reset to Ollama defaults.");
  speakSubtitle("AI 配置已重置为本地 Ollama 默认值。", "AI");
}

async function testAiConfig() {
  const config = readAiConfig();
  aiConfigBadge.textContent = "Testing";
  appendLog(`AI test queued: ${config.endpoint} / ${config.model}.`);
  try {
    await runBackendCommand("测试 AI 连接");
    const result = await api("/api/ai/test", {
      method: "POST",
      body: JSON.stringify(config),
    });
    aiConfigBadge.textContent = result.ok ? "Ready" : "Failed";
    speakSubtitle(result.ok ? `${config.model} 连接测试通过。` : `${config.model} 连接测试未通过。`, "AI");
  } catch (error) {
    aiConfigBadge.textContent = "Failed";
    speakSubtitle(`AI 连接测试失败：${error.message}`, "AI");
  }
  window.setTimeout(() => {
    aiConfigBadge.textContent = providerDefaults[config.provider]?.badge || "Ready";
  }, 1400);
}

function handleAiAction(action) {
  if (action === "save") saveAiConfig();
  if (action === "test") testAiConfig();
  if (action === "reset") resetAiConfig();
}

function applyRequestFormatTemplateDefaults() {
  const defaults = requestFormatDefaults[aiRequestFormat.value];
  if (defaults) {
    aiRequestMethod.value = "POST";
    aiRequestPath.value = defaults.requestPath;
    aiHeadersTemplate.value = "";
    aiBodyTemplate.value = "";
    aiResponsePath.value = defaults.responsePath;
    return;
  }

  if (aiRequestFormat.value !== "custom-template") return;
  aiRequestMethod.value = aiRequestMethod.value || "POST";
  if (!aiRequestPath.value) aiRequestPath.value = "/responses";
  if (!aiHeadersTemplate.value) {
    aiHeadersTemplate.value = JSON.stringify(
      {
        Authorization: "Bearer {{apiKey}}",
        "Content-Type": "application/json",
      },
      null,
      2,
    );
  }
  if (!aiBodyTemplate.value) {
    aiBodyTemplate.value = JSON.stringify(
      {
        model: "{{model}}",
        instructions: "{{instructions}}",
        input: "{{responsesInputJson}}",
        temperature: "{{temperature}}",
      },
      null,
      2,
    );
  }
  if (!aiResponsePath.value) aiResponsePath.value = "output_text";
}

async function handleMcpAction(action) {
  if (action === "connect" || action === "test") {
    mcpBadge.textContent = "Checking";
    try {
      await runBackendCommand(action === "test" ? "测试 boss-mcp" : "连接 MCP");
      const status = await api("/api/mcp/status");
      mcpBadge.textContent = status.server.available ? "Connected" : "Offline";
      mcpServerState.textContent = status.server.available
        ? `${status.server.name || "boss"} ${status.server.version || ""}`.trim()
        : "stdio / unavailable";
      renderMcpTools(status.tools);
      renderMcpServers(status.servers || []);
      speakSubtitle(
        status.server.available
          ? `MCP 网关已连接，同步到 ${status.toolCount || status.tools?.length || 0} 个工具。`
          : `boss-mcp 暂不可用：${status.server.error || "请检查安装路径或登录状态。"}`,
        "MCP",
      );
    } catch (error) {
      mcpBadge.textContent = "Failed";
      speakSubtitle(`MCP 状态检查失败：${error.message}`, "MCP");
    }
    appendLog("MCP status checked.");
    return;
  }

  if (action === "sync") {
    mcpBadge.textContent = "Syncing";
    try {
      await runBackendCommand("同步 MCP 工具");
      const result = await api("/api/mcp/tools");
      renderMcpTools(result.tools);
      renderMcpServers(result.servers || []);
      mcpBadge.textContent = `${result.toolCount} tools`;
      mcpServerState.textContent = `${(result.servers || []).filter((server) => server.available).length}/${result.servers?.length || 0} online`;
      speakSubtitle(`MCP 工具已同步：${result.toolCount} 个工具可用。`, "MCP");
      appendLog(`MCP tool list synced: ${result.toolCount} tools.`);
    } catch (error) {
      mcpBadge.textContent = "Failed";
      speakSubtitle(`MCP 工具同步失败：${error.message}`, "MCP");
      appendLog(`MCP tool sync failed: ${error.message}`);
    }
  }
}

function updateClock() {
  clock.textContent = timeLabel();
}

function closeModuleWindow() {
  document.body.classList.remove("has-modal");
  modules.forEach((module) => {
    module.classList.remove("is-open");
    restoreModuleHome(module);
  });
}

function openModuleWindow(module) {
  modules.forEach((candidate) => {
    if (candidate !== module) candidate.classList.remove("is-open");
    if (candidate !== module) restoreModuleHome(candidate);
  });
  holdModulePlace(module);
  module.classList.add("is-open");
  document.body.classList.add("has-modal");
}

function holdModulePlace(module) {
  if (!moduleHomes.has(module)) {
    const placeholder = document.createElement("div");
    const rect = module.getBoundingClientRect();
    placeholder.className = "module module-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.style.height = `${rect.height}px`;
    moduleHomes.set(module, {
      parent: module.parentNode,
      nextSibling: module.nextSibling,
      placeholder,
    });
    module.parentNode.insertBefore(placeholder, module);
  }
}

function restoreModuleHome(module) {
  const home = moduleHomes.get(module);
  if (!home || !home.parent?.isConnected) return;
  const reference = home.placeholder?.isConnected
    ? home.placeholder
    : home.nextSibling?.isConnected
      ? home.nextSibling
      : null;
  home.parent.insertBefore(module, reference);
  if (home.placeholder?.isConnected) home.placeholder.remove();
  moduleHomes.delete(module);
}

wakeButton.addEventListener("click", () => {
  primeSpeechOutput();
  setWakeState(!active);
});

modules.forEach((module) => {
  const header = module.querySelector(".module-header");
  if (!header) return;

  const closeButton = document.createElement("button");
  closeButton.className = "module-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close module");
  closeButton.textContent = "×";
  header.appendChild(closeButton);

  closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    closeModuleWindow();
  });

  module.addEventListener("click", (event) => {
    if (module.classList.contains("is-open")) return;
    event.stopPropagation();
    openModuleWindow(module);
  });
});

modalBackdrop.addEventListener("click", closeModuleWindow);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModuleWindow();
  handleApplyShortcut(event);
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    primeSpeechOutput();
    setMode(button.dataset.mode);
  });
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    primeSpeechOutput();
    setTheme(button.dataset.theme);
  });
});

commandButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    primeSpeechOutput();
    const command = button.dataset.command;
    addChat("user", command);
    appendLog(`Command queued: ${command}.`);

    if (button.dataset.aiAction) {
      handleAiAction(button.dataset.aiAction);
    } else if (button.dataset.mcpAction) {
      handleMcpAction(button.dataset.mcpAction);
    } else {
      try {
        await runBackendCommand(command);
      } catch (error) {
        speakSubtitle(responses[command] || `已收到指令：${command}。`, "Queued");
        appendLog(`Command backend failed: ${error.message}`);
      }
    }

    if (command === "检查麦克风") checkMicrophone();
    if (command === "连接 MCP" && !button.dataset.mcpAction) handleMcpAction("connect");
    if (command === "读取屏幕") requestScreenCapture();
    if (command === "搜索网页") requestWebSearch();
  });
});

document.querySelectorAll("[data-mcp-config-action]").forEach((button) => {
  button.addEventListener("click", () => {
    primeSpeechOutput();
    if (button.dataset.mcpConfigAction === "new") newMcpServer();
    if (button.dataset.mcpConfigAction === "save") saveMcpConfig();
  });
});

document.querySelectorAll("[data-apply-action]").forEach((button) => {
  button.addEventListener("click", () => {
    primeSpeechOutput();
    handleApplyAction(button.dataset.applyAction);
  });
});

askForm.addEventListener("submit", (event) => {
  primeSpeechOutput();
  event.preventDefault();
  if (pendingAskMode === "web-search") {
    performWebSearch(askInput.value, "text");
    return;
  }
  askJarvis(askInput.value, "text");
});

voiceAskButton.addEventListener("click", () => {
  primeSpeechOutput();
  startVoiceQuestion();
});

aiProvider.addEventListener("change", () => {
  primeSpeechOutput();
  const defaults = providerDefaults[aiProvider.value] || providerDefaults.ollama;
  aiEndpoint.value = defaults.endpoint;
  aiModel.value = defaults.model;
  aiRequestFormat.value = defaults.requestFormat || "openai-compatible";
  aiRequestMethod.value = defaults.requestMethod || "POST";
  aiRequestPath.value = defaults.requestPath || "";
  aiHeadersTemplate.value = defaults.headersTemplate || "";
  aiBodyTemplate.value = defaults.bodyTemplate || "";
  aiResponsePath.value = defaults.responsePath || "";
  aiConfigBadge.textContent = defaults.badge;
  speakSubtitle(`AI 提供商已切换为 ${aiProvider.value}。`, "AI");
  saveRuntimePatch({ subtitleState: "AI", subtitleText: `AI 提供商已切换为 ${aiProvider.value}。` });
});

aiRequestFormat.addEventListener("change", applyRequestFormatTemplateDefaults);

aiTemperature.addEventListener("input", () => {
  temperatureValue.textContent = Number(aiTemperature.value).toFixed(2);
});

aiVoiceProfile.addEventListener("change", () => {
  primeSpeechOutput();
  const profile = getVoiceProfile();
  speakSubtitle(`Voice profile switched to ${profile.label}.`, "Voice", { record: false, voice: false });
});

aiVoicePreview?.addEventListener("click", previewVoiceProfile);

clearChatButton.addEventListener("click", () => {
  chatMessages = [];
  persistLocalChat();
  renderChat();
  api("/api/chat", { method: "DELETE" }).catch((error) => appendLog(`Clear chat backend failed: ${error.message}`));
  appendLog("Chat history cleared.");
});

window.addEventListener("resize", resize);

await loadAiConfig();
await loadMcpConfig();
await loadApplyWorkbench();
await loadRuntime();
await loadChat();
await loadEvents();
resize();
updateClock();
setInterval(updateClock, 1000);
requestAnimationFrame(render);
