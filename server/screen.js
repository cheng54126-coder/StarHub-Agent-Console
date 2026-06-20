import { appendEvent, saveRuntimeState } from "./store.js";

export async function saveScreenCapture(capture = {}) {
  const record = {
    id: capture.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    source: capture.source || "browser-display-media",
    width: Number(capture.width || 0),
    height: Number(capture.height || 0),
    mimeType: capture.mimeType || "image/png",
    previewDataUrl: String(capture.previewDataUrl || "").slice(0, 250_000),
    capturedAt: new Date().toISOString(),
  };

  if (!record.width || !record.height) {
    throw new Error("Screen capture dimensions are required");
  }

  await saveRuntimeState({
    screen: "Granted",
    subtitleState: "Screen",
    subtitleText: "屏幕读取权限已授权，我已收到一次屏幕预览。",
  });
  await appendEvent("screen.capture.saved", {
    message: `Screen captured: ${record.width}x${record.height}.`,
    width: record.width,
    height: record.height,
    source: record.source,
  });

  return record;
}

export async function saveScreenPermission(status, message) {
  const safeStatus = ["Pending", "Granted", "Blocked", "Unavailable"].includes(status) ? status : "Pending";
  await appendEvent("screen.permission.updated", {
    message: message || `Screen permission: ${safeStatus}.`,
    status: safeStatus,
  });
  return saveRuntimeState({
    screen: safeStatus,
    subtitleState: "Screen",
    subtitleText: message || `屏幕读取状态：${safeStatus}`,
  });
}
