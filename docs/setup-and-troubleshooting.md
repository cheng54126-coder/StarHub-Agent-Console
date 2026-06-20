# 星枢 Agent Console 安装与配置指南

本文档记录从零部署 StarHub Agent Console 需要的工具链、安装命令、配置入口，以及本项目开发过程中踩过的常见坑。示例默认面向 Windows 10/11 + PowerShell。

## 1. 系统要求

- Windows 10/11
- PowerShell 5+ 或 PowerShell 7+
- Node.js 18 或更高版本
- Git
- Chrome 或 Microsoft Edge
- 可选：Clash Verge 或其他本地代理
- 可选：Ollama，本地模型默认配置使用 `http://127.0.0.1:11434/v1`
- Boss 求职功能需要 `boss-agent-cli` 和 `boss-mcp`

## 2. 基础工具链安装

使用 `winget` 安装常用依赖：

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Google.Chrome -e
winget install --id astral-sh.uv -e
```

安装完成后重新打开 PowerShell，确认命令可用：

```powershell
git --version
node -v
npm -v
uv --version
```

如果 `uv` 安装后命令不可用，通常是 PATH 尚未刷新。重新打开终端，或者手动确认以下目录是否在 PATH 中：

```text
%USERPROFILE%\.local\bin
```

## 3. 代理配置

如果 GitHub、npm、uv、浏览器内核下载速度慢，建议使用本地代理。当前开发机使用 Clash Verge，端口为 `7897`。

PowerShell 当前会话代理：

```powershell
$env:HTTP_PROXY = "http://127.0.0.1:7897"
$env:HTTPS_PROXY = "http://127.0.0.1:7897"
```

npm 代理：

```powershell
npm config set proxy http://127.0.0.1:7897
npm config set https-proxy http://127.0.0.1:7897
```

Git 代理：

```powershell
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
```

不需要代理时清理：

```powershell
npm config delete proxy
npm config delete https-proxy
git config --global --unset http.proxy
git config --global --unset https.proxy
```

## 4. 拉取和运行项目

```powershell
git clone https://github.com/cheng54126-coder/StarHub-Agent-Console.git
cd StarHub-Agent-Console
npm run dev
```

默认访问：

```text
http://127.0.0.1:8787
```

本项目当前没有 npm 第三方依赖，因此无需 `npm install` 也能运行。后续如果引入依赖，再执行：

```powershell
npm install
```

如果端口 `8787` 被占用，可以临时换端口：

```powershell
$env:JARVIS_PORT = "8788"
npm run dev
```

检查端口占用：

```powershell
Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
```

## 5. Boss Agent CLI 与 boss-mcp 安装

Boss 求职工作台依赖 `boss-agent-cli`。安装：

```powershell
uv tool install boss-agent-cli
```

确认命令：

```powershell
boss --help
boss-mcp --help
```

如果命令不可用，直接使用完整路径确认：

```powershell
& "$env:USERPROFILE\.local\bin\boss.exe" --help
& "$env:USERPROFILE\.local\bin\boss-mcp.exe" --help
```

安装浏览器自动化内核：

```powershell
patchright install
```

如果 `patchright` 不在 PATH 中，用 uv tool 安装目录里的完整路径：

```powershell
& "$env:APPDATA\uv\tools\boss-agent-cli\Scripts\patchright.exe" install
```

如果下载慢，先设置代理：

```powershell
$env:HTTP_PROXY = "http://127.0.0.1:7897"
$env:HTTPS_PROXY = "http://127.0.0.1:7897"
& "$env:APPDATA\uv\tools\boss-agent-cli\Scripts\patchright.exe" install
```

登录 Boss：

```powershell
boss login --cookie-source chrome --timeout 180
```

如果 cookie 读取失败，可以尝试 CDP 模式：

```powershell
boss login --cdp --timeout 180
```

检查登录态：

```powershell
boss status --live
boss doctor
```

搜索验证：

```powershell
boss search "测试工程师" --city "郑州" --salary "10-15K" --page 1
```

启动 MCP 服务验证：

```powershell
boss-mcp --transport stdio
```

`stdio` 模式会等待 MCP 客户端输入，不会像普通 HTTP 服务一样打印 URL。能启动且不报错即可。

## 6. MCP 在星枢中的配置

前端入口：

```text
MCP Gateway -> Configured Servers
```

默认配置会按当前 Windows 用户自动推导：

```json
{
  "id": "boss",
  "name": "boss-mcp",
  "enabled": true,
  "transport": "stdio",
  "command": "%USERPROFILE%\\.local\\bin\\boss-mcp.exe",
  "args": ["--transport", "stdio"],
  "cwd": "%USERPROFILE%",
  "env": {}
}
```

如果你的安装路径不同，在页面里修改：

- `Server ID`: `boss`
- `Name`: `boss-mcp`
- `Command`: `C:\Users\<你的用户名>\.local\bin\boss-mcp.exe`
- `Args`: `--transport stdio`
- `Env JSON`: `{}`
- 勾选 `Enabled`
- 点击 `保存配置`
- 点击 `同步`

也可以通过环境变量覆盖后端默认路径：

```powershell
$env:BOSS_MCP_PATH = "C:\Users\<你的用户名>\.local\bin\boss-mcp.exe"
$env:BOSS_CLI_PATH = "C:\Users\<你的用户名>\.local\bin\boss.exe"
$env:BOSS_TOOL_SCRIPTS_DIR = "$env:APPDATA\uv\tools\boss-agent-cli\Scripts"
npm run dev
```

## 7. AI 配置

前端入口：

```text
AI Config
```

支持的请求格式：

- `OpenAI Chat Completions`: `/chat/completions`
- `OpenAI Responses`: `/responses`
- `OpenAI Legacy Completions`: `/completions`
- `Claude Messages`: `/messages`
- `Claude Bearer Relay`
- `Gemini GenerateContent`
- `Codex Responses Relay`
- `Custom Template`

OpenAI 兼容中转示例：

```text
Provider: OpenAI Compatible
Endpoint: https://your-relay.example.com/v1
Model: gpt-4.1-mini
Request Format: OpenAI Chat Completions
API Key: sk-...
```

Responses 兼容中转示例：

```text
Provider: OpenAI Compatible
Endpoint: https://your-relay.example.com/v1
Model: gpt-5.1 或中转实际支持的模型名
Request Format: OpenAI Responses
Request Path: /responses
Response Text Path: output_text
```

注意：不要把真实 API Key 提交到 Git。运行时配置写入 `data/ai-config.json`，该目录已被 `.gitignore` 排除。

## 8. 配置文件位置

默认运行数据目录：

```text
data/
```

主要文件：

- `data/ai-config.json`: AI 供应商、模型、API Key、请求格式
- `data/mcp-config.json`: MCP 服务列表
- `data/runtime-state.json`: 主题、唤醒状态、权限状态
- `data/chat-history.json`: 最近聊天记录
- `data/apply-workbench.json`: Boss 搜索结果和投递工作台状态
- `data/events.jsonl`: 运行事件日志

这些文件可能包含密钥、聊天记录、岗位缓存和个人信息，不应提交。

脱敏模板见：

- `docs/examples/ai-config.example.json`
- `docs/examples/mcp-config.example.json`

## 9. 常见问题和踩坑记录

### 9.1 打开 Boss 页面没有登录态

原因：`boss.exe` 的登录态和 Chrome/Edge 浏览器登录态不是同一个 cookie 池。CLI 显示已登录，不代表浏览器页面已登录。

处理：

1. 先用系统 Chrome/Edge 打开 `https://www.zhipin.com/` 并登录一次。
2. 再回到星枢点击 `打开并复制`。
3. 星枢后端会调用系统浏览器打开岗位页，尽量沿用该浏览器 profile 的登录态。

不要尝试把 `boss.exe` 的加密 session 直接注入浏览器 cookie，这不稳定也不安全。

### 9.2 boss-mcp 同步失败

排查顺序：

```powershell
boss --help
boss-mcp --help
boss status --live
boss doctor
```

常见原因：

- `%USERPROFILE%\.local\bin` 不在 PATH 中
- `boss-mcp.exe` 安装路径和页面 MCP 配置里的 `Command` 不一致
- `patchright install` 没跑完，浏览器内核缺失
- 本地代理未配置，下载依赖或访问 GitHub 超时
- Boss 登录态过期，需要重新 `boss login`

### 9.3 搜索岗位参数没生效

已修复过的问题：搜索 loading 时旧条件会回填输入框，导致看起来修改的岗位、城市、薪资、数量没有生效。

如果再次遇到：

1. 浏览器强制刷新页面。
2. 确认后端服务已重启。
3. 打开开发者工具看 `/api/apply-workbench/search` 请求体是否包含新参数。
4. 确认 boss-mcp 的 `boss_search` schema 使用 `query/city/salary/page`，数量由星枢后端分页拉取后截断。

### 9.4 AI 对话返回 404 或模型不存在

常见原因：模型名不被当前中转支持。例如中转返回：

```text
AI request failed: 404 {"error":"当前 API 不支持所选模型 gpt-5.5"}
```

处理：

- 在中转后台确认可用模型名。
- `Request Format` 要和中转接口匹配。
- OpenAI Chat Completions 通常用 `/chat/completions`。
- OpenAI Responses 通常用 `/responses`。
- Endpoint 通常填到 `/v1`，不要重复写成 `/v1/v1`。

### 9.5 AI Config 下拉框看不到内容

这是样式问题，已修过 Provider 下拉框白底看不清的问题。若仍出现，先强制刷新页面，并确认 `styles.css` 响应头是 `cache-control: no-store`。

### 9.6 麦克风、屏幕读取无权限

浏览器安全策略要求用户手动授权：

- 麦克风：浏览器地址栏左侧权限设置允许麦克风。
- 屏幕读取：必须由用户点击触发，不能后台静默获取。
- 建议使用 `http://127.0.0.1:8787`，不要直接双击 HTML 文件。

### 9.7 语音回复重复播放

项目内已加入播放去重和分段朗读逻辑。如果出现重复：

- 检查是否同时打开了多个星枢页面。
- 检查 `Voice out` 是否被多次触发。
- 关闭其他标签页后刷新。

### 9.8 搜索为空时没有反馈

已加入 loading 和空结果提示。如果没有显示，通常是前端缓存或服务未重启。

### 9.9 GitHub 推送前的密钥风险

提交前检查：

```powershell
git status --short --ignored
git check-ignore -v data/ai-config.json
rg -n 'sk-[A-Za-z0-9_-]{20,}' . --glob '!data/**'
```

期望：

- `data/` 显示为 ignored
- `data/ai-config.json` 被 `.gitignore` 命中
- 非 `data/` 文件中没有真实长 API Key

## 10. 常用验证命令

项目检查：

```powershell
npm run check
npm test
```

服务健康检查：

```powershell
curl.exe -s http://127.0.0.1:8787/api/health
```

MCP 工具同步：

```powershell
curl.exe -s http://127.0.0.1:8787/api/mcp/tools
```

Boss 登录态：

```powershell
boss status --live
```

Boss 搜索：

```powershell
boss search "测试工程师" --city "郑州" --salary "10-15K" --page 1
```

