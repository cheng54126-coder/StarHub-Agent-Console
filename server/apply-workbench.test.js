import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function withTempDataDir(fn) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jarvis-apply-workbench-"));
  const previous = process.env.JARVIS_DATA_DIR;
  process.env.JARVIS_DATA_DIR = tempDir;
  try {
    await fn(tempDir);
  } finally {
    if (previous === undefined) {
      delete process.env.JARVIS_DATA_DIR;
    } else {
      process.env.JARVIS_DATA_DIR = previous;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("apply workbench searches jobs and exposes ids, links, and greetings", async () => {
  await withTempDataDir(async () => {
    const { searchApplyJobs } = await import(`./apply-workbench.js?case=${Date.now()}-${Math.random()}`);
    let call = null;

    const state = await searchApplyJobs(
      { query: "test engineer", city: "Zhengzhou", salary: "10-15K", count: 2 },
      {
        callTool: async (tool, args) => {
          call = { tool, args };
          return {
            ok: true,
            data: {
              ok: true,
              data: [
                {
                  jobName: "Senior QA Engineer",
                  brandName: "Example Tech",
                  salaryDesc: "10-15K",
                  city: "Zhengzhou",
                  jobId: "job-001",
                  securityId: "sec-001",
                },
                {
                  title: "Automation Test Engineer",
                  company: "Second Studio",
                  salary: "12-16K",
                  location: "Zhengzhou",
                  job_id: "job-002",
                  security_id: "sec-002",
                  url: "https://www.zhipin.com/job_detail/sec-002.html",
                },
              ],
            },
          };
        },
      },
    );

    assert.equal(call.tool, "boss_search");
    assert.deepEqual(call.args, { query: "test engineer", city: "Zhengzhou", salary: "10-15K", page: 1 });
    assert.equal(state.jobs.length, 2);
    assert.equal(state.jobs[0].title, "Senior QA Engineer");
    assert.equal(state.jobs[0].company, "Example Tech");
    assert.equal(state.jobs[0].jobId, "job-001");
    assert.equal(state.jobs[0].securityId, "sec-001");
    assert.equal(state.jobs[0].detailUrl, "https://www.zhipin.com/job_detail/job-001.html?securityId=sec-001");
    assert.equal(state.jobs[0].status, "pending");
    assert.match(state.jobs[0].greeting, /Senior QA Engineer/);
    assert.match(state.jobs[0].greeting, /Example Tech/);
  });
});

test("apply workbench fetches additional search pages to satisfy requested count", async () => {
  await withTempDataDir(async () => {
    const { searchApplyJobs } = await import(`./apply-workbench.js?case=${Date.now()}-${Math.random()}`);
    const calls = [];

    const state = await searchApplyJobs(
      { query: "qa", city: "郑州", salary: "10-15K", count: 3 },
      {
        callTool: async (tool, args) => {
          calls.push({ tool, args });
          const page = args.page || 1;
          return {
            ok: true,
            data: {
              ok: true,
              data: page === 1
                ? [
                    { title: "QA 1", job_id: "job-001", security_id: "sec-001" },
                    { title: "QA 2", job_id: "job-002", security_id: "sec-002" },
                  ]
                : [
                    { title: "QA 3", job_id: "job-003", security_id: "sec-003" },
                    { title: "QA 4", job_id: "job-004", security_id: "sec-004" },
                  ],
              pagination: { page, has_more: page === 1 },
            },
          };
        },
      },
    );

    assert.deepEqual(
      calls.map((call) => call.args),
      [
        { query: "qa", city: "郑州", salary: "10-15K", page: 1 },
        { query: "qa", city: "郑州", salary: "10-15K", page: 2 },
      ],
    );
    assert.equal(state.criteria.count, 3);
    assert.deepEqual(state.jobs.map((job) => job.jobId), ["job-001", "job-002", "job-003"]);
  });
});

test("apply workbench persists per-job status updates", async () => {
  await withTempDataDir(async () => {
    const { searchApplyJobs, updateApplyJobStatus } = await import(`./apply-workbench.js?case=${Date.now()}-${Math.random()}`);

    await searchApplyJobs(
      { query: "qa", city: "Zhengzhou", count: 1 },
      {
        callTool: async () => ({
          ok: true,
          data: {
            jobs: [
              {
                title: "QA Engineer",
                company: "Example Tech",
                job_id: "job-001",
                security_id: "sec-001",
              },
            ],
          },
        }),
      },
    );

    const updated = await updateApplyJobStatus("job-001", "opened");

    assert.equal(updated.jobs[0].status, "opened");
    assert.ok(updated.jobs[0].updatedAt);
    await assert.rejects(() => updateApplyJobStatus("job-001", "sent"), /Unsupported apply status/);
    await assert.rejects(() => updateApplyJobStatus("missing", "opened"), /Apply job not found/);
  });
});

test("apply workbench opens a validated Boss detail URL through an injected opener", async () => {
  await withTempDataDir(async () => {
    const { searchApplyJobs, openApplyJob } = await import(`./apply-workbench.js?case=${Date.now()}-${Math.random()}`);

    await searchApplyJobs(
      { query: "qa", city: "郑州", count: 1 },
      {
        callTool: async () => ({
          ok: true,
          data: {
            jobs: [
              {
                title: "QA Engineer",
                company: "Example Tech",
                job_id: "job-001",
                security_id: "sec-001",
              },
            ],
          },
        }),
      },
    );

    let openedUrl = "";
    const state = await openApplyJob("job-001", {
      openUrl: async (url) => {
        openedUrl = url;
        return { ok: true, command: "test-browser" };
      },
    });

    assert.equal(openedUrl, "https://www.zhipin.com/job_detail/job-001.html?securityId=sec-001");
    assert.equal(state.jobs[0].status, "opened");
  });
});

test("apply workbench rejects non-Boss detail URLs before opening", async () => {
  await withTempDataDir(async () => {
    const { searchApplyJobs, openApplyJob } = await import(`./apply-workbench.js?case=${Date.now()}-${Math.random()}`);

    await searchApplyJobs(
      { query: "qa", city: "郑州", count: 1 },
      {
        callTool: async () => ({
          ok: true,
          data: {
            jobs: [
              {
                title: "QA Engineer",
                company: "Example Tech",
                job_id: "job-001",
                security_id: "sec-001",
                url: "https://example.com/job/1",
              },
            ],
          },
        }),
      },
    );

    await assert.rejects(
      () => openApplyJob("job-001", { openUrl: async () => ({ ok: true }) }),
      /Only Boss job detail URLs can be opened/,
    );
  });
});
