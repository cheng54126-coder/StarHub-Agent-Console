import assert from "node:assert/strict";
import test from "node:test";

test("boss chat handler calls boss_search for job search intent", async () => {
  const { answerBossMcpQuery } = await import(`./boss-mcp-chat.js?case=${Date.now()}-${Math.random()}`);
  let call = null;
  const result = await answerBossMcpQuery(
    "帮我查一下郑州测试工程师岗位，薪资10-15K",
    {
      callTool: async (tool, args) => {
        call = { tool, args };
        return {
          ok: true,
          data: {
            ok: true,
            data: [
              {
                title: "测试工程师",
                company: "Example Tech",
                city: "郑州",
                salary: "10-15K",
              },
            ],
          },
        };
      },
    },
  );

  assert.equal(call.tool, "boss_search");
  assert.equal(call.args.query, "测试工程师");
  assert.equal(call.args.city, "郑州");
  assert.equal(call.args.salary, "10-15K");
  assert.equal(result.handled, true);
  assert.match(result.text, /测试工程师/);
  assert.match(result.text, /Example Tech/);
});

test("boss chat handler reports MCP execution errors instead of missing tools", async () => {
  const { answerBossMcpQuery } = await import(`./boss-mcp-chat.js?case=${Date.now()}-${Math.random()}`);
  const result = await answerBossMcpQuery(
    "城市：郑州 岗位：测试工程师 薪资：10-15K",
    {
      callTool: async () => ({
        ok: true,
        data: {
          ok: false,
          error: {
            code: "NETWORK_ERROR",
            message: "Page.goto timeout",
            recoverable: true,
          },
        },
      }),
    },
  );

  assert.equal(result.handled, true);
  assert.match(result.text, /boss-mcp/);
  assert.match(result.text, /Page\.goto timeout/);
  assert.doesNotMatch(result.text, /没有实际可调用/);
});
