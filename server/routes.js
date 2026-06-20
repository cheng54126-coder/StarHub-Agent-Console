import { readBody, sendError, sendJson, serveStatic } from "./http-utils.js";
import {
  addChatMessage,
  clearChatHistory,
  getAiConfig,
  getChatHistory,
  getMcpConfig,
  getRecentEvents,
  getPublicAiConfig,
  getRuntimeState,
  replaceChatHistory,
  resetAiConfig,
  saveAiConfig,
  saveMcpConfig,
  saveRuntimeState,
} from "./store.js";
import { chatWithAi, getAiProviders, testAiConnection } from "./ai.js";
import { getApplyWorkbench, openApplyJob, searchApplyJobs, updateApplyJobStatus } from "./apply-workbench.js";
import { answerBossMcpQuery } from "./boss-mcp-chat.js";
import { getMcpStatus, runBossTool, syncConfiguredMcpTools } from "./mcp.js";
import { runCommand } from "./commands.js";
import { saveScreenCapture, saveScreenPermission } from "./screen.js";
import { answerWebSearch, getSearchProviders } from "./web-search.js";

export async function handleRequest(req, res) {
  const url = new URL(req.url, "http://localhost");

  try {
    if (url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, service: "jarvis-backend", time: new Date().toISOString() });
      return;
    }

    if (url.pathname === "/api/state" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: await getRuntimeState() });
      return;
    }

    if (url.pathname === "/api/state" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await saveRuntimeState(body) });
      return;
    }

    if (url.pathname === "/api/events" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: await getRecentEvents(url.searchParams.get("limit") || 20) });
      return;
    }

    if (url.pathname === "/api/commands" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await runCommand(body) });
      return;
    }

    if (url.pathname === "/api/config/ai/providers" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: getAiProviders() });
      return;
    }

    if (url.pathname === "/api/screen/permission" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await saveScreenPermission(body.status, body.message) });
      return;
    }

    if (url.pathname === "/api/screen/capture" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await saveScreenCapture(body) });
      return;
    }

    if (url.pathname === "/api/web-search/providers" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: getSearchProviders() });
      return;
    }

    if (url.pathname === "/api/web-search" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await answerWebSearch(body) });
      return;
    }

    if (url.pathname === "/api/apply-workbench" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: await getApplyWorkbench() });
      return;
    }

    if (url.pathname === "/api/apply-workbench/search" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await searchApplyJobs(body) });
      return;
    }

    if (url.pathname === "/api/apply-workbench/status" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await updateApplyJobStatus(body.id, body.status) });
      return;
    }

    if (url.pathname === "/api/apply-workbench/open" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await openApplyJob(body.id) });
      return;
    }

    if (url.pathname === "/api/config/ai" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: await getPublicAiConfig() });
      return;
    }

    if (url.pathname === "/api/config/ai" && req.method === "POST") {
      const body = await readBody(req);
      await saveAiConfig(body);
      sendJson(res, 200, { ok: true, data: await getPublicAiConfig() });
      return;
    }

    if (url.pathname === "/api/config/ai/reset" && req.method === "POST") {
      await resetAiConfig();
      sendJson(res, 200, { ok: true, data: await getPublicAiConfig() });
      return;
    }

    if (url.pathname === "/api/config/mcp" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: await getMcpConfig() });
      return;
    }

    if (url.pathname === "/api/config/mcp" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await saveMcpConfig(body) });
      return;
    }

    if (url.pathname === "/api/ai/test" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await testAiConnection(body) });
      return;
    }

    if (url.pathname === "/api/chat" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: await getChatHistory() });
      return;
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await addChatMessage(body) });
      return;
    }

    if (url.pathname === "/api/chat" && req.method === "PUT") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await replaceChatHistory(body.messages) });
      return;
    }

    if (url.pathname === "/api/chat" && req.method === "DELETE") {
      sendJson(res, 200, { ok: true, data: await clearChatHistory() });
      return;
    }

    if (url.pathname === "/api/chat/complete" && req.method === "POST") {
      const body = await readBody(req);
      const userMessage = await addChatMessage({ role: "user", text: body.text });
      const bossMcpAnswer = await answerBossMcpQuery(body.text);
      if (bossMcpAnswer?.handled) {
        const assistantMessage = await addChatMessage({ role: "jarvis", text: bossMcpAnswer.text });
        sendJson(res, 200, {
          ok: true,
          data: {
            userMessage,
            assistantMessage,
            model: bossMcpAnswer.tool,
            provider: "boss-mcp",
            tool: bossMcpAnswer.tool,
            toolArguments: bossMcpAnswer.args,
          },
        });
        return;
      }
      const history = await getChatHistory();
      const aiResult = await chatWithAi({ messages: history, configOverride: body.config || {} });
      const assistantMessage = await addChatMessage({ role: "jarvis", text: aiResult.text });
      sendJson(res, 200, {
        ok: true,
        data: {
          userMessage,
          assistantMessage,
          model: aiResult.model,
          provider: aiResult.provider,
        },
      });
      return;
    }

    if (url.pathname === "/api/mcp/status" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: await getMcpStatus() });
      return;
    }

    if (url.pathname === "/api/mcp/tools" && req.method === "GET") {
      sendJson(res, 200, { ok: true, data: await syncConfiguredMcpTools() });
      return;
    }

    if (url.pathname === "/api/mcp/boss" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: await runBossTool(body.action, body.payload) });
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      sendError(res, 404, "API route not found");
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendError(res, 500, error.message || "Internal server error");
  }
}
