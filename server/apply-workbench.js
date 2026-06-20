import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { callMcpTool } from "./mcp.js";
import { getApplyWorkbenchState, saveApplyWorkbenchState } from "./store.js";

const allowedStatuses = new Set(["pending", "opened", "applied", "skipped"]);

function clampCount(value) {
  const count = Number(value || 10);
  if (!Number.isFinite(count)) return 10;
  return Math.max(1, Math.min(30, Math.trunc(count)));
}

function normalizeCriteria(criteria = {}) {
  const query = String(criteria.query || criteria.keyword || "").trim();
  if (!query) throw new Error("Job keyword is required.");
  const city = String(criteria.city || "").trim();
  const salary = String(criteria.salary || "").trim();
  return {
    query,
    city,
    salary,
    count: clampCount(criteria.count),
  };
}

function extractJobs(data) {
  const candidates = [data?.data, data, data?.data?.data, data?.data?.zpData, data?.zpData].filter(Boolean);
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    for (const key of ["jobs", "items", "list", "data", "jobList"]) {
      if (Array.isArray(candidate?.[key])) return candidate[key];
    }
    if (Array.isArray(candidate?.zpData?.jobList)) return candidate.zpData.jobList;
  }
  return [];
}

function extractPagination(data) {
  const candidates = [data, data?.data, data?.data?.data, data?.data?.zpData, data?.zpData].filter(Boolean);
  for (const candidate of candidates) {
    for (const key of ["pagination", "page", "pageInfo", "pager"]) {
      if (candidate?.[key] && typeof candidate[key] === "object") return candidate[key];
    }
    if (
      candidate?.has_more != null ||
      candidate?.hasMore != null ||
      candidate?.has_next != null ||
      candidate?.hasNext != null
    ) {
      return candidate;
    }
  }
  return {};
}

function field(job, keys) {
  for (const key of keys) {
    if (job?.[key] != null && String(job[key]).trim()) return String(job[key]).trim();
  }
  return "";
}

function buildGreeting(job) {
  const title = job.title || "the role";
  const company = job.company || "your team";
  return `您好，我对 ${company} 的 ${title} 岗位很感兴趣。我的经历与岗位要求比较匹配，想进一步了解岗位职责和团队情况，方便的话期待沟通。`;
}

function buildDetailUrl(jobId, securityId, fallbackUrl, lid = "") {
  if (fallbackUrl) return fallbackUrl;
  if (jobId) {
    const query = new URLSearchParams();
    if (securityId) query.set("securityId", securityId);
    if (lid) query.set("lid", lid);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return `https://www.zhipin.com/job_detail/${encodeURIComponent(jobId)}.html${suffix}`;
  }
  return securityId ? `https://www.zhipin.com/job_detail/${encodeURIComponent(securityId)}.html` : "";
}

function assertBossDetailUrl(url) {
  let parsed;
  try {
    parsed = new URL(String(url || ""));
  } catch {
    throw new Error("Only Boss job detail URLs can be opened.");
  }

  const isBossHost = parsed.hostname === "www.zhipin.com" || parsed.hostname === "zhipin.com";
  const isJobDetail = /^\/job_detail\/[^/]+\.html$/.test(parsed.pathname);
  if (parsed.protocol !== "https:" || !isBossHost || !isJobDetail) {
    throw new Error("Only Boss job detail URLs can be opened.");
  }
  return parsed.toString();
}

function normalizeJob(job = {}, index = 0) {
  const title = field(job, ["title", "jobName", "job_name", "position", "name"]) || "Unknown role";
  const company = field(job, ["company", "companyName", "company_name", "brandName", "brand_name"]);
  const salary = field(job, ["salary", "salaryDesc", "salary_desc"]);
  const city = field(job, ["city", "location", "area", "jobArea"]);
  const jobId = field(job, ["jobId", "job_id", "encryptJobId", "id"]);
  const securityId = field(job, ["securityId", "security_id", "securityID"]);
  const detailUrl = buildDetailUrl(jobId, securityId, field(job, ["detailUrl", "url", "link", "href"]), field(job, ["lid"]));
  const normalized = {
    id: jobId || securityId || `job-${index + 1}`,
    title,
    company,
    salary,
    city,
    jobId,
    securityId,
    detailUrl,
    status: allowedStatuses.has(job.status) ? job.status : "pending",
    sourceIndex: index + 1,
    raw: job,
  };
  return {
    ...normalized,
    greeting: field(job, ["greeting", "message"]) || buildGreeting(normalized),
  };
}

function buildSearchArgs(criteria, page) {
  return {
    query: criteria.query,
    ...(criteria.city ? { city: criteria.city } : {}),
    ...(criteria.salary ? { salary: criteria.salary } : {}),
    page,
  };
}

function hasMoreSearchPages(payload, pageJobs = []) {
  const pagination = extractPagination(payload);
  for (const key of ["has_more", "hasMore", "has_next", "hasNext"]) {
    if (typeof pagination[key] === "boolean") return pagination[key];
  }

  const page = Number(pagination.page || pagination.pageNo || pagination.current || 0);
  const pageSize = Number(pagination.pageSize || pagination.size || pageJobs.length || 0);
  const total = Number(pagination.total || pagination.totalCount || 0);
  if (page > 0 && pageSize > 0 && total > 0) return page * pageSize < total;
  return pageJobs.length > 0;
}

function jobIdentity(job = {}, page, index) {
  return field(job, ["jobId", "job_id", "encryptJobId", "id", "securityId", "security_id"]) || `${page}-${index}`;
}

function browserCandidates() {
  return [
    process.env.JARVIS_BROWSER_PATH,
    "C:\\Users\\86156\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
}

export function openUrlInSystemBrowser(url, deps = {}) {
  const spawnProcess = deps.spawn || spawn;
  const fileExists = deps.existsSync || existsSync;
  const browserPath = browserCandidates().find((candidate) => fileExists(candidate));
  const command = browserPath || (process.platform === "win32" ? "rundll32.exe" : "xdg-open");
  const args = browserPath
    ? [url]
    : process.platform === "win32"
      ? ["url.dll,FileProtocolHandler", url]
      : [url];

  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.once("error", (error) => reject(new Error(`Unable to open browser: ${error.message}`)));
    child.once("spawn", () => {
      child.unref?.();
      resolve({ ok: true, command });
    });
  });
}

export async function getApplyWorkbench() {
  return getApplyWorkbenchState();
}

export async function searchApplyJobs(criteria = {}, deps = {}) {
  const normalizedCriteria = normalizeCriteria(criteria);
  const callTool = deps.callTool || callMcpTool;
  const rawJobs = [];
  const seen = new Set();
  const maxPages = Math.max(1, Math.min(10, Math.ceil(normalizedCriteria.count / 10) + 2));

  for (let page = 1; page <= maxPages && rawJobs.length < normalizedCriteria.count; page += 1) {
    const args = buildSearchArgs(normalizedCriteria, page);
    const toolResult = await callTool("boss_search", args, { timeoutMs: 35_000 });
    const payload = toolResult?.data;
    if (payload?.ok === false || toolResult?.isError) {
      const message = payload?.error?.message || payload?.message || payload?.text || "boss_search failed";
      throw new Error(message);
    }

    const pageJobs = extractJobs(payload);
    let added = 0;
    pageJobs.forEach((job, index) => {
      const id = jobIdentity(job, page, index);
      if (seen.has(id)) return;
      seen.add(id);
      rawJobs.push(job);
      added += 1;
    });
    if (rawJobs.length >= normalizedCriteria.count || added === 0 || !hasMoreSearchPages(payload, pageJobs)) break;
  }

  const jobs = rawJobs
    .slice(0, normalizedCriteria.count)
    .map(normalizeJob);
  return saveApplyWorkbenchState({
    criteria: normalizedCriteria,
    jobs,
  });
}

function findApplyJobIndex(state, id) {
  const jobId = String(id || "").trim();
  return state.jobs.findIndex((job) => job.id === jobId || job.jobId === jobId || job.securityId === jobId);
}

export async function updateApplyJobStatus(id, status) {
  if (!allowedStatuses.has(status)) throw new Error(`Unsupported apply status: ${status}`);
  const state = await getApplyWorkbenchState();
  const jobId = String(id || "").trim();
  const index = findApplyJobIndex(state, jobId);
  if (index < 0) throw new Error(`Apply job not found: ${jobId}`);

  const jobs = [...state.jobs];
  jobs[index] = {
    ...jobs[index],
    status,
    updatedAt: new Date().toISOString(),
  };
  return saveApplyWorkbenchState({ jobs });
}

export async function openApplyJob(id, deps = {}) {
  const state = await getApplyWorkbenchState();
  const jobId = String(id || "").trim();
  const index = findApplyJobIndex(state, jobId);
  if (index < 0) throw new Error(`Apply job not found: ${jobId}`);

  const selected = state.jobs[index];
  const url = assertBossDetailUrl(selected.detailUrl);
  const openUrl = deps.openUrl || openUrlInSystemBrowser;
  await openUrl(url);
  return updateApplyJobStatus(selected.id, "opened");
}
