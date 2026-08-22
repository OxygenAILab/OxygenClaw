# Claude Session Summary — OxygenClaw WebUI 前端重写

**日期**: 2026-07-04
**分工**: Claude 负责前端，GPT 负责后端。本轮任务是重写 WebUI 的布局、主题、Playgrounds。
**用户明确要求**:
- 无 Emoji，保持优雅
- 先做外壳布局，再做 Playgrounds，再其他页面
- 参考 StepFun StepClaw、豆包、千问的设计范式
- 助手消息不套气泡，直接渲染 markdown（含 mermaid 流程图）
- 工具调用做成 StepClaw 风格折叠卡片
- 设置项走后端 settings.json（给 GPT 留文档）
- 禁止 Emoji

---

## 1. 代码审计与现状评估

### 已通读的关键文件
| 文件 | 行数 | 关键发现 |
|------|------|----------|
| `src/styles/global.css` | 4473 | 三套主题混在一个文件里；OxygenOrigin 挂在 `[data-ui-theme="apple"]` 上（命名语义乱）；Material 3 是硬编码紫色，非 HCT；Liquid Glass 是纯 CSS 叠加 |
| `src/pages/PlaygroundsV2.tsx` | 842 | Chat/Task/ComputerUse 三路合一；`localStorage` 做真相源；`refreshConversation` 后端失败时不覆盖 |
| `src/pages/Playgrounds.tsx` | 3022 | 旧版单体文件，内联 renderMarkdown，气泡包裹所有消息 |
| `src/pages/Settings.tsx` | 3131 | 设置巨页，所有项目一个文件 |
| `src/store/index.ts` | 211 | 数据全存 localStorage，刷新后任务不可恢复 |
| `src/components/Layout.tsx` | 20 | 老版只有 20 行，未折叠/响应式 |
| `src/components/Header.tsx` | 154 | 与 Sidebar 各画一次 logo（重复） |
| `src/components/Sidebar.tsx` | 125 | 固定 w-64，无折叠/响应式 |

### GPT 文档（后端契约）
- `packages/webui/CLAUDE_FRONTEND_BRIEF.md` — 要求以 runtime_tasks + runtime_events + conversations 为核心
- `docs/frontend-runtime-api.md` — 全局后端契约（stable，见下方 §10）
- `docs/backend-runtime-plan.md` — 后端重建蓝图（Phase 1~6）

### 路由结构
- `/playgrounds` → 新的 `PlaygroundsV2.tsx`（已切换）
- `/playgrounds/legacy` → 旧的 `Playgrounds.tsx`（3022 行单体，保留）

---

## 2. 参考站点研究（Playwright 截图）

- **StepFun 首页** (`https://chat.stepfun.com`): 居中输入焦点、能力胶囊行、示例卡片 2×2、大量留白 → `images/stepfun-*.png`
- **StepClaw 对话页** (`https://chat.stepfun.com/chats/openclaw`): 助手消息**无气泡**，markdown 直接渲染；表格干净（表头浅灰底）；inline code 高亮；底部小复制图标 + 署名 → `images/stepclaw-chat-*.png`
- 豆包/千问/ChatGPT 登录墙后未深入，但范式高度一致

### 设计范式提炼
- 助手/Agent 消息 → 无需气泡，全宽 markdown 渲染
- 用户消息 → 气泡（右对齐、圆角、主色背景）
- 工具调用 → StepClaw 风格折叠行卡片（已完成 xxx / 展开看请求响应）
- 输入框 → 居中、大圆角、圆形发送按钮
- 欢迎页 → 问候语 + 示例卡片 2×2 网格
- 代码块 → 带语言标题栏 + 复制按钮
- 支持 mermaid 流程图内联渲染

---

## 3. 已完成的改动

### 3.1 应用外壳重构（Layout / Sidebar / Header）
- **`src/components/Sidebar.tsx`** 完全重写：可折叠 rail (72px) ↔ expanded (256px)，300ms 过渡；导航按 Workspace / System 分组；活动项左侧指示条 + primary-container 高亮；底部运行时状态点（内联 `var(--md-success/error)`）；折叠态 tooltip。
- **`src/components/Header.tsx`** 完全重写：去掉与 Sidebar 重复的 logo；左侧移动端菜单按钮 + 当前页标题（`usePageTitle()` 随路由联动）；右侧语言切换/通知/用户菜单接入 i18n；导出 `onOpenMobileNav`。
- **`src/components/Layout.tsx`** 完全重写：桌面 flex row，折叠状态持久化 `oxygenclaw:sidebar-collapsed`；`<lg` 遮罩抽屉移动端侧栏，换路由/点遮罩自动关闭，锁 body 滚动；`/playgrounds` full-bleed 去 padding；`text-on-background` → `text-on-surface`。

### 3.2 i18n 扩展
`src/i18n/zh.ts`、`src/i18n/en.ts` 新增 `nav` 分组：`workspace/system/collapse/expand/openMenu/notifications/noNotifications/runtimeOffline/runtimeOnline/signInHint/notSignedIn/signInRegister`。

### 3.3 OxygenOrigin 主题 Token 重构（`src/styles/global.css`）
- OxygenOrigin(apple) 注释改为品牌释义（"oxygen-blue primary, clean neutral surfaces"）
- 三套主题（OxygenOrigin / Material 3 / Liquid Glass）light + dark 都补全 `--md-surface-container-*` 五级层次刻度
  - OxygenOrigin light: `#ffffff` → `#e7e7ee`
  - OxygenOrigin dark: `#0a0a0b` → `#303034`
  - Liquid Glass: 半透明白色系列
- 新增工具类：`.bg-surface-container-*`(5 级)、`.elevation-1~4`
- `.card` 共享类升级：`1px solid outline-variant` 边框、`rounded-xl`、hover 克制（`-1px`）、新增 `.card-static`

### 3.4 Playgrounds 核心组件
- **`WelcomePage.tsx`** 完全重写：动态问候语、圆形品牌图标、`max-w-2xl` 居中、2×2 示例卡片、hover `ArrowUpRight`。
- **`ChatInput.tsx`** 精修：`rounded-3xl` + `elevation-1`，焦点 `elevation-2`；发送/停止改圆形图标按钮。
- **`MarkdownRenderer.tsx`** 新建：`react-markdown` + `remark-gfm` + `rehype-highlight`；`MermaidDiagram` 异步渲染 SVG，失败 fallback 源码；`CodeBlock` 语言标题栏 + 复制按钮；覆盖 `pre` passthrough 避免嵌套；`nodeToText` 递归提取 rawText；表格圆角边框。
- **`ToolCallCard.tsx`** 新建：StepClaw 风格折叠卡片；状态图标（完成/执行中/失败）带色；展开显示请求/响应 JSON；导出 `ToolCall` interface。
- **`MessageBubble.tsx`** 重构：去掉 `Bot/User/showAvatar`；助手消息无气泡全宽 markdown；读取 `message.toolCalls` 在 markdown 上方渲染工具卡片；用户消息 `rounded-2xl rounded-tr-md bg-primary` 右对齐。
- **`ConversationSidebar.tsx`** / **`TopBar.tsx`** / **`utils.tsx`** 已从单体拆分（三栏结构雏形）。

### 3.5 路由切换
`src/App.tsx` — `/playgrounds` → `PlaygroundsV2`，旧版保留为 `/playgrounds/legacy`。

### 3.6 Markdown 样式（`src/styles/playgrounds.css`）
新增 `.md-content` 全套样式：表格 `border-collapse: separate` + 圆角 + 表头 `surface-container-high`；inline code `SF Mono` + `surface-container-high`；代码块 `surface-container-low`；全部走 CSS 变量适配主题。

---

## 4. 错误与修复

- **#1 Playwright 浏览器安装失败**: `chromium-1200/chrome-win64/chrome.exe` 不存在。`npx playwright install chromium` 卡住、`PLAYWRIGHT_DOWNLOAD_HOST=npmmirror` 仍卡。解决：用户手动下载 `chrome-win64.zip`，解压到 `ms-playwright/chromium-1200/`。MCP 需 `--headless=false`。
- **#2 `text-on-background` 不存在**: Layout 误用，改 `text-on-surface`。
- **#3 `/playgrounds` 渲染旧文件**: 修改都在 V2 但路由指向旧版。修复：`App.tsx` 切换路由。
- **#4 代码块渲染 `[object Object]`**: rehype-highlight 把代码拆成高亮 span 子节点，`String(children)` stringify 坏。修复：`nodeToText` 递归提取 rawText 用于复制/mermaid；CodeBlock 直接渲染 `children`；覆盖 `pre` passthrough。
- **#5 `bg-error`/`bg-success` 不存在**: Sidebar 旧代码用了。修复：内联 `style={{ backgroundColor: 'var(--md-error)' }}`。

---

## 5. 新增依赖
`react-markdown` `remark-gfm` `rehype-highlight` `mermaid`（共 212 包，`npm audit` 2 漏洞：1 moderate, 1 high）

---

## 6. 待完成任务
1. Playgrounds 三栏布局打磨 — 对齐千问范式（会话侧栏 + 对话流 + 右侧 Canvas/Artifact 画布）
2. 给 GPT 写后端协调文档 — settings.json 驱动设置项 + 新设计提案（工具事件结构等）
3. 其他页面布局打磨 — Dashboard / Models / MCP / Marketplace / Settings
4. 主题 token 全部测试 — 三套主题 dark/light 全遍历
5. 浏览器截图复验 — 确认 markdown/mermaid/工具卡片在无后端干扰下的完整渲染

---

## 7. 关键决策记录
- rehype-highlight 而非 prism：highlight.js 与 react-markdown 集成更干净
- CodeBlock 架构：拦截 `code` 挂自定义 UI，拦截 `pre` passthrough 避免嵌套
- ToolCallCard 接口：`name/status/detail/arguments/result`，为 runtime events 流预留
- 路由切换：V2 覆盖默认路由，旧版保留 `/playgrounds/legacy`（不删，避免连锁引用）

---

## 8. 截图清单（已导出至 images/）
| 文件 | 描述 |
|------|------|
| `dashboard-2026-07-04T07-41-34-925Z.png` | Dashboard 初始状态 |
| `dashboard2-2026-07-04T07-49-33-905Z.png` | Dashboard 卡片 upgrade 后 |
| `models-2026-07-04T07-42-55-886Z.png` | Models 页面 |
| `stepfun-2026-07-04T07-52-17-161Z.png` | StepFun 首页参考 |
| `stepclaw-chat-2026-07-04T08-12-39-664Z.png` | StepClaw 对话页参考（关键设计参考） |
| `playground-welcome-2026-07-04T07-56-35-177Z.png` | V2 WelcomePage 渲染 |
| `pg-render-2026-07-04T08-28-46-385Z.png` | 旧 Playgrounds 初始截图（route 切换前） |
| `pg-v2-state-2026-07-04T08-34-40-228Z.png` | V2 欢迎页（route 切换后） |
| `pg-v2-list-2026-07-04T08-37-28-388Z.png` | V2 会话侧栏 |
| `pg-v2-msg-2026-07-04T08-38-42-253Z.png` | V2 消息渲染（无气泡 + 工具卡片 + 表格，代码块有 Object 错误） |
| `pg-v2-fixed-2026-07-04T08-43-32-087Z.png` | V2 代码块修复后（被后端 500 覆盖，未验证成功） |
| `pg-code-check-2026-07-04T08-46-40-015Z.png` | 代码块修复后重试 |

---

## 9. 当前进度
- [x] 应用外壳（Layout/Sidebar/Header）
- [x] OxygenOrigin token 体系 + surface-container 分层
- [x] .card 共享类升级
- [x] MarkdownRenderer（react-markdown + highlight + mermaid）
- [x] ToolCallCard（StepClaw 风格）
- [x] WelcomePage 重写
- [x] ChatInput 精修
- [x] MessageBubble 无气泡改造 + MarkdownRenderer 接入
- [x] Route 切换到 V2
- [x] ConversationSidebar / TopBar / utils 拆分
- [ ] Playgrounds 三栏布局打磨
- [ ] GPT 后端协调文档
- [ ] 其他页面布局
- [ ] 截图复验（代码块/mermaid 验证）

---

## 10. 后端契约快照（来自 docs/frontend-runtime-api.md）
- Base: `http://localhost:3001/api`，Bearer token 可选
- 响应封套：`{ success, data }` / `{ success, error }`
- 核心表面：`/api/auth/*`、`/api/llm/*`、`/api/settings`、`/api/conversations/*`、`/api/agent/execute`、`/api/agent/computeruse/execute`、`/api/agent/tasks/*`、`/api/mcp/*`、`/api/marketplace/*`、`/api/cli/*`、`/api/proxy/request`、`/api/dashboard/stats`
- runtime_tasks 状态：`pending/running/completed/failed/cancelled`；kinds：`agent/computeruse`
- 推荐流程：Chat 走 `/conversations/:id/messages` SSE；Task 走 `/agent/start` + `/agent/tasks/:id/events/live?afterSeq=`
- settingsApi：`GET /settings`（bool 归一化）、`PUT /settings`（接受当前 WebUI 全部字段，见 api.ts AppSettings interface）

---

*本文件由 Claude 生成，记录 2026-07-04 前端重写会话的全部上下文。图片位于同目录 images/ 子文件夹。*
