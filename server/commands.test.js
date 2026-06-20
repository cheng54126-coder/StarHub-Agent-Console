import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function loadModulesWithTempData() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jarvis-command-"));
  process.env.JARVIS_DATA_DIR = tempDir;
  const suffix = `?case=${Date.now()}-${Math.random()}`;
  const store = await import(`./store.js${suffix}`);
  const commands = await import(`./commands.js${suffix}`);
  await store.ensureStore();
  return { tempDir, store, commands };
}

test("wake command updates runtime state and returns a subtitle", async () => {
  const { tempDir, store, commands } = await loadModulesWithTempData();
  try {
    const result = await commands.runCommand({ command: "wake" });

    assert.equal(result.state.awake, true);
    assert.equal(result.subtitle.state, "Online");
    assert.match(result.subtitle.text, /语音入口/);

    const state = await store.getRuntimeState();
    assert.equal(state.awake, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("theme and mode commands persist their selected values", async () => {
  const { tempDir, store, commands } = await loadModulesWithTempData();
  try {
    const theme = await commands.runCommand({ command: "set-theme", payload: { visualTheme: "frost" } });
    const mode = await commands.runCommand({ command: "set-mode", payload: { agentMode: "silent" } });

    assert.equal(theme.state.visualTheme, "frost");
    assert.equal(mode.state.agentMode, "silent");

    const state = await store.getRuntimeState();
    assert.equal(state.visualTheme, "frost");
    assert.equal(state.agentMode, "silent");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("unknown commands are rejected", async () => {
  const { tempDir, commands } = await loadModulesWithTempData();
  try {
    await assert.rejects(
      () => commands.runCommand({ command: "launch-missiles" }),
      /Unsupported command/,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
