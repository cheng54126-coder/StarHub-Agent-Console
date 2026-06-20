import { randomUUID } from "node:crypto";
import { getAiConfig } from "./store.js";

export const aiProviders = {
  ollama: {
    label: "Ollama",
    badge: "Local",
    endpoint: "http://127.0.0.1:11434/v1",
    model: "qwen2.5:7b",
    auth: "none",
    requestFormat: "openai-compatible",
    requestMethod: "POST",
    requestPath: "/chat/completions",
    responsePath: "choices[0].message.content",
  },
  "openai-compatible": {
    label: "OpenAI Compatible",
    badge: "Compat",
    endpoint: "http://127.0.0.1:8000/v1",
    model: "gpt-4.1-mini",
    auth: "bearer-env",
    requestFormat: "openai-compatible",
    requestMethod: "POST",
    requestPath: "/chat/completions",
    responsePath: "choices[0].message.content",
  },
  openai: {
    label: "OpenAI",
    badge: "Cloud",
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    auth: "bearer-env",
    requestFormat: "openai-compatible",
    requestMethod: "POST",
    requestPath: "/chat/completions",
    responsePath: "choices[0].message.content",
  },
  anthropic: {
    label: "Anthropic",
    badge: "Cloud",
    endpoint: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-5",
    auth: "x-api-key-env",
    requestFormat: "claude-compatible",
    requestMethod: "POST",
    requestPath: "/messages",
    responsePath: "content[0].text",
  },
  gemini: {
    label: "Google Gemini",
    badge: "Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
    auth: "x-goog-api-key-env",
    requestFormat: "gemini-compatible",
    requestMethod: "POST",
    requestPath: "/models/{{modelUrl}}:generateContent",
    responsePath: "candidates[0].content.parts[0].text",
  },
  custom: {
    label: "Custom",
    badge: "Custom",
    endpoint: "http://127.0.0.1:3000/v1",
    model: "custom-agent",
    auth: "optional-env",
    requestFormat: "openai-compatible",
    requestMethod: "POST",
    requestPath: "/chat/completions",
    responsePath: "choices[0].message.content",
  },
};

export function getAiProviders() {
  return aiProviders;
}

function normalizeEndpoint(endpoint) {
  return String(endpoint || "").replace(/\/+$/, "");
}

function joinEndpointPath(endpoint, requestPath = "") {
  const path = String(requestPath || "").trim();
  if (!path) return endpoint;
  if (/^https?:\/\//i.test(path)) return path;
  return `${endpoint}/${path.replace(/^\/+/, "")}`;
}

const jarvisInstructions =
  "You are JARVIS, a concise local desktop AI assistant. Reply in the user's language. Keep answers brief and actionable.";

function toResponsesInput(messages) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "jarvis" ? "assistant" : message.role,
      content: [
        {
          type: "input_text",
          text: message.text || message.content || "",
        },
      ],
    }));
}

function toOpenAiMessages(messages) {
  return messages.map((message) => ({
    role: message.role === "jarvis" ? "assistant" : message.role,
    content: message.text || message.content || "",
  }));
}

function toClaudeMessages(messages) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "jarvis" || message.role === "assistant" ? "assistant" : "user",
      content: message.text || message.content || "",
    }));
}

function toGeminiContents(messages) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "jarvis" || message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.text || message.content || "" }],
    }));
}

function toCodexResponsesInput(messages) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const role = message.role === "jarvis" ? "assistant" : message.role;
      const contentType = role === "assistant" ? "output_text" : "input_text";
      return {
        type: "message",
        role,
        content: [
          {
            type: contentType,
            text: message.text || message.content || "",
          },
        ],
      };
    });
}

function toLegacyPrompt(messages) {
  const lines = [`System: ${jarvisInstructions}`];
  for (const message of messages) {
    const role = message.role === "jarvis" || message.role === "assistant" ? "Assistant" : "User";
    lines.push(`${role}: ${message.text || message.content || ""}`);
  }
  lines.push("Assistant:");
  return lines.join("\n\n");
}

function normalizeGeminiModel(model) {
  return String(model || "").replace(/^models\//, "");
}

function getDefaultRequestPath(requestFormat, config) {
  if (requestFormat === "openai-responses" || requestFormat === "codex-responses") return "/responses";
  if (requestFormat === "openai-completions") return "/completions";
  if (requestFormat === "claude-compatible" || requestFormat === "claude-bearer-compatible") return "/messages";
  if (requestFormat === "gemini-compatible") return "/models/{{modelUrl}}:generateContent";
  return "/chat/completions";
}

function getConfiguredRequestUrl(endpoint, config, requestFormat, context) {
  const requestPath = String(config.requestPath || "").trim() || getDefaultRequestPath(requestFormat, config);
  return joinEndpointPath(endpoint, renderTemplate(requestPath, context));
}

function extractResponsesText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  if (Array.isArray(data?.output)) {
    return data.output
      .flatMap((item) => item?.content || [])
      .map((content) => content?.text || "")
      .join("");
  }
  return "";
}

function extractGeminiText(data) {
  if (!Array.isArray(data?.candidates)) return "";
  return data.candidates
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || "")
    .join("");
}

function getPathValue(value, path = "") {
  if (!path) return "";
  return String(path)
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => current?.[key], value);
}

function extractTextFromAnyResponse(data, responsePath = "") {
  if (responsePath) {
    const configured = getPathValue(data, responsePath);
    if (typeof configured === "string") return configured;
    if (configured != null) return String(configured);
  }
  return (
    extractResponsesText(data) ||
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    extractGeminiText(data) ||
    data?.content?.map?.((item) => item.text || "").join("") ||
    data?.message?.content ||
    ""
  );
}

function escapeJsonString(value) {
  return JSON.stringify(String(value ?? "")).slice(1, -1);
}

function createTemplateContext({ config, messages, apiKey }) {
  const sessionId = randomUUID();
  const turnId = randomUUID();
  const windowId = `${sessionId}:0`;
  const input = [...messages].reverse().find((message) => message.role === "user")?.text || "";
  const metadata = {
    installation_id: sessionId,
    session_id: sessionId,
    thread_id: sessionId,
    turn_id: turnId,
    window_id: windowId,
    request_kind: "turn",
    sandbox: "windows_elevated",
    turn_started_at_unix_ms: Date.now(),
  };
  const openAiMessages = [
    { role: "system", content: jarvisInstructions },
    ...toOpenAiMessages(messages),
  ];
  const responsesInput = toResponsesInput(messages);
  const codexResponsesInput = toCodexResponsesInput(messages);
  const geminiContents = toGeminiContents(messages);

  return {
    apiKey,
    codexInputJson: JSON.stringify(codexResponsesInput),
    endpoint: config.endpoint,
    geminiContentsJson: JSON.stringify(geminiContents),
    input,
    instructions: jarvisInstructions,
    legacyPrompt: toLegacyPrompt(messages),
    metadataJson: JSON.stringify(metadata),
    model: config.model,
    modelUrl: encodeURIComponent(normalizeGeminiModel(config.model)),
    openAiMessagesJson: JSON.stringify(openAiMessages),
    responsesInputJson: JSON.stringify(responsesInput),
    messagesJson: JSON.stringify(messages),
    sessionId,
    temperature: String(config.temperature ?? 0.4),
    timestampMs: String(Date.now()),
    turnId,
    windowId,
  };
}

function renderTemplate(template, context) {
  return String(template || "")
    .replace(/"\{\{\s*([A-Za-z0-9_]+Json)\s*\}\}"/g, (_match, key) => {
      const value = context[key];
      return value === undefined || value === null ? "null" : String(value);
    })
    .replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = context[key];
    if (value === undefined || value === null) return "";
    return key.endsWith("Json") ? String(value) : escapeJsonString(value);
    });
}

function parseTemplateJson(template, context, fallback) {
  const rendered = renderTemplate(template, context).trim();
  if (!rendered) return fallback;
  return reviveTemplateJson(JSON.parse(rendered));
}

function reviveTemplateJson(value) {
  if (Array.isArray(value)) return value.map(reviveTemplateJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, reviveTemplateJson(item)]));
  }
  if (typeof value === "string" && /^[\[{]/.test(value.trim())) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function extractServerSentEventText(event) {
  if (typeof event?.delta === "string") return event.delta;
  if (typeof event?.delta?.text === "string") return event.delta.text;
  if (typeof event?.text === "string") return event.text;
  if (typeof event?.output_text === "string") return event.output_text;
  return extractTextFromAnyResponse(event);
}

function parseServerSentEvents(text) {
  let outputText = "";
  const events = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const event = JSON.parse(payload);
      events.push(event);
      outputText += extractServerSentEventText(event);
    } catch {
      outputText += payload;
    }
  }
  return { output_text: outputText, events };
}

async function readAiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    return parseServerSentEvents(await response.text());
  }
  return response.json();
}

async function sendAiRequest({ url, method = "POST", headers, body }) {
  const response = await fetch(url, {
    method,
    headers,
    ...(method === "GET" || method === "HEAD" ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI request failed: ${response.status} ${errorText.slice(0, 300)}`);
  }

  return readAiResponse(response);
}

function createCodexRelayTools() {
  return [
    {
      type: "function",
      name: "shell_command",
      description: "Placeholder local command tool for Codex-compatible relay validation. JARVIS does not execute tool calls from this channel.",
      strict: false,
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Command text.",
          },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  ];
}

function createCodexClientMetadata(context) {
  return {
    "x-codex-turn-metadata": context.metadataJson,
    session_id: context.sessionId,
    thread_id: context.sessionId,
    "x-codex-window-id": context.windowId,
    "x-codex-installation-id": context.sessionId,
    turn_id: context.turnId,
  };
}

export async function testAiConnection(configOverride = {}) {
  const config = {
    ...(await getAiConfig()),
    ...configOverride,
  };
  const endpoint = normalizeEndpoint(config.endpoint);

  if (!endpoint) {
    return { ok: false, message: "AI endpoint is empty" };
  }

  if (config.provider === "ollama" || endpoint.includes("11434")) {
    const healthUrl = endpoint.replace(/\/v1$/, "/api/tags");
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
    return {
      ok: response.ok,
      status: response.status,
      provider: config.provider,
      endpoint,
    };
  }

  return {
    ok: true,
    provider: config.provider,
    endpoint,
    message: "Endpoint stored. Remote provider auth is checked during chat requests.",
  };
}

export async function chatWithAi({ messages, configOverride = {} }) {
  const config = {
    ...(await getAiConfig()),
    ...configOverride,
  };
  const endpoint = normalizeEndpoint(config.endpoint);
  const configuredApiKey = String(config.apiKey || "").trim();
  const apiKey = configuredApiKey || process.env.JARVIS_AI_API_KEY || process.env.OPENAI_API_KEY || "";
  const providerMeta = aiProviders[config.provider] || aiProviders.custom;
  const requestFormat = config.requestFormat || providerMeta.requestFormat || "openai-compatible";

  if (!endpoint) {
    throw new Error("AI endpoint is empty");
  }

  const context = createTemplateContext({ config, messages, apiKey });
  const resultFrom = (data) => ({
    text: extractTextFromAnyResponse(data, config.responsePath),
    raw: data,
    provider: config.provider,
    model: config.model,
  });

  if (requestFormat === "custom-template") {
    const method = String(config.requestMethod || "POST").toUpperCase();
    const url = joinEndpointPath(endpoint, renderTemplate(config.requestPath || "/responses", context));
    const headers = {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      ...parseTemplateJson(config.headersTemplate, context, {}),
    };
    const body = parseTemplateJson(
      config.bodyTemplate,
      context,
      {
        model: config.model,
        instructions: jarvisInstructions,
        input: toResponsesInput(messages),
        temperature: Number(config.temperature ?? 0.4),
      },
    );
    return resultFrom(await sendAiRequest({ url, method, headers, body }));
  }

  if (requestFormat === "openai-responses") {
    const data = await sendAiRequest({
      url: getConfiguredRequestUrl(endpoint, config, requestFormat, context),
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: {
        model: config.model,
        instructions: jarvisInstructions,
        input: toResponsesInput(messages),
        temperature: Number(config.temperature ?? 0.4),
      },
    });
    return resultFrom(data);
  }

  if (requestFormat === "openai-completions") {
    const data = await sendAiRequest({
      url: getConfiguredRequestUrl(endpoint, config, requestFormat, context),
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: {
        model: config.model,
        prompt: toLegacyPrompt(messages),
        temperature: Number(config.temperature ?? 0.4),
        max_tokens: 1200,
      },
    });
    return resultFrom(data);
  }

  if (requestFormat === "claude-compatible" || requestFormat === "claude-bearer-compatible") {
    const anthropicKey = configuredApiKey || process.env.JARVIS_AI_API_KEY || process.env.ANTHROPIC_API_KEY || "";
    const data = await sendAiRequest({
      url: getConfiguredRequestUrl(endpoint, config, requestFormat, context),
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(anthropicKey && requestFormat === "claude-bearer-compatible"
          ? { authorization: `Bearer ${anthropicKey}` }
          : {}),
        ...(anthropicKey && requestFormat === "claude-compatible" ? { "x-api-key": anthropicKey } : {}),
      },
      body: {
        model: config.model,
        temperature: Number(config.temperature ?? 0.4),
        max_tokens: 1200,
        system: jarvisInstructions,
        messages: toClaudeMessages(messages),
      },
    });
    return resultFrom(data);
  }

  if (requestFormat === "gemini-compatible") {
    const geminiKey =
      configuredApiKey || process.env.JARVIS_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    const data = await sendAiRequest({
      url: getConfiguredRequestUrl(endpoint, config, requestFormat, context),
      headers: {
        "content-type": "application/json",
        ...(geminiKey ? { "x-goog-api-key": geminiKey } : {}),
      },
      body: {
        systemInstruction: {
          parts: [{ text: jarvisInstructions }],
        },
        contents: toGeminiContents(messages),
        generationConfig: {
          temperature: Number(config.temperature ?? 0.4),
        },
      },
    });
    return resultFrom(data);
  }

  if (requestFormat === "codex-responses") {
    const data = await sendAiRequest({
      url: getConfiguredRequestUrl(endpoint, config, requestFormat, context),
      headers: {
        accept: "text/event-stream",
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        originator: "codex-tui",
        "user-agent": "codex-tui/0.141.0 (Windows 10.0.26200; x86_64) unknown (codex-tui; 0.141.0)",
        "x-codex-beta-features": "remote_compaction_v2",
        "x-codex-window-id": context.windowId,
        "x-codex-turn-metadata": context.metadataJson,
        "x-client-request-id": context.sessionId,
        "session-id": context.sessionId,
        "thread-id": context.sessionId,
      },
      body: {
        model: config.model,
        instructions: jarvisInstructions,
        input: toCodexResponsesInput(messages),
        stream: true,
        store: false,
        include: ["reasoning.encrypted_content"],
        reasoning: { effort: "medium" },
        tools: createCodexRelayTools(),
        tool_choice: "auto",
        parallel_tool_calls: true,
        prompt_cache_key: context.sessionId,
        text: { verbosity: "low" },
        client_metadata: createCodexClientMetadata(context),
      },
    });
    return resultFrom(data);
  }

  const data = await sendAiRequest({
    url: getConfiguredRequestUrl(endpoint, config, "openai-compatible", context),
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: {
      model: config.model,
      temperature: Number(config.temperature ?? 0.4),
      messages: [
        {
          role: "system",
          content: jarvisInstructions,
        },
        ...toOpenAiMessages(messages),
      ],
    },
  });
  return resultFrom(data);
}
