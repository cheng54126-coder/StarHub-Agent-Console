import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function loadStoreWithTempData() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jarvis-ai-config-"));
  process.env.JARVIS_DATA_DIR = tempDir;
  const suffix = `?case=${Date.now()}-${Math.random()}`;
  const store = await import(`./store.js${suffix}`);
  await store.ensureStore();
  return { tempDir, store };
}

test("AI config defaults to OpenAI compatible request format", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  try {
    const config = await store.getAiConfig();
    assert.equal(config.requestFormat, "openai-compatible");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("AI config can be read from a UTF-8 BOM JSON file", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  try {
    await writeFile(
      path.join(tempDir, "ai-config.json"),
      `\uFEFF${JSON.stringify({
        provider: "openai-compatible",
        endpoint: "https://example.test/v1",
        model: "gpt-5.5",
        requestFormat: "openai-responses",
      })}`,
      "utf8",
    );

    const config = await store.getAiConfig();
    assert.equal(config.provider, "openai-compatible");
    assert.equal(config.model, "gpt-5.5");
    assert.equal(config.requestFormat, "openai-responses");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("AI config persists Claude compatible request format", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  try {
    const config = await store.saveAiConfig({
      provider: "custom",
      endpoint: "https://api.anthropic.com/v1",
      model: "claude-sonnet-4-5",
      requestFormat: "claude-compatible",
    });

    assert.equal(config.requestFormat, "claude-compatible");
    assert.equal((await store.getAiConfig()).requestFormat, "claude-compatible");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("AI config persists OpenAI Responses request format", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  try {
    const config = await store.saveAiConfig({
      provider: "openai-compatible",
      endpoint: "https://example.test/v1",
      model: "gpt-5.5",
      requestFormat: "openai-responses",
    });

    assert.equal(config.requestFormat, "openai-responses");
    assert.equal((await store.getAiConfig()).requestFormat, "openai-responses");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("AI config persists additional relay request formats", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  try {
    for (const requestFormat of [
      "openai-completions",
      "claude-bearer-compatible",
      "gemini-compatible",
      "codex-responses",
    ]) {
      const config = await store.saveAiConfig({
        provider: "custom",
        endpoint: "https://relay.example/v1",
        model: "relay-model",
        requestFormat,
      });

      assert.equal(config.requestFormat, requestFormat);
      assert.equal((await store.getAiConfig()).requestFormat, requestFormat);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("AI config persists custom request templates", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  try {
    const config = await store.saveAiConfig({
      provider: "custom",
      endpoint: "https://relay.example/v1",
      model: "relay-model",
      requestFormat: "custom-template",
      requestPath: "/custom/responses",
      headersTemplate: "{\"x-relay-model\":\"{{model}}\"}",
      bodyTemplate: "{\"model\":\"{{model}}\",\"prompt\":\"{{input}}\"}",
      responsePath: "data.answer",
    });

    assert.equal(config.requestFormat, "custom-template");
    assert.equal(config.requestPath, "/custom/responses");
    assert.equal(config.headersTemplate, "{\"x-relay-model\":\"{{model}}\"}");
    assert.equal(config.bodyTemplate, "{\"model\":\"{{model}}\",\"prompt\":\"{{input}}\"}");
    assert.equal(config.responsePath, "data.answer");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("public AI config masks a saved API key", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  try {
    await store.saveAiConfig({
      provider: "openai-compatible",
      endpoint: "https://example.test/v1",
      model: "example-model",
      apiKey: "sk-test-secret-123456",
    });

    const internalConfig = await store.getAiConfig();
    const publicConfig = await store.getPublicAiConfig();

    assert.equal(internalConfig.apiKey, "sk-test-secret-123456");
    assert.equal(publicConfig.apiKey, "");
    assert.equal(publicConfig.hasApiKey, true);
    assert.equal(publicConfig.apiKeyPreview, "sk-t...3456");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("saving AI config without an API key preserves the configured key", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  try {
    await store.saveAiConfig({
      provider: "openai-compatible",
      endpoint: "https://example.test/v1",
      model: "first-model",
      apiKey: "sk-existing-secret",
    });

    const updated = await store.saveAiConfig({
      provider: "openai-compatible",
      endpoint: "https://example.test/v1",
      model: "second-model",
      apiKey: "",
    });

    assert.equal(updated.model, "second-model");
    assert.equal((await store.getAiConfig()).apiKey, "sk-existing-secret");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("AI config persists a supported voice profile", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  try {
    const config = await store.saveAiConfig({
      provider: "openai-compatible",
      endpoint: "https://example.test/v1",
      model: "voice-model",
      voiceProfile: "deep",
    });

    assert.equal(config.voiceProfile, "deep");
    assert.equal((await store.getPublicAiConfig()).voiceProfile, "deep");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("AI config ignores unsupported voice profiles", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  try {
    await store.saveAiConfig({
      provider: "openai-compatible",
      endpoint: "https://example.test/v1",
      model: "voice-model",
      voiceProfile: "calm",
    });

    const config = await store.saveAiConfig({
      provider: "openai-compatible",
      endpoint: "https://example.test/v1",
      model: "voice-model",
      voiceProfile: "unknown",
    });

    assert.equal(config.voiceProfile, "calm");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("chat requests use the API key saved in AI config before environment keys", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  const originalFetch = globalThis.fetch;
  const originalJarvisKey = process.env.JARVIS_AI_API_KEY;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  try {
    process.env.JARVIS_AI_API_KEY = "env-jarvis-key";
    process.env.OPENAI_API_KEY = "env-openai-key";
    await store.saveAiConfig({
      provider: "openai-compatible",
      endpoint: "https://example.test/v1",
      model: "example-model",
      apiKey: "saved-config-key",
      requestFormat: "openai-compatible",
    });

    let authorization = "";
    globalThis.fetch = async (_url, options) => {
      authorization = options.headers.authorization;
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const ai = await import(`./ai.js?case=${Date.now()}-${Math.random()}`);
    await ai.chatWithAi({ messages: [{ role: "user", text: "hello" }] });

    assert.equal(authorization, "Bearer saved-config-key");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalJarvisKey === undefined) {
      delete process.env.JARVIS_AI_API_KEY;
    } else {
      process.env.JARVIS_AI_API_KEY = originalJarvisKey;
    }
    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("chat requests can use the OpenAI legacy completions format", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  const originalFetch = globalThis.fetch;
  try {
    await store.saveAiConfig({
      provider: "openai-compatible",
      endpoint: "https://example.test/v1",
      model: "legacy-model",
      apiKey: "saved-config-key",
      requestFormat: "openai-completions",
    });

    let requestUrl = "";
    let requestBody = null;
    globalThis.fetch = async (url, options) => {
      requestUrl = String(url);
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ choices: [{ text: "legacy ok" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const ai = await import(`./ai.js?case=${Date.now()}-${Math.random()}`);
    const result = await ai.chatWithAi({ messages: [{ role: "user", text: "hello" }] });

    assert.equal(requestUrl, "https://example.test/v1/completions");
    assert.equal(requestBody.model, "legacy-model");
    assert.equal(requestBody.prompt.includes("You are JARVIS"), true);
    assert.equal(requestBody.prompt.includes("User: hello"), true);
    assert.equal(result.text, "legacy ok");
  } finally {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("chat requests can use the OpenAI Responses API format", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  const originalFetch = globalThis.fetch;
  try {
    await store.saveAiConfig({
      provider: "openai-compatible",
      endpoint: "https://example.test/v1",
      model: "gpt-5.5",
      apiKey: "saved-config-key",
      requestFormat: "openai-responses",
    });

    let requestUrl = "";
    let requestBody = null;
    globalThis.fetch = async (url, options) => {
      requestUrl = String(url);
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ output_text: "responses ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const ai = await import(`./ai.js?case=${Date.now()}-${Math.random()}`);
    const result = await ai.chatWithAi({ messages: [{ role: "user", text: "hello" }] });

    assert.equal(requestUrl, "https://example.test/v1/responses");
    assert.equal(requestBody.model, "gpt-5.5");
    assert.equal(requestBody.instructions.includes("You are JARVIS"), true);
    assert.deepEqual(requestBody.input, [
      {
        role: "user",
        content: [{ type: "input_text", text: "hello" }],
      },
    ]);
    assert.equal(result.text, "responses ok");
  } finally {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("chat requests can use a Claude bearer relay format", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  const originalFetch = globalThis.fetch;
  try {
    await store.saveAiConfig({
      provider: "custom",
      endpoint: "https://claude-relay.example/v1",
      model: "claude-relay-model",
      apiKey: "saved-config-key",
      requestFormat: "claude-bearer-compatible",
    });

    let requestUrl = "";
    let requestHeaders = {};
    let requestBody = null;
    globalThis.fetch = async (url, options) => {
      requestUrl = String(url);
      requestHeaders = options.headers;
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ content: [{ type: "text", text: "claude bearer ok" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const ai = await import(`./ai.js?case=${Date.now()}-${Math.random()}`);
    const result = await ai.chatWithAi({ messages: [{ role: "user", text: "hello" }] });

    assert.equal(requestUrl, "https://claude-relay.example/v1/messages");
    assert.equal(requestHeaders.authorization, "Bearer saved-config-key");
    assert.equal(requestHeaders["x-api-key"], undefined);
    assert.equal(requestBody.system.includes("You are JARVIS"), true);
    assert.equal(requestBody.messages[0].content, "hello");
    assert.equal(result.text, "claude bearer ok");
  } finally {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("chat requests can use Gemini generateContent format", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  const originalFetch = globalThis.fetch;
  try {
    await store.saveAiConfig({
      provider: "custom",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.5-flash",
      apiKey: "saved-config-key",
      requestFormat: "gemini-compatible",
    });

    let requestUrl = "";
    let requestHeaders = {};
    let requestBody = null;
    globalThis.fetch = async (url, options) => {
      requestUrl = String(url);
      requestHeaders = options.headers;
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "gemini ok" }] } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const ai = await import(`./ai.js?case=${Date.now()}-${Math.random()}`);
    const result = await ai.chatWithAi({ messages: [{ role: "user", text: "hello" }] });

    assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    assert.equal(requestHeaders["x-goog-api-key"], "saved-config-key");
    assert.equal(requestBody.systemInstruction.parts[0].text.includes("You are JARVIS"), true);
    assert.equal(requestBody.contents[0].role, "user");
    assert.equal(requestBody.contents[0].parts[0].text, "hello");
    assert.equal(result.text, "gemini ok");
  } finally {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("chat requests can use a Codex style responses relay format", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  const originalFetch = globalThis.fetch;
  try {
    await store.saveAiConfig({
      provider: "custom",
      endpoint: "https://relay.example/v1",
      model: "gpt-5.5",
      apiKey: "saved-config-key",
      requestFormat: "codex-responses",
    });

    let requestUrl = "";
    let requestHeaders = {};
    let requestBody = null;
    globalThis.fetch = async (url, options) => {
      requestUrl = String(url);
      requestHeaders = options.headers;
      requestBody = JSON.parse(options.body);
      return new Response('data: {"type":"response.output_text.delta","delta":"codex ok"}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    };

    const ai = await import(`./ai.js?case=${Date.now()}-${Math.random()}`);
    const result = await ai.chatWithAi({
      messages: [
        { role: "jarvis", text: "previous answer" },
        { role: "user", text: "hello" },
      ],
    });

    assert.equal(requestUrl, "https://relay.example/v1/responses");
    assert.equal(requestHeaders.authorization, "Bearer saved-config-key");
    assert.equal(requestHeaders.accept, "text/event-stream");
    assert.equal(requestHeaders.originator, "codex-tui");
    assert.match(requestHeaders["user-agent"], /^codex-tui\/0\.141\.0/);
    assert.match(requestHeaders["x-codex-window-id"], /^[0-9a-f-]+:0$/);
    assert.equal(requestHeaders["session-id"], requestHeaders["x-client-request-id"]);
    assert.equal(requestBody.model, "gpt-5.5");
    assert.equal(requestBody.instructions.includes("You are JARVIS"), true);
    assert.equal(requestBody.input[0].role, "assistant");
    assert.equal(requestBody.input[0].content[0].type, "output_text");
    assert.equal(requestBody.input[0].content[0].text, "previous answer");
    assert.equal(requestBody.input[1].role, "user");
    assert.equal(requestBody.input[1].content[0].type, "input_text");
    assert.equal(requestBody.input[1].content[0].text, "hello");
    assert.equal(requestBody.stream, true);
    assert.deepEqual(requestBody.include, ["reasoning.encrypted_content"]);
    assert.deepEqual(requestBody.reasoning, { effort: "medium" });
    assert.equal(Object.hasOwn(requestBody, "temperature"), false);
    assert.equal(Array.isArray(requestBody.tools), true);
    assert.equal(requestBody.tools[0].type, "function");
    assert.equal(requestBody.tool_choice, "auto");
    assert.equal(requestBody.parallel_tool_calls, true);
    assert.equal(requestBody.prompt_cache_key, requestHeaders["x-client-request-id"]);
    assert.deepEqual(requestBody.text, { verbosity: "low" });
    assert.equal(requestBody.client_metadata.session_id, requestHeaders["x-client-request-id"]);
    assert.equal(requestBody.client_metadata["x-codex-window-id"], requestHeaders["x-codex-window-id"]);
    assert.equal(result.text, "codex ok");
  } finally {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("chat requests can use a custom relay request template", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  const originalFetch = globalThis.fetch;
  try {
    await store.saveAiConfig({
      provider: "custom",
      endpoint: "https://relay.example/v1",
      model: "relay-model",
      apiKey: "saved-config-key",
      requestFormat: "custom-template",
      requestPath: "/codex/responses",
      headersTemplate: JSON.stringify({
        authorization: "Bearer {{apiKey}}",
        originator: "codex-tui",
        "x-client-request-id": "{{sessionId}}",
      }),
      bodyTemplate: JSON.stringify({
        model: "{{model}}",
        instructions: "{{instructions}}",
        input: "{{responsesInputJson}}",
        temperature: "{{temperature}}",
      }),
      responsePath: "data.answer",
    });

    let requestUrl = "";
    let requestHeaders = {};
    let requestBody = null;
    globalThis.fetch = async (url, options) => {
      requestUrl = String(url);
      requestHeaders = options.headers;
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ data: { answer: "custom ok" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const ai = await import(`./ai.js?case=${Date.now()}-${Math.random()}`);
    const result = await ai.chatWithAi({ messages: [{ role: "user", text: "hello \"relay\"" }] });

    assert.equal(requestUrl, "https://relay.example/v1/codex/responses");
    assert.equal(requestHeaders.authorization, "Bearer saved-config-key");
    assert.equal(requestHeaders.originator, "codex-tui");
    assert.equal(requestBody.model, "relay-model");
    assert.equal(requestBody.instructions.includes("You are JARVIS"), true);
    assert.equal(requestBody.input[0].content[0].text, "hello \"relay\"");
    assert.equal(requestBody.temperature, "0.4");
    assert.equal(result.text, "custom ok");
  } finally {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  }
});
