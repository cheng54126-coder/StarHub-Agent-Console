import http from "node:http";
import { serverConfig } from "./config.js";
import { handleRequest } from "./routes.js";
import { ensureStore } from "./store.js";

await ensureStore();

const server = http.createServer((req, res) => {
  req.setTimeout(serverConfig.requestTimeoutMs);
  handleRequest(req, res);
});

server.listen(serverConfig.port, serverConfig.host, () => {
  console.log(`JARVIS backend listening on http://${serverConfig.host}:${serverConfig.port}`);
});
