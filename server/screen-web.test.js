import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function loadModulesWithTempData() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jarvis-screen-web-"));
  process.env.JARVIS_DATA_DIR = tempDir;
  const suffix = `?case=${Date.now()}-${Math.random()}`;
  const store = await import(`./store.js${suffix}`);
  const screen = await import(`./screen.js${suffix}`);
  const web = await import(`./web-search.js${suffix}`);
  await store.ensureStore();
  return { tempDir, store, screen, web };
}

test("screen capture metadata is saved and updates permission state", async () => {
  const { tempDir, store, screen } = await loadModulesWithTempData();
  try {
    const record = await screen.saveScreenCapture({
      source: "browser-display-media",
      width: 1920,
      height: 1080,
      mimeType: "image/png",
      previewDataUrl: "data:image/png;base64,abc123",
    });

    assert.equal(record.source, "browser-display-media");
    assert.equal(record.width, 1920);
    assert.equal(record.height, 1080);
    assert.equal(record.mimeType, "image/png");
    assert.ok(record.id);

    const state = await store.getRuntimeState();
    assert.equal(state.screen, "Granted");
    assert.equal(state.subtitleState, "Screen");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("web search creates an AI summarized answer", async () => {
  const { tempDir, web } = await loadModulesWithTempData();
  try {
    const task = await web.answerWebSearch(
      { query: "Jarvis self hosted voice AI", provider: "bing" },
      {
        search: async () => [
          {
            title: "Open Jarvis",
            url: "https://example.com/jarvis",
            snippet: "A self hosted voice AI assistant.",
          },
        ],
        summarize: async ({ query, results }) => `Summary for ${query}: ${results[0].title}`,
      },
    );

    assert.equal(task.query, "Jarvis self hosted voice AI");
    assert.equal(task.provider, "bing");
    assert.equal(task.status, "answered");
    assert.equal(task.answer, "Summary for Jarvis self hosted voice AI: Open Jarvis");
    assert.equal(task.results.length, 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("web search rejects empty queries", async () => {
  const { tempDir, web } = await loadModulesWithTempData();
  try {
    await assert.rejects(
      () => web.answerWebSearch({ query: "   " }),
      /Search query is required/,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
