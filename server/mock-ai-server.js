import http from "node:http";

const port = Number(process.env.MOCK_AI_PORT || 18080);

const server = http.createServer(async (req, res) => {
  if (req.url === "/v1/chat/completions" && req.method === "POST") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const last = body.messages?.at(-1)?.content || "";
    const content = last.includes("搜索结果")
      ? "搜索总结：已根据网页结果整理。依据：1. 搜索结果包含相关标题；2. 摘要提供了上下文。来源：Open Jarvis。"
      : `贾维斯回复：${last}`;
    const payload = {
      choices: [{ message: { role: "assistant", content } }],
    };
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
    return;
  }

  if (req.url === "/api/tags" || req.url === "/v1/models") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ models: [{ name: "mock-jarvis" }] }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mock-ai listening on http://127.0.0.1:${port}`);
});
