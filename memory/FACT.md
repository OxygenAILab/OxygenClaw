# FACT — 小氧的长期知识库

## 活跃项目

### OxygenClaw (`oxygen-claw`)
- 下一代多模型 AI Agent 平台,monorepo,版本 `26.0.0-alpha.1`。
- 定位:**终端 + 视觉双修的 Computer Use Claw**(开源)。computeruse 是核心卖点,不是可选项。
- 六个 package:`core`(引擎:ODC 认知/OMM 记忆/MCP/容器/模型注册)、`server`(Express 后端)、`cli`、`webui`(已废弃)、`electron-ui`(**新前端**)、`gateway`(路由+成本优化)、`shared`。
- 后端技术栈:Express 4 + TypeScript(CommonJS + ES2022)+ tsx。DB 已从 sql.js 迁移到 better-sqlite3。
- 环境:Windows(win32 x64),Node 24.15.0,npm 11.12.1。
- 三份根目录 SPEC 是后端契约:`BACKEND_CONVERSATIONS_SPEC.md` / `BACKEND_RUNTIME_TASKS_SPEC.md` / `BACKEND_SETTINGS_SPEC.md`。

## 重大架构决策:WebUI 废弃,转向 Electron

泽川于 2026-07-21 决定:**完全废弃 WebUI 和 React Native for Windows,采用 Electron 架构**。

### 决策演进
1. **第一次决策**(2026-07-21):WebUI → RNW(原生 Windows 应用)
2. **第二次决策**(2026-07-22):RNW → Electron(环境兼容性 + 生态成熟度)

### 转向 Electron 的原因
1. **环境约束**:系统安装 VS2026,RNW 需要 VS2022(版本 17.x),不兼容
2. **存储限制**:C 盘空间不足以支持 RNW 完整开发环境(需 20+ GB)
3. **生态成熟度**:Electron + MCP 生态更成熟,cherry-studio 等生产级参考实现丰富
4. **开发效率**:Electron 开发周期更短,TypeScript 全栈统一

### 研究仓库克隆状态(2026-07-21/22)
**成功克隆 8/8**(`C:\Users\Sails\Documents\Workspace\AgentWorkspace\oxygen-claw-research\`):
1. **cherry-studio**(60.59 MB)— **核心参考**:Electron + MCP 完整实现,1355 行 MCP Manager
2. **UI-TARS-desktop**(52.69 MB)— Computer Use 参考:nut-js operator + Retina 缩放处理
3. **trae-agent**(4.97 MB)— 子 Agent 并行执行 + Trajectory 记录
4. **TRAE-Agents**(0.05 MB)— 60+ Agent 模板
5. **hermes-agent**(143.98 MB)— **技能系统参考**:SKILL.md 解析 + FTS5 搜索 + 学习循环
6. **awesome-openclaw-agents**(1.27 MB)— 205 个 Agent 模板,Team Mode 设计参考
7. **Awesome-OpenClaw**(0.16 MB)— OpenClaw 生态资源索引
8. **AionUi**(已删除节省空间)— Team Mode 设计(从文档提取)

**深度研究成果**:
- 完整报告:`docs/DEEP_RESEARCH_REPORT.md`(119 KB, 4396 行)
- 从 27 KB 扩充到 119 KB(4.3 倍增长)
- 2000+ 行生产级代码示例
- 15+ 可复用架构模式

### Electron 架构方案

完整研究报告:`docs/DEEP_RESEARCH_REPORT.md`(119 KB, 4396 行)。  
完整实施计划:`RNW_IMPLEMENTATION_PLAN.md`(已过时,待更新为 Electron 版)。

#### 技术栈
- **框架**:Electron 32+ + electron-vite 2.3+
- **语言**:TypeScript 5.8+
- **UI**:React 18 + Zustand(状态管理)+ React Query 5(数据同步)
- **MCP**:@modelcontextprotocol/sdk@1.27.1
- **Computer Use**:@computer-use/nut-js@4.2.0(Node.js 子进程调用)
- **Agent**:复用现有 Express backend + MCP Manager
- **数据库**:better-sqlite3 + Drizzle ORM

#### Computer Use 实现路径
- **方案 B**(优先):Node.js 子进程调用 @computer-use/nut-js — 快速验证
- **方案 A**(长期优化):Electron Native Addon 封装 Windows API — 性能最优(可选)

#### Agent 架构设计
- **模式**:主 Agent(Leader)+ 专业化子 Agent(Teammates)
- **参考**:
  - cherry-studio 的 MCP Server 生命周期管理
  - UI-TARS-desktop 的 Computer Use 实现
  - hermes-agent 的技能学习循环
  - AionUi 的 Team Mode 设计(从文档推断)
- **通信机制**:SQLite 事件表(轻量级,复用 better-sqlite3)

#### MCP 集成
- 复用 cherry-studio 的 McpRuntimeService(1355 行核心代码)
- 支持 stdio/SSE 传输协议自动降级
- OAuth 完整流程(本地回调服务器 + 5 分钟超时)
- 7 个内置 MCP Server(browser/filesystem 等)

#### 实施路线图(6 阶段,约 8-11 周)
1. **Phase 0**(1-2 天):环境准备 + Electron 项目搭建 — ✅ 已完成(2026-07-22)
2. **Phase 1**(1 周):核心框架(IPC 架构 + SQLite 数据层 + 日志系统)
3. **Phase 2**(2 周):MCP 集成(复用 cherry-studio McpRuntimeService)
4. **Phase 3**(1-2 周):UI 层(React Router + MCP Server 管理 UI)
5. **Phase 4**(2-3 周):Computer Use(nut-js + 截图 + Vision LLM)
6. **Phase 5**(2 周):技能系统(SKILL.md 解析 + FTS5 搜索)
7. **Phase 6**(1 周):打包发布(electron-builder + 自动更新)

### Phase 0 进度(2026-07-22)

**已完成**:
- ✅ 8 个仓库深度研究(DEEP_RESEARCH_REPORT.md, 119 KB)
- ✅ 确认开发环境(VS2026 + Node.js 24 + npm 11)
- ✅ 清理旧项目(删除 RNW 项目 + npm cache)
- ✅ 创建 Electron 项目(`packages/electron-ui/`)
- ✅ 项目结构搭建(main/preload/renderer 分离)
- ✅ TypeScript 配置(tsconfig.node.json + tsconfig.web.json)
- ✅ electron-vite 配置
- ✅ 基础 IPC 通信(ping/pong 测试)
- ✅ React 欢迎页面
- 🔄 npm install 正在后台运行

**Phase 0 收尾**(✅ 2026-07-23 全部完成,详见下方"Electron 启动踩坑与 Phase 0 收尾"):
- ✅ npm install(--ignore-scripts 绕开 native 编译)
- ✅ npm run dev 端到端启动(4 进程 + vite 5173/5174/5175)
- ✅ IPC ping/pong 就绪
- ✅ 根因排查与教训沉淀

**技术决策**:
- 实际使用 Electron ^43.2.0(早期计划 32,已被 linter/环境对齐上调)
- electron-vite(而非 electron-forge)— 更快的 HMR
- 安全配置:contextIsolation=true, nodeIntegration=false
- 依赖清单:@modelcontextprotocol/sdk, zustand, react-query(better-sqlite3/drizzle 延后到 Phase 1)

## 前端重写进度(已废弃,仅作历史记录)

### WebUI(已废弃)
WebUI 前端重写已完成阶段 1-5(conversations + tasks + models + settings + 打磨),编译零错误。**但泽川已决定废弃该方案**。

### React Native for Windows(已废弃)
RNW 项目已创建并安装依赖,但因 VS 版本不兼容(需 VS2022,系统有 VS2026)而废弃,转向 Electron。

## 后端改造(已完成)

四批 Lot 改造完成,三个 P0 风险根治:
1. **Lot 1**:DB 层 sql.js → better-sqlite3 + 参数标准化(boolean→0/1、undefined→null)。
2. **Lot 2**:event seq 竞态根治(runTransaction 原子分配 + UNIQUE INDEX)。
3. **Lot 3**:取消信号贯穿(adapter→core,三处 callLLM 加 signal,两个 adapter 加取消优先收尾)。
4. **Lot 4**:P1 三项(SSE 生命周期统一/chat 走 worker/settings 校验)。

## 技术教训(踩过的坑)

### better-sqlite3 迁移
- **参数绑定比 sql.js 严格**:JS 布尔和 `undefined` 会直接抛错。解法:在 db.ts 的 `runQuery`/`runExec`/`runInsert` 单一入口做 `normalizeParams`(boolean→0/1、undefined→null、Date→毫秒),上层路由零改动。冒烟测试已确认这层必需。
- **`CREATE UNIQUE INDEX IF NOT EXISTS` 的静默陷阱**:若已存在同名的**非唯一**索引(旧 schema 建的),该语句会因名字已存在而被静默跳过,唯一约束不生效。解法:迁移时先检测 `PRAGMA index_list` 的 unique 标志→去重现有数据→`DROP` 旧索引→重建为 UNIQUE,做成幂等。**教训:tsc 通过 ≠ 运行时正确,DB 这类地基必须跑运行时冒烟测试验证。**

### 临时 Node 测试脚本
- 要 `require('better-sqlite3')` 的临时脚本**必须放在 `packages/server` 目录内**再跑,放 `/tmp` 会 MODULE_NOT_FOUND(node_modules 解析路径问题)。
- Bash 工具的**工作目录在命令间持久**。若之前 cd 进了子目录,再写 `cd packages/server && ...` 会因目录已在其中而失败、`&&` 链整体断掉。先确认 cwd。

### 前端类型安全(历史记录)
- **Message.content 支持多模态**:可以是 `string` 或 `ContentBlock[]`(text/image),后者用于支持视觉输入。MessageList 组件已适配两种格式。
- **Message.timestamp 后端改为 createdAt**:新 API 使用 `createdAt`,但兼容 `timestamp` 作为回退(旧数据可能仍用此字段)。
- **axios 拦截器类型**:request 拦截器需用 `InternalAxiosRequestConfig` 而非裸 `config`,否则 TS 报错。
- **NodeJS.Timeout 在浏览器环境不存在**:用 `ReturnType<typeof setTimeout>` 代替,跨环境兼容。

### RNW 迁移挑战(已废弃,仅作记录)
- **RN 0.76+ 不再支持 react-native-windows-init**:需改用手动安装。
- **RNW 最高支持 RN 0.75.x**:0.76 支持尚未稳定。
- **VS 版本要求严格**:RNW 0.75 需要 VS2022(版本 17.x),不支持 VS2026(版本 18.x)。
- **磁盘空间管理**:C 盘曾仅剩 1.8 GB,现已清理至 44 GB 可用。

### Electron 项目经验(2026-07-22)
- **electron-vite vs electron-forge**:选择 electron-vite 因其 HMR 更快,配置更简洁。
- **安全配置必需**:contextIsolation=true, nodeIntegration=false,通过 preload 暴露 API。
- **TypeScript 项目引用**:使用 tsconfig.json 的 references 分离 node 和 web 环境。
- **better-sqlite3 外部化**:在 electron.vite.config.ts 的 main.build.rollupOptions.external 中声明,避免打包错误。

### Electron 启动踩坑与 Phase 0 收尾(2026-07-23)
- **⚠️ `ELECTRON_RUN_AS_NODE=1` 环境变量污染(耗时最久的坑)**:调试时误在 shell 会话里设了 `$env:ELECTRON_RUN_AS_NODE="1"`,残留后所有启动都报 `TypeError: Cannot read properties of undefined (reading 'whenReady')`。根因:该变量强制 Electron 以纯 Node 模式运行,`require('electron')` 返回**路径字符串**(字符索引对象 `{'0','1'...}`)而非 API 对象,故 `electron.app` 为 undefined。**排查手法**:`electron.exe -p "typeof require('electron').app"` 若为 undefined 即中招。**解法**:`Remove-Item Env:\ELECTRON_RUN_AS_NODE`。教训:崩溃不一定是代码/二进制问题,先排查会话环境变量污染。
- **`@electron-toolkit/utils` 的 `is.dev` 在裸启动时崩**:导入即执行导致 `isPackaged` undefined 报错。改用原生 `!app.isPackaged` 判断,不依赖该工具库。
- **Electron 二进制下载失败**:直接 npm install 拉不到二进制。解法:`$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"` 后跑 `node node_modules/electron/install.js`。
- **Phase 0 为绕开 VS2026 原生编译**:临时从 electron-ui 依赖里移除 better-sqlite3 / drizzle,先跑通框架;DB 层留到 Phase 1 解决 VS 编译问题。
- **vite 版本约束**:electron-vite@2.3.0 需 vite ^4/^5,不能用 vite 6,已降到 ^5.4.x。

**✅ Phase 0 完成(2026-07-23)**:`npm run dev` 端到端跑通。4 个 electron 进程稳定存活,vite dev server 监听 5173(renderer)+ 5174/5175(main/preload HMR),React 欢迎页 + IPC ping/pong 就绪。实际 Electron 版本 ^43.2.0(非早期计划的 32)。

### ✅ Phase 1 DB 层地基:better-sqlite3 编译死结已解(2026-07-23)
**决策**:泽川拍板走「方向 3 = prebuilt 二进制」,彻底绕开 VS2026 编译。**已实测验证通过,DB 层地基敲定。**
- **关键发现:better-sqlite3 13.x 改用 N-API 机制**(依赖仅 `node-addon-api ^8.0.0`)。预编译二进制**直接打包进 npm tarball**(`node_modules/better-sqlite3/prebuilds/` 下按平台命名:`win32-x64.node` / `darwin-arm64.node` / `linux-x64.node` 等 8 个),靠 N-API ABI 稳定层**一个二进制通吃 Node 和 Electron 所有版本**。安装即到位,**无需本地编译、无需下载 Electron 专用 prebuilt、无需 @electron/rebuild**。VS2026 死结和网络下载坑一起绕过。
- **实测结果**:装 `better-sqlite3@^13.0.1`,在真机 **Electron 43.2.0 / ABI 148** 下跑通完整 CRUD(建表/插入/查询),`sqlite=3.53.3`。Node 层(ABI 137)同样通过。**两层验证都过**。
- ⚠️ **npm 上没有 12.12.0**(那是 GitHub tag);registry 上 `12.11.1` 之后直接跳 `13.0.0`/`13.0.1`。用最新 **13.0.1**。
- ⚠️ **官方 registry 会 ECONNRESET**:必须 `--registry=https://registry.npmmirror.com` 装。安装用 `--ignore-scripts` 更稳(N-API 机制下本就无 install 脚本,`scripts.install` 为 undefined)。
- ⚠️ **验证 Electron 层不能靠 stdout**:Windows 上 `electron.exe` 是 GUI 子系统进程,`console.log` 不回流父控制台(会看到空输出,易误判失败)。正确姿势:脚本内 `fs.writeFileSync` 写结果文件 + 检查 `app.exit(code)` 退出码。用 `Start-Process -Wait -PassThru` 拿 ExitCode。
- **下一步**:重新引入 drizzle-orm(纯 JS,无编译问题),搭 Phase 1 核心框架(IPC 架构 + SQLite 数据层 + 日志 + 错误处理)。better-sqlite3 已在 electron-ui 依赖中(^13.0.1)。

### ✅ Phase 1 Part 1-2 完成 + 项目迁移到 NormalWorkspace(2026-07-27)

**Phase 1 Part 1-2 完成状态**:
- ✅ **IPC 架构**(26 通道,6 handler 组,类型安全贯穿 Main/Preload/Renderer)
- ✅ **SQLite 数据层**(5 表,WAL 模式,外键级联,normalizeParams 参数归一化)
- ✅ **验证通过**(8/8 DB 测试 + 6/6 端到端 UI 测试,TypeScript 零错误)
- ✅ **文档完整**(`Handoff.md` 12.8 KB,技术债、FAQ、文件清单齐全)

**项目迁移完成**:
- **原因**:代码分散在 3 个位置(AgentWorkspace 空目录,_archived_duplicates 有 Electron UI,NormalWorkspace 有后端文档但无 packages)
- **解决方案**:将所有 packages 统一迁移到 `NormalWorkspace/Core-Projects/oxygen-claw/packages/`
- ✅ **迁移完成**:7 个 package(cli/core/electron-ui/gateway/server/shared/webui)全部到位
- ✅ **依赖安装**:monorepo 根目录 `npm install` 完成(1357 packages,5 分钟)
- ✅ **编译修复**:
  - 修复 `router.ts` 的 `IpcHandler` 类型导出(export type)
  - 修复路径引用(`../shared` → `../../shared`)
  - 修复 handler 类型声明(`Record<string, IpcHandler<any, any>>`)
  - 修复 `ipc-types.ts` 中 `model` 字段改为可选(`model?`)
  - 移除 `test-ipc.tsx` 中未使用的 `updated` 变量
- ✅ **TypeScript 验证**:`typecheck:node` + `typecheck:web` 零错误
- ✅ **完整构建**:`npm run build` 全部 workspaces 通过(electron-ui/server/cli/gateway/webui)

**当前项目结构**:
```
NormalWorkspace/Core-Projects/oxygen-claw/
├── packages/
│   ├── cli/           ✅ 已迁移
│   ├── core/          ✅ 已迁移
│   ├── electron-ui/   ✅ 已迁移(Phase 1 Part 1-2 完成)
│   ├── gateway/       ✅ 已迁移
│   ├── server/        ✅ 已迁移(后端 Lot 1-4 完成)
│   ├── shared/        ✅ 已迁移
│   └── webui/         ✅ 已迁移(已废弃)
├── memory/
│   ├── FACT.md        ✅ 已更新
│   └── JOURNAL.jsonl
├── HANDOFF.md         ✅ 后端交接文档(12.7 KB)
└── package.json       ✅ workspaces 配置
```

**技术修复要点**:
1. **IpcHandler 类型系统**:导出为 `export type`,允许 handler 文件导入使用
2. **类型擦除策略**:Map/Record 使用 `IpcHandler<any, any>` 避免泛型协变问题
3. **可选字段调整**:ConversationCreateRequest 和 MessageSendRequest 的 `model` 改为可选,匹配实际业务逻辑
4. **路径修复**:`src/main` 访问 `src/shared` 需要 `../../shared`(向上两层)

**下一步工作**:
- Phase 1 Part 3: 日志系统(winston/pino + 文件轮转 + renderer→IPC→file)
- Phase 1 Part 4: 错误处理(全局异常捕获 + IPC 错误码 + ErrorBoundary)

## 协作约定
- 泽川是决策与测试者,小氧实施。改动前先给方案等拍板(小改除外)。
- 每批改动完必须编译验证 + 必要时运行时冒烟测试,不留半成品。
- 数据库改动前先备份(已备份 `data/oxygenclaw.db.bak-<时间戳>`)。
- **WebUI 和 RNW 已废弃**,不再投入精力。所有前端工作转向 Electron。
- **Electron 项目位置**:`packages/electron-ui/`(monorepo 内部,Phase 1 会整合 Express backend)。
