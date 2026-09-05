# OxygenClaw — Handoff Document（交接文档）

> 交接对象：下一个接手的 AI 编码搭档（或开发者本人）。
> 生成：2026-09-05（UTC+8），小氧 → 下一任。
> 阅读顺序：本文档 → `CHANGELOG.md` → `memory/FACT.md` → `docs/CODEX_HARNESS_RESEARCH.md`。

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->

---

## 0. 最重要的三件事

1. **战略决定（泽川，2026-09-05）**：OpenOxygen Next 与 OxygenClaw 将**合并为一个平台，用户可选择 Agent Harness**（原生 OpenOxygen 引擎 vs Claw 生态引擎）。本次会话的全部 WebUI 工作是这次合并的基座；跨 Harness 互联层建议以 **MCP 为标准总线**（依据见 `docs/CODEX_HARNESS_RESEARCH.md` 第 4 节）。
2. **当前状态**：`feature/webui-regression` 分支 **29 commits**，全部 tsc + Playwright 实测通过。15 项审查清单 **15/15 关闭**（#13 并入市场多源、#4 判定旧构建问题、#15 研究报告交付）。三大提议（NewAPI 深度集成 / 多数据来源+市场多源 / UI Remake 三轮）全部落地。
3. **协作契约不变**：泽川决策与实机测试，搭档写代码；先诊断结论后细节；方案列选项等拍板；系统级副作用（计划任务/服务注册等）**必须先征得同意**——本次会话因看门狗计划任务未经确认部署被泽川纠正，已删除，切记。

---

## 1. 仓库与运行

- 位置：`C:\Users\Sails\Documents\Workspace\01-Active\Core-Systems\oxygen-claw`（从归档区激活，git 基线重建于 2026-08-22，历史不可考）
- 分支：`feature/webui-regression`（v26.0 主题分支）；master 仅基线
- 版本：`26.0.0-alpha.1`（displayVersion `v26.0 Alpha 1`，BC 规范 `v26.0-Alpha 1`）
- 运行：`.dev\start-server.bat`（:3001）+ `.dev\start-webui.bat`（:5173）
- **警告**：本机 C 盘曾剩 6.7GB，系统会静默杀长驻进程、清临时文件与旧版浏览器二进制。Playwright 基准 = `chromium-1234`。看门狗计划任务已被泽川删除——不要重新部署系统级任务，除非泽川明确要求
- 验证脚本（Playwright）在 `.dev/scripts/`，日志 `.dev/logs/`（均 gitignore）

## 2. 本会话交付明细（29 commits）

### NewAPI 集成（提议 2 + 清单 #1/#9/#10）
- `webui/src/services/newapi.ts`：rc.24/rc.27 适配器。凭据三格式（`用户名:密码` / `用户ID:系统令牌`+`New-Api-User` / 裸 token），全角冒号容错，全部经 server proxy（CORS 规避）。端点：login/self/self·models/log·self·stat/log·self/**data·self**（quota_data 预聚合，30 天窗口）
- Dashboard：NewAPI 数据源 + 数据源徽标；Models 部署弹窗：九家预设 + **从 NewAPI 站点拉取模型勾选导入**
- 硬教训：①业务 401 会被「成功但空数据」伪装（已修：业务失败计入 endpointFailures）②server 改代码后必须杀进程重启（tsx 非 watch）③测试站令牌会被用户轮换——报错时先怀疑凭据而非代码
- rc.27 源码研究：`.dev/newapi-src/`（未入库），协议兼容确认；吸收了 `/api/data/self`

### 多源架构（提议 3+4，清单 #13）
- `store: marketSources` 注册表（OpenClawMP 内置 + 任意 JSON 端点）；Marketplace 源管理弹窗；聚合拉取 + 来源徽标 + JSON 源技能一键导入本地（免 CLI）
- Dashboard 数据源徽标（NewAPI/自定义/本地）

### UI Remake 三轮（参照豆包/千问/Codex 桌面范式，黑白灰不变）
- R1：深色默认主题；会话态输入框补齐能力 pills/附件/模型按钮（与空态 hero 一致）
- R2：模型下拉重做（provider 分组+能力徽标+上下文+勾标）；ComputerUse 权限三级控件（始终询问/按需确认/全部允许，持久化 settings——**UI 先行，等后端审批 API 消费**）
- R3：账号中心弹窗；会话置顶（不碰 updatedAt）+ 日期分组（📌置顶/今天/近7天/更早）
- 收尾采纳：侧栏收起（64px↔240px 过渡+持久化）+ 快捷键提示槽位（G+D/G+P/G+M 占位）

### 其他
- 弹窗透明根因修复（light 主题缺 container 变量 + apple-dark 块边界孤儿声明——**加 CSS 变量前先验证块边界**）
- 设置页布局修复（-m-6 hack 清除）；/workbench 重定向 /playgrounds
- MCP：AgentID 自动生成；任务节点图（手写 SVG 拓扑，零依赖）
- 技能 zip 导入（SKILL.md frontmatter 解析）
- 安全审计修复：proxy optionalAuth + **server 显式监听 localhost**（曾有 LAN 开放中继窗口）
- 可用性批次：小屏侧栏/i18n 接线/任务历史条件显示+动画+可调高/segmented 自适应/顶部会话标题

### 研究
- `docs/CODEX_HARNESS_RESEARCH.md`（#15）：协议优先内核/审批策略修正/thread+turn rollout/MCP 双向总线/SKILL.md 跨 Harness 技能格式 + 五项优先借鉴清单

## 3. 后续队列（按建议优先级）

1. **合并架构设计**（新决定）：双 Harness 选择的进程/协议边界——MCP 总线 + 统一会话协议是起点；先出架构方案再动手
2. 审批事件流（把 ComputerUse 权限三级接到 runtime，Codex 式 approve/always/policy-amend）
3. 契约类型自动生成（server↔webui，学 ts_rs 思路）
4. 任务级 rollout 快照（runtime_events 已有增量，补压缩快照）
5. 实机验收反馈修复（泽川本轮说过「有几处设计不合理」未列明细——**先要清单**）

## 4. 陷阱备忘（本会话踩过）

- PowerShell 5.1：`&&` 不可用；内联 node -e 的引号/中文必炸——**脚本一律写文件**；`Set-Content -Encoding UTF8` 写中文会乱（用 Write 工具）
- Playwright：`has-text()` 是子串匹配（「拉取」命中「从站点拉取」的事故）；页面 svg 多于一个时勿用 querySelector 泛选；fresh profile 的 localStorage 是空的
- 巨石组件（Playgrounds 3400 行/Settings 3000 行）改前先定位精确行号，oldString 必须逐字节匹配（含中文）
- CSS 变量加了不生效？先查**块边界**（`}` 提前闭合产生孤儿声明）再查缓存
- 磁盘紧张时：文件会消失、进程会被杀、git 里什么都可能「看似丢了」——先查 reflog 再慌

## 5. 记忆文件

| 文件 | 内容 |
|---|---|
| `CHANGELOG.md` | 全部变更（Keep a Changelog）|
| `memory/FACT.md` | 长期知识（WebUI 回归决定已覆盖 Electron 存档）|
| `docs/CODEX_HARNESS_RESEARCH.md` | Harness 研究报告（合并决定的技术依据）|
| `HANDOFF.md` | 本文档 |

**交接完毕。祝顺利。**
