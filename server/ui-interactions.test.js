import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { projectRoot } from "./config.js";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function runEdgeHarness(testName, script) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jarvis-ui-"));
  const marker = `${testName}-${Date.now()}-${Math.random()}`;
  const harnessName = `__harness-${marker.replace(/[^a-z0-9-]/gi, "")}.html`;
  const htmlFile = path.join(projectRoot, harnessName);
  const previousState = await fetch("http://127.0.0.1:8787/api/state")
    .then((response) => response.json())
    .then((payload) => payload.data || {})
    .catch(() => ({}));
  const restoredState = {
    subtitleState: previousState.subtitleState === "Harness" ? "Standby" : previousState.subtitleState || "Standby",
    subtitleText: previousState.subtitleState === "Harness" ? "" : previousState.subtitleText || "",
  };
  await writeFile(
    htmlFile,
    `<!doctype html><meta charset="utf-8"><script type="module">
const marker = ${JSON.stringify(marker)};
async function finish(result) {
  await fetch("/api/state", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subtitleState: "Harness", subtitleText: JSON.stringify({ marker, ...result }) })
  });
  document.body.textContent = JSON.stringify(result);
}
try {
  ${script}
} catch (error) {
  await finish({ ok: false, testName: ${JSON.stringify(testName)}, error: error.message, stack: error.stack });
}
</script>`,
    "utf8",
  );

  const edge = spawn(edgePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--user-data-dir=" + path.join(dir, "profile"),
    `http://127.0.0.1:8787/${harnessName}`,
  ], { stdio: "ignore" });

  let result = null;
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const response = await fetch("http://127.0.0.1:8787/api/state");
    const payload = await response.json();
    try {
      const parsed = JSON.parse(payload.data.subtitleText);
      if (parsed.marker === marker) {
        result = parsed;
        break;
      }
    } catch {
      // keep polling until the harness writes its JSON payload
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  edge.kill();
  await once(edge, "exit").catch(() => {});
  await rm(htmlFile, { force: true });
  await rm(dir, { recursive: true, force: true });
  await fetch("http://127.0.0.1:8787/api/state", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(restoredState),
  }).catch(() => {});
  if (!result) {
    throw new Error(`Harness did not report result for ${testName}`);
  }
  return result;
}

test("browser supports mocked microphone and screen interaction contracts", async () => {
  const result = await runEdgeHarness("permissions", `
    const stream = new MediaStream();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async (constraints) => ({ ok: true, constraints }),
      getDisplayMedia: async (constraints) => ({ ok: true, constraints }),
    }});
    await finish({
      ok: true,
      microphone: !!navigator.mediaDevices.getUserMedia,
      screen: !!navigator.mediaDevices.getDisplayMedia,
      stream: !!stream,
    });
  `);

  assert.equal(result.ok, true);
  assert.equal(result.microphone, true);
  assert.equal(result.screen, true);
});

test("AI request format control is present in served page", async () => {
  const html = await (await fetch("http://127.0.0.1:8787/")).text();
  assert.match(html, /id="aiRequestFormat"/);
  assert.match(html, /openai-compatible/);
  assert.match(html, /openai-responses/);
  assert.match(html, /openai-completions/);
  assert.match(html, /claude-compatible/);
  assert.match(html, /claude-bearer-compatible/);
  assert.match(html, /gemini-compatible/);
  assert.match(html, /codex-responses/);
  assert.match(html, /custom-template/);
  assert.match(html, /id="aiApiKey"/);
  assert.match(html, /id="aiKeyState"/);
  assert.match(html, /id="aiRequestMethod"/);
  assert.match(html, /id="aiRequestPath"/);
  assert.match(html, /id="aiHeadersTemplate"/);
  assert.match(html, /id="aiBodyTemplate"/);
  assert.match(html, /id="aiResponsePath"/);
  assert.match(html, /id="askForm"/);
  assert.match(html, /id="voiceAskButton"/);
  assert.match(html, /id="aiVoiceProfile"/);
  assert.match(html, /value="jarvis"/);
  assert.match(html, /value="calm"/);
  assert.match(html, /value="deep"/);
  assert.match(html, /value="bright"/);
  assert.match(html, /value="fast"/);
});

test("AI config popup exposes an interactive API key field", async () => {
  const result = await runEdgeHarness("ai-config-popup", `
    const iframe = document.createElement("iframe");
    iframe.style.width = "1280px";
    iframe.style.height = "820px";
    iframe.style.border = "0";
    iframe.src = "/";
    document.body.appendChild(iframe);
    await new Promise((resolve) => iframe.addEventListener("load", resolve, { once: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const doc = iframe.contentDocument;
    const module = doc.getElementById("ai-config");
    module.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: iframe.contentWindow }));
    await new Promise((resolve) => setTimeout(resolve, 250));

    const apiKey = doc.getElementById("aiApiKey");
    const rect = apiKey.getBoundingClientRect();
    const hit = doc.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    await finish({
      ok: true,
      isOpen: module.classList.contains("is-open"),
      apiKeyVisible: rect.width > 0 && rect.height > 0,
      hitId: hit?.id || "",
      hitClass: hit?.className || "",
      hitTag: hit?.tagName || "",
      bodyClass: doc.body.className,
    });
  `);

  assert.equal(result.ok, true);
  assert.equal(result.isOpen, true);
  assert.equal(result.apiKeyVisible, true);
  assert.equal(result.hitId, "aiApiKey");
});

test("module popup keeps the dock stable and allows switching modules", async () => {
  const result = await runEdgeHarness("module-switching", `
    const iframe = document.createElement("iframe");
    iframe.style.width = "1280px";
    iframe.style.height = "820px";
    iframe.style.border = "0";
    iframe.src = "/";
    document.body.appendChild(iframe);
    await new Promise((resolve) => iframe.addEventListener("load", resolve, { once: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const doc = iframe.contentDocument;
    const rail = doc.querySelector(".module-rail");
    const permissions = doc.getElementById("permissions");
    const aiConfig = doc.getElementById("ai-config");
    const beforeHeight = rail.getBoundingClientRect().height;

    permissions.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: iframe.contentWindow }));
    await new Promise((resolve) => setTimeout(resolve, 250));
    const afterHeight = rail.getBoundingClientRect().height;

    const aiRect = aiConfig.getBoundingClientRect();
    const hit = doc.elementFromPoint(aiRect.left + aiRect.width / 2, aiRect.top + aiRect.height / 2);
    hit?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: iframe.contentWindow }));
    await new Promise((resolve) => setTimeout(resolve, 250));

    await finish({
      ok: true,
      beforeHeight,
      afterHeight,
      hitId: hit?.id || "",
      hitClass: hit?.className || "",
      permissionsOpen: permissions.classList.contains("is-open"),
      aiOpen: aiConfig.classList.contains("is-open"),
    });
  `);

  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.afterHeight - result.beforeHeight) < 2);
  assert.notEqual(result.hitId, "modalBackdrop");
  assert.equal(result.permissionsOpen, false);
  assert.equal(result.aiOpen, true);
});

test("all module popups can be switched from the dock on desktop and narrow layouts", async () => {
  async function runSwitchScenario(width, height) {
    return runEdgeHarness(`module-switch-all-${width}`, `
      const iframe = document.createElement("iframe");
      iframe.style.width = ${JSON.stringify(`${width}px`)};
      iframe.style.height = ${JSON.stringify(`${height}px`)};
      iframe.style.border = "0";
      iframe.src = "/";
      document.body.appendChild(iframe);
      await new Promise((resolve) => iframe.addEventListener("load", resolve, { once: true }));
      await new Promise((resolve) => setTimeout(resolve, 500));

      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      const selectors = [".controls-module", "#ai-config", "#mcp", "#permissions"];
      const rail = doc.querySelector(".module-rail");
      const initialRailSize = rail.getBoundingClientRect().height;
      const steps = [];

      for (const selector of selectors) {
        const target = doc.querySelector(selector);
        const rect = target.getBoundingClientRect();
        const hit = doc.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        hit?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: win }));
        await new Promise((resolve) => setTimeout(resolve, 240));

        const popupRect = target.getBoundingClientRect();
        doc.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 18, clientY: 18, view: win }));
        rail.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 44, clientY: 44, view: win }));
        await new Promise((resolve) => setTimeout(resolve, 80));
        const afterMoveRect = target.getBoundingClientRect();
        steps.push({
          selector,
          hitId: hit?.id || "",
          hitClass: hit?.className || "",
          isOpen: target.classList.contains("is-open"),
          openCount: doc.querySelectorAll(".module.is-open").length,
          parentIsBody: target.parentNode === doc.body,
          railSizeDelta: Math.abs(rail.getBoundingClientRect().height - initialRailSize),
          moveDelta:
            Math.abs(afterMoveRect.top - popupRect.top) +
            Math.abs(afterMoveRect.left - popupRect.left) +
            Math.abs(afterMoveRect.bottom - popupRect.bottom) +
            Math.abs(afterMoveRect.right - popupRect.right),
          popupTop: popupRect.top,
          popupLeft: popupRect.left,
          popupBottom: popupRect.bottom,
          popupRight: popupRect.right,
          viewportWidth: win.innerWidth,
          viewportHeight: win.innerHeight,
        });
      }

      doc.querySelector(".module.is-open .module-close")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, view: win })
      );
      await new Promise((resolve) => setTimeout(resolve, 120));

      await finish({
        ok: true,
        width: ${JSON.stringify(width)},
        steps,
        openAfterClose: doc.querySelectorAll(".module.is-open").length,
      });
    `);
  }

  for (const result of [await runSwitchScenario(1280, 820), await runSwitchScenario(760, 820)]) {
    assert.equal(result.ok, true);
    for (const step of result.steps) {
      assert.notEqual(step.hitId, "modalBackdrop", `${result.width} ${step.selector} was covered by backdrop`);
      assert.equal(step.isOpen, true, `${result.width} ${step.selector} did not open`);
      assert.equal(step.openCount, 1, `${result.width} ${step.selector} left multiple modules open`);
      assert.equal(step.parentIsBody, false, `${result.width} ${step.selector} should stay in the dock`);
      assert.ok(step.railSizeDelta < 3, `${result.width} ${step.selector} shifted dock by ${step.railSizeDelta}`);
      assert.ok(step.moveDelta < 1, `${result.width} ${step.selector} moved on mousemove by ${step.moveDelta}`);
      assert.ok(step.popupTop >= 0 && step.popupLeft >= 0, `${result.width} ${step.selector} left viewport`);
      assert.ok(
        step.popupBottom <= step.viewportHeight + 1 && step.popupRight <= step.viewportWidth + 1,
        `${result.width} ${step.selector} overflowed viewport`,
      );
    }
    assert.equal(result.openAfterClose, 0);
  }
});

test("theme controls still work after opening permissions", async () => {
  const result = await runEdgeHarness("theme-after-permissions", `
    const iframe = document.createElement("iframe");
    iframe.style.width = "1280px";
    iframe.style.height = "820px";
    iframe.style.border = "0";
    iframe.src = "/";
    document.body.appendChild(iframe);
    await new Promise((resolve) => iframe.addEventListener("load", resolve, { once: true }));
    await new Promise((resolve) => setTimeout(resolve, 500));

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    const permissions = doc.getElementById("permissions");
    const controls = doc.querySelector(".controls-module");

    permissions.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: win }));
    await new Promise((resolve) => setTimeout(resolve, 180));

    const controlsRect = controls.getBoundingClientRect();
    const controlsHit = doc.elementFromPoint(controlsRect.left + controlsRect.width / 2, controlsRect.top + controlsRect.height / 2);
    controlsHit?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: win }));
    await new Promise((resolve) => setTimeout(resolve, 180));

    const ember = doc.querySelector('[data-theme="ember"]');
    const emberRect = ember.getBoundingClientRect();
    const themeHit = doc.elementFromPoint(emberRect.left + emberRect.width / 2, emberRect.top + emberRect.height / 2);
    const themeButton = themeHit?.closest?.("[data-theme]");
    themeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: win }));
    await new Promise((resolve) => setTimeout(resolve, 250));

    await finish({
      ok: true,
      controlsHitClass: controlsHit?.className || "",
      themeHitTheme: themeButton?.dataset?.theme || "",
      controlsOpen: controls.classList.contains("is-open"),
      permissionsOpen: permissions.classList.contains("is-open"),
      theme: doc.body.dataset.theme,
    });
  `);

  assert.equal(result.ok, true);
  assert.equal(result.controlsOpen, true);
  assert.equal(result.permissionsOpen, false);
  assert.equal(result.themeHitTheme, "ember");
  assert.equal(result.theme, "ember");
});

test("web search uses inline or voice input instead of a prompt window", async () => {
  const script = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.doesNotMatch(script, /window\.prompt/);
});

test("MCP sync requests backend tools and renders returned tool chips", async () => {
  const script = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(script, /api\("\/api\/mcp\/tools"\)/);
  assert.match(script, /function renderMcpTools/);
  assert.match(script, /mcpToolChips/);
});

test("MCP config UI exposes editable server settings", async () => {
  const html = await (await fetch("http://127.0.0.1:8787/")).text();
  const script = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(html, /id="mcpServerList"/);
  assert.match(html, /id="mcpServerName"/);
  assert.match(html, /id="mcpServerCommand"/);
  assert.match(html, /id="mcpServerArgs"/);
  assert.match(html, /id="mcpServerEnv"/);
  assert.match(script, /\/api\/config\/mcp/);
  assert.match(script, /function loadMcpConfig/);
  assert.match(script, /function saveMcpConfig/);
});

test("voice output resumes speech synthesis and chunks long replies", async () => {
  const script = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(script, /const synth = window\.speechSynthesis/);
  assert.match(script, /synth\.resume\(\)/);
  assert.match(script, /chunkSpeechText/);
  assert.match(script, /speechSynthesis\.getVoices\(\)/);
  assert.match(script, /utterance\.rate = profile\.rate/);
  assert.match(script, /utterance\.pitch = profile\.pitch/);
});

test("voice output is primed from user gestures before async actions", async () => {
  const script = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(script, /wakeButton\.addEventListener\("click",\s*\(\)\s*=>\s*{\s*primeSpeechOutput\(\);/s);
  assert.match(script, /commandButtons\.forEach[\s\S]*button\.addEventListener\("click",\s*async\s*\(\)\s*=>\s*{\s*primeSpeechOutput\(\);/);
  assert.match(script, /askForm\.addEventListener\("submit",\s*\(event\)\s*=>\s*{\s*primeSpeechOutput\(\);/s);
  assert.match(script, /voiceAskButton\.addEventListener\("click",\s*\(\)\s*=>\s*{\s*primeSpeechOutput\(\);/s);
});

test("apply workbench UI exposes search, job ids, and manual delivery actions", async () => {
  const html = await (await fetch("http://127.0.0.1:8787/")).text();
  const script = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(html, /id="applyWorkbench"/);
  assert.match(html, /id="applyKeyword"/);
  assert.match(html, /id="applyJobList"/);
  assert.match(html, /id="applyGreeting"/);
  assert.match(script, /\/api\/apply-workbench\/search/);
  assert.match(script, /\/api\/apply-workbench\/status/);
  assert.match(script, /\/api\/apply-workbench\/open/);
  assert.match(script, /function renderApplyJobs/);
  assert.match(script, /function openSelectedApplyJob/);
  assert.doesNotMatch(script, /window\.open\(selected\.detailUrl/);
  assert.match(script, /navigator\.clipboard\.writeText/);
});

test("served frontend assets are not cached while the local console is changing", async () => {
  const scriptResponse = await fetch("http://127.0.0.1:8787/app.js");
  const styleResponse = await fetch("http://127.0.0.1:8787/styles.css");

  assert.equal(scriptResponse.headers.get("cache-control"), "no-store");
  assert.equal(styleResponse.headers.get("cache-control"), "no-store");
});

test("apply workbench shows a loading state while searching", async () => {
  const script = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(script, /applySearchLoading/);
  assert.match(script, /正在搜索岗位/);
  assert.match(script, /setApplySearchLoading/);
  assert.match(script, /data-apply-busy/);
});

test("apply workbench supports boss-style continuous handling", async () => {
  const html = await (await fetch("http://127.0.0.1:8787/")).text();
  const script = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(html, /id="applyProgress"/);
  assert.match(html, /id="applyDetailPanel"/);
  assert.match(html, /data-apply-action="prepare"/);
  assert.match(html, /打开并复制/);
  assert.match(script, /function renderApplyDetail/);
  assert.match(script, /function prepareSelectedApplyJob/);
  assert.match(script, /function handleApplyShortcut/);
  assert.match(script, /keydown/);
});

test("apply workbench keeps edited criteria while search is loading", async () => {
  const result = await runEdgeHarness("apply-criteria-loading", `
    const sourceHtml = await fetch("/").then((response) => response.text());
    const injectedHtml = sourceHtml.replace(
      '<script type="module" src="./app.js"><' + '/script>',
      '<script>' +
      'const applyCalls = [];' +
      'let resolveSearch;' +
      'const pendingSearch = new Promise((resolve) => { resolveSearch = resolve; });' +
      'const jsonResponse = (data) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });' +
      'window.__applyCalls = applyCalls;' +
      'window.__resolveApplySearch = resolveSearch;' +
      'window.fetch = async (input, init = {}) => {' +
      '  const url = String(input);' +
      '  if (url.endsWith("/api/config/ai/providers")) return jsonResponse({ ok: true, data: { ollama: { endpoint: "http://127.0.0.1:11434/v1", model: "qwen2.5:7b", requestFormat: "openai-compatible", requestMethod: "POST", requestPath: "/chat/completions", responsePath: "choices[0].message.content", badge: "Local" } } });' +
      '  if (url.endsWith("/api/config/ai")) return jsonResponse({ ok: true, data: { provider: "ollama", endpoint: "http://127.0.0.1:11434/v1", model: "qwen2.5:7b", requestFormat: "openai-compatible", voiceInput: true, voiceOutput: true, voiceProfile: "jarvis" } });' +
      '  if (url.endsWith("/api/config/mcp")) return jsonResponse({ ok: true, data: { servers: [] } });' +
      '  if (url.endsWith("/api/apply-workbench/search")) {' +
      '    const body = JSON.parse(init.body || "{}");' +
      '    applyCalls.push(body);' +
      '    await pendingSearch;' +
      '    return jsonResponse({ ok: true, data: { criteria: body, jobs: [], updatedAt: "2026-06-20T00:00:00.000Z" } });' +
      '  }' +
      '  if (url.endsWith("/api/apply-workbench")) return jsonResponse({ ok: true, data: { criteria: { query: "旧岗位", city: "旧城市", salary: "1-2K", count: 10 }, jobs: [], updatedAt: null } });' +
      '  if (url.endsWith("/api/state")) return jsonResponse({ ok: true, data: {} });' +
      '  if (url.endsWith("/api/chat")) return jsonResponse({ ok: true, data: [] });' +
      '  if (url.includes("/api/events")) return jsonResponse({ ok: true, data: [] });' +
      '  return jsonResponse({ ok: true, data: {} });' +
      '};' +
      '<' + '/script><script type="module" src="./app.js"><' + '/script>'
    );

    const iframe = document.createElement("iframe");
    iframe.style.width = "1280px";
    iframe.style.height = "820px";
    iframe.style.border = "0";
    const loaded = new Promise((resolve) => iframe.addEventListener("load", resolve, { once: true }));
    iframe.srcdoc = '<base href="http://127.0.0.1:8787/">' + injectedHtml;
    document.body.appendChild(iframe);
    await loaded;
    await new Promise((resolve) => setTimeout(resolve, 700));

    const doc = iframe.contentDocument;
    doc.getElementById("applyKeyword").value = "自动化测试";
    doc.getElementById("applyCity").value = "杭州";
    doc.getElementById("applySalary").value = "15-25K";
    doc.getElementById("applyCount").value = "6";
    doc.querySelector('[data-apply-action="search"]').dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: iframe.contentWindow })
    );
    await new Promise((resolve) => setTimeout(resolve, 120));

    const duringLoading = {
      query: doc.getElementById("applyKeyword").value,
      city: doc.getElementById("applyCity").value,
      salary: doc.getElementById("applySalary").value,
      count: doc.getElementById("applyCount").value,
    };
    iframe.contentWindow.__resolveApplySearch();
    await new Promise((resolve) => setTimeout(resolve, 240));

    await finish({
      ok: true,
      call: iframe.contentWindow.__applyCalls[0],
      duringLoading,
      afterSearch: {
        query: doc.getElementById("applyKeyword").value,
        city: doc.getElementById("applyCity").value,
        salary: doc.getElementById("applySalary").value,
        count: doc.getElementById("applyCount").value,
      },
    });
  `);

  assert.equal(result.ok, true);
  assert.deepEqual(result.call, { query: "自动化测试", city: "杭州", salary: "15-25K", count: 6 });
  assert.deepEqual(result.duringLoading, { query: "自动化测试", city: "杭州", salary: "15-25K", count: "6" });
  assert.deepEqual(result.afterSearch, { query: "自动化测试", city: "杭州", salary: "15-25K", count: "6" });
});
