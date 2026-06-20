import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function loadStoreWithTempData() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jarvis-state-"));
  process.env.JARVIS_DATA_DIR = tempDir;
  const suffix = `?case=${Date.now()}-${Math.random()}`;
  const store = await import(`./store.js${suffix}`);
  await store.ensureStore();
  return { tempDir, store };
}

test("runtime state is persisted and merged", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  try {
    const initial = await store.getRuntimeState();
    assert.equal(initial.visualTheme, "aurora");
    assert.equal(initial.agentMode, "standby");
    assert.equal(initial.awake, false);

    const updated = await store.saveRuntimeState({ visualTheme: "ember", agentMode: "operator", awake: true });
    assert.equal(updated.visualTheme, "ember");
    assert.equal(updated.agentMode, "operator");
    assert.equal(updated.awake, true);

    const reloaded = await store.getRuntimeState();
    assert.equal(reloaded.visualTheme, "ember");
    assert.equal(reloaded.agentMode, "operator");
    assert.equal(reloaded.awake, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("events are returned newest-first with a limit", async () => {
  const { tempDir, store } = await loadStoreWithTempData();
  try {
    await store.appendEvent("first", { index: 1 });
    await store.appendEvent("second", { index: 2 });
    await store.appendEvent("third", { index: 3 });

    const events = await store.getRecentEvents(2);
    assert.equal(events.length, 2);
    assert.equal(events[0].type, "third");
    assert.equal(events[1].type, "second");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
