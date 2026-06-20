import { callMcpTool } from "./mcp.js";

const knownCities = [
  "郑州",
  "北京",
  "上海",
  "广州",
  "深圳",
  "杭州",
  "南京",
  "武汉",
  "成都",
  "西安",
  "苏州",
  "天津",
  "重庆",
  "长沙",
  "合肥",
  "青岛",
  "济南",
  "厦门",
  "福州",
  "无锡",
];

function extractLabeledValue(text, labels) {
  for (const label of labels) {
    const match = text.match(
      new RegExp(`${label}\\s*[:：]\\s*([^\\n，,。；;]+?)(?=\\s+(?:城市|地点|地区|岗位|职位|工作|薪资|薪水)\\s*[:：]|[，,。；;]|$)`, "i"),
    );
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

export function parseBossSearchIntent(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const hasJobIntent = /(boss|BOSS|直聘|岗位|职位|招聘|工作|薪资|城市|查询|搜索|找|工程师|测试|开发|产品|运营)/.test(raw);
  if (!hasJobIntent) return null;

  const labeledCity = extractLabeledValue(raw, ["城市", "地点", "地区"]);
  const city = knownCities.find((item) => raw.includes(item)) || labeledCity;
  const salary = raw.match(/\d+\s*-\s*\d+\s*[Kk]/)?.[0]?.replace(/\s+/g, "") || extractLabeledValue(raw, ["薪资", "薪水"]);
  const labeledQuery = extractLabeledValue(raw, ["岗位", "职位", "工作"]);

  let query = labeledQuery;
  if (!query) {
    query = raw
      .replace(/城市\s*[:：]\s*[^\n，,。；;\-]+/g, " ")
      .replace(/岗位\s*[:：]\s*[^\n，,。；;\-]+/g, " ")
      .replace(/职位\s*[:：]\s*[^\n，,。；;\-]+/g, " ")
      .replace(/薪资\s*[:：]\s*[^\n，,。；;]+/g, " ")
      .replace(salary || "", " ")
      .replace(city || "", " ")
      .replace(/帮我|请|查一下|查询|搜索|找一下|找|岗位|职位|招聘|工作|薪资|薪水|城市|地区|BOSS|boss|直聘|列表|返回/g, " ")
      .replace(/[，,。；;：:\-\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (!query && /测试/.test(raw)) query = "测试工程师";
  if (!query) return null;

  return {
    query,
    ...(city ? { city } : {}),
    ...(salary ? { salary } : {}),
  };
}

function extractJobs(data) {
  const payload = data?.data ?? data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.jobs)) return payload.jobs;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function field(job, keys) {
  for (const key of keys) {
    if (job?.[key] != null && String(job[key]).trim()) return String(job[key]).trim();
  }
  return "";
}

function formatJob(job, index) {
  const title = field(job, ["title", "jobName", "job_name", "position", "name"]) || "未命名岗位";
  const company = field(job, ["company", "companyName", "company_name", "brandName", "brand_name"]);
  const city = field(job, ["city", "location", "area"]);
  const salary = field(job, ["salary", "salaryDesc", "salary_desc"]);
  const link = field(job, ["url", "link"]);
  return `${index + 1}. ${title}${company ? ` / ${company}` : ""}${city ? ` / ${city}` : ""}${salary ? ` / ${salary}` : ""}${link ? `\n   ${link}` : ""}`;
}

function formatBossSearchAnswer(args, toolResult) {
  const data = toolResult.data;
  if (data?.ok === false || toolResult.isError) {
    const message = data?.error?.message || data?.message || data?.text || "工具返回失败";
    return `我已经调用 boss-mcp 的 boss_search，但执行失败：${message}`;
  }

  const jobs = extractJobs(data).slice(0, 10);
  if (jobs.length === 0) {
    return `我已经调用 boss-mcp 搜索：${args.city || "不限城市"} / ${args.query}${args.salary ? ` / ${args.salary}` : ""}，但没有拿到岗位列表。`;
  }

  return [
    `已通过 boss-mcp 查询：${args.city || "不限城市"} / ${args.query}${args.salary ? ` / ${args.salary}` : ""}`,
    "",
    ...jobs.map(formatJob),
  ].join("\n");
}

export async function answerBossMcpQuery(text, deps = {}) {
  const args = parseBossSearchIntent(text);
  if (!args) return null;

  const callTool = deps.callTool || callMcpTool;
  try {
    const toolResult = await callTool("boss_search", args, { timeoutMs: 35_000 });
    return {
      handled: true,
      tool: "boss_search",
      args,
      toolResult,
      text: formatBossSearchAnswer(args, toolResult),
    };
  } catch (error) {
    return {
      handled: true,
      tool: "boss_search",
      args,
      text: `我已经准备调用 boss-mcp 的 boss_search，但工具执行异常：${error.message}`,
    };
  }
}
