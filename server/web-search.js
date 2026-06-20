import { appendEvent, saveRuntimeState } from "./store.js";
import { chatWithAi } from "./ai.js";

const providers = {
  bing: {
    label: "Bing",
    baseUrl: "https://www.bing.com/search",
    queryParam: "q",
  },
  google: {
    label: "Google",
    baseUrl: "https://www.google.com/search",
    queryParam: "q",
  },
  baidu: {
    label: "Baidu",
    baseUrl: "https://www.baidu.com/s",
    queryParam: "wd",
  },
};

export function getSearchProviders() {
  return providers;
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchUrl(query, provider = "bing") {
  const selected = providers[provider] ? provider : "bing";
  const meta = providers[selected];
  const url = new URL(meta.baseUrl);
  url.searchParams.set(meta.queryParam, query);
  if (selected === "bing") {
    url.searchParams.set("format", "rss");
  }
  return { selected, url };
}

export async function fetchSearchResults({ query, provider = "bing", limit = 5 } = {}) {
  const safeQuery = String(query || "").trim();
  if (!safeQuery) {
    throw new Error("Search query is required");
  }

  const { selected, url } = buildSearchUrl(safeQuery, provider);
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`);
  }

  const html = await response.text();
  const results = [];
  const rssPattern = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<description>([\s\S]*?)<\/description>[\s\S]*?<\/item>/gi;
  for (const match of html.matchAll(rssPattern)) {
    const title = decodeEntities(match[1]);
    const resultUrl = decodeEntities(match[2]);
    const snippet = decodeEntities(match[3] || "");
    if (title && resultUrl) {
      results.push({ title, url: resultUrl, snippet });
    }
    if (results.length >= limit) break;
  }

  if (results.length) {
    return {
      query: safeQuery,
      provider: selected,
      url: url.toString(),
      results,
    };
  }

  const itemPattern = /<li class="b_algo"[\s\S]*?<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
  for (const match of html.matchAll(itemPattern)) {
    const title = decodeEntities(match[2]);
    const resultUrl = decodeEntities(match[1]);
    const snippet = decodeEntities(match[3] || "");
    if (title && resultUrl) {
      results.push({ title, url: resultUrl, snippet });
    }
    if (results.length >= limit) break;
  }

  return {
    query: safeQuery,
    provider: selected,
    url: url.toString(),
    results,
  };
}

export async function summarizeSearchWithAi({ query, results }) {
  if (!results.length) {
    return "没有检索到可用结果。你可以换一个更具体的关键词。";
  }

  const sourceText = results
    .map((result, index) => `${index + 1}. ${result.title}\n${result.url}\n${result.snippet}`)
    .join("\n\n");
  const aiResult = await chatWithAi({
    messages: [
      {
        role: "user",
        text:
          `请基于以下网页搜索结果回答我的问题。要求：用中文，先给结论，再列出2-4条依据，最后给出可点击的来源标题。\n\n问题：${query}\n\n搜索结果：\n${sourceText}`,
      },
    ],
  });
  return aiResult.text;
}

export async function answerWebSearch({ query, provider = "bing" } = {}, deps = {}) {
  const safeQuery = String(query || "").trim();
  if (!safeQuery) {
    throw new Error("Search query is required");
  }

  const search = deps.search || ((options) => fetchSearchResults(options));
  const summarize = deps.summarize || ((payload) => summarizeSearchWithAi(payload));
  const rawSearchResult = await search({ query: safeQuery, provider });
  const searchResult = Array.isArray(rawSearchResult)
    ? { query: safeQuery, provider, url: "", results: rawSearchResult }
    : rawSearchResult;
  const answer = await summarize({ query: safeQuery, results: searchResult.results || [] });

  const task = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    query: safeQuery,
    provider: searchResult.provider || provider,
    url: searchResult.url,
    results: searchResult.results,
    answer,
    status: "answered",
    createdAt: new Date().toISOString(),
  };

  await saveRuntimeState({
    webSearch: "Answered",
    subtitleState: "Search",
    subtitleText: answer,
  });
  await appendEvent("web.search.created", {
    message: `Web search answered: ${safeQuery}.`,
    query: safeQuery,
    provider: task.provider,
    resultCount: task.results.length,
  });

  return task;
}
