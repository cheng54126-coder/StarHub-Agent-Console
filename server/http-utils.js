import fs from "node:fs/promises";
import path from "node:path";
import { publicDir, serverConfig } from "./config.js";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".ico", "image/x-icon"],
]);

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

export function sendError(res, status, message, details) {
  sendJson(res, status, {
    ok: false,
    error: {
      message,
      details,
    },
  });
}

export async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > serverConfig.maxBodyBytes) {
      throw new Error("Request body too large");
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolvedPath = path.resolve(publicDir, relativePath);

  if (!resolvedPath.startsWith(publicDir)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      sendError(res, 404, "Not found");
      return;
    }
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = mimeTypes.get(ext) || "application/octet-stream";
    const body = await fs.readFile(resolvedPath);
    res.writeHead(200, {
      "content-type": contentType,
      "content-length": body.length,
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    sendError(res, 404, "Not found");
  }
}
