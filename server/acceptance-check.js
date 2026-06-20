import assert from "node:assert/strict";

const base = "http://127.0.0.1:8787";

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error?.message || `HTTP ${response.status}`);
  }
  return payload.data;
}

const originalConfig = await api("/api/config/ai");

try {
  await api("/api/config/ai", {
    method: "POST",
    body: JSON.stringify({
      provider: "openai-compatible",
      endpoint: "http://127.0.0.1:18080/v1",
      model: "mock-jarvis",
      requestFormat: "openai-compatible",
      temperature: 0.2,
      voiceInput: true,
      voiceOutput: false,
      memory: false,
    }),
  });

  const html = await (await fetch(base)).text();
  assert.match(html, /id="askForm"/);
  assert.match(html, /id="voiceAskButton"/);
  assert.match(html, /id="aiRequestFormat"/);
  assert.match(html, /读取屏幕/);
  assert.match(html, /搜索网页/);

  const aiTest = await api("/api/ai/test", { method: "POST", body: "{}" });
  assert.equal(aiTest.ok, true);

  const chat = await api("/api/chat/complete", {
    method: "POST",
    body: JSON.stringify({ text: "你好，贾维斯" }),
  });
  assert.match(chat.assistantMessage.text, /贾维斯回复/);

  const search = await api("/api/web-search", {
    method: "POST",
    body: JSON.stringify({ query: "Open Jarvis self hosted voice AI", provider: "bing" }),
  });
  assert.equal(search.status, "answered");
  assert.match(search.answer, /搜索总结/);

  const screenState = await api("/api/screen/permission", {
    method: "POST",
    body: JSON.stringify({ status: "Blocked", message: "验收测试：屏幕权限拒绝路径。" }),
  });
  assert.equal(screenState.screen, "Blocked");

  const micState = await api("/api/state", {
    method: "POST",
    body: JSON.stringify({ microphone: "Granted" }),
  });
  assert.equal(micState.microphone, "Granted");

  const formats = await api("/api/config/ai/providers");
  assert.equal(formats.anthropic.requestFormat, "claude-compatible");
  assert.equal(formats.openai.requestFormat, "openai-compatible");

  console.log(JSON.stringify({ ok: true, checked: ["html", "ai-config", "text-chat", "ai-web-search", "screen-state", "microphone-state"] }, null, 2));
} finally {
  await api("/api/config/ai", {
    method: "POST",
    body: JSON.stringify(originalConfig),
  });
}
