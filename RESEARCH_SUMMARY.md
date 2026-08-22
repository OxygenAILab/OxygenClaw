# OxygenClaw React Native for Windows 重构 — 研究总结

**日期**: 2026-07-21  
**负责人**: 小氧 (OxygenClaw Coding Assistant)

---

## 调研概览

### 克隆状态

| 仓库 | 状态 | 大小 | 说明 |
|------|------|------|------|
| cherry-studio | ✅ 成功 | 99 MB | Computer Use 框架（MCP 扩展） |
| UI-TARS-desktop | ✅ 成功 | 89 MB | 字节跳动 GUI Agent（nut-js 原生实现） |
| trae-agent | ✅ 成功 | 7.6 MB | 字节跳动软件工程 Agent |
| TRAE-Agents | ✅ 成功 | 162 KB | TRAE Agent 模板集合 |
| hermes-agent | ✅ 成功 | 231 MB | NousResearch 自改进 Agent |
| awesome-openclaw-agents | ✅ 成功 | 3.1 MB | 205 个 Agent 模板库 |
| Awesome-OpenClaw | ✅ 成功 | 326 KB | OpenClaw 生态资源索引 |
| **iOfficeAI/AionUi** | ❌ 失败 | N/A | 磁盘空间不足（仅剩 3.73 GB） |

**总计**: 7/8 成功，**AionUi 因磁盘空间限制未克隆**。

---

## 核心发现

### 1. Computer Use 实现路径

#### cherry-studio（MCP 代理模式）
- **方案**: 无原生 Computer Use，通过 MCP Server 扩展（如 `windows-computer-use-mcp`）
- **优点**: 灵活、解耦、社区生态
- **缺点**: 依赖外部 MCP Server，延迟较高
- **架构**:
  ```
  cherry-studio (Electron)
    ↓ IPC
  MCP Client (@modelcontextprotocol/sdk)
    ↓ TCP/stdio
  windows-computer-use-mcp (Node.js 子进程)
    ↓
  @nut-tree-fork/nut-js (原生模块)
    ↓
  Windows API (SendInput/GDI+)
  ```

#### UI-TARS-desktop（原生集成模式）✅ 推荐
- **方案**: 直接集成 `@computer-use/nut-js`，Electron 主进程执行
- **优点**: 低延迟、可控性强、支持本地/远程双模式
- **缺点**: 需维护原生依赖
- **架构**:
  ```
  UI-TARS-desktop (Electron Renderer)
    ↓ IPC
  Main Process + nut-js
    ↓
  Windows API (SendInput/GetCursorPos/BitBlt)
  ```
- **关键代码路径**:
  - `packages/ui-tars/operators/desktop.ts` — 本地操作器
  - `packages/ui-tars/operators/remote.ts` — 远程操作器（WebSocket）
  - `apps/ui-tars/src/main/ipc/screenshot.ts` — 截图 IPC

**结论**: **UI-TARS-desktop 的原生集成模式更适合 OxygenClaw**，但需适配 React Native for Windows。

---

### 2. React Native for Windows 迁移挑战

#### Electron → RNW 架构映射

| Electron | React Native for Windows | 实现方式 |
|----------|-------------------------|---------|
| Main Process | Native Module (C++/C#) | TurboModule / WinRT |
| Renderer Process | JavaScript Thread | Metro Bundler |
| IPC (ipcMain/ipcRenderer) | Native Module API | 直接函数调用 |
| Node.js APIs | ❌ 不可用 | 需自定义 TurboModule |

#### Computer Use 实现方案

**方案 A: TurboModule 封装 Windows API**（推荐）
- **实现**: 用 C++ 或 C# 封装 `SendInput`、`GetCursorPos`、`BitBlt` 等 Windows API
- **优点**: 性能最优、无 Node.js 依赖、完全原生
- **缺点**: 开发成本高、需维护 C++/C# 代码
- **参考**: [react-native-windows TurboModule 文档](https://microsoft.github.io/react-native-windows/docs/native-modules-advanced)

**方案 B: Node.js 子进程调用 nut-js**
- **实现**: RNW 主线程通过 `child_process` 调用独立 Node.js 进程（运行 nut-js）
- **优点**: 快速实现、复用现有 nut-js 生态
- **缺点**: 性能较低、进程间通信开销、需打包 Node.js 运行时
- **参考**: hermes-agent 的多后端支持（local/docker/ssh）

**方案 C: robotjs 社区方案**
- **实现**: 使用 `robotjs` 或 `@jitsi/robotjs`（维护更活跃）
- **优点**: 成熟、跨平台
- **缺点**: 原生依赖、RNW 兼容性未知

**推荐**: **方案 A（TurboModule）**，性能和可控性最优。初期可用方案 B 快速验证，后续迁移到 A。

#### 截图实现

| 方案 | 实现方式 | 优点 | 缺点 |
|------|---------|------|------|
| **TurboModule + GDI+** | C++ 封装 `BitBlt` / `StretchBlt` | 性能最优、支持多显示器 | 开发成本高 |
| **react-native-view-shot** | 截取 React Native 视图 | 社区支持 | ❌ 无法截取非 RN 窗口 |
| **Node.js 子进程 + Sharp** | 调用 `screenshot-desktop` 库 | 快速实现 | 性能较低 |

**推荐**: **TurboModule + GDI+**（参考 UI-TARS-desktop 的 `packages/ui-tars/operators/desktop.ts`）

---

### 3. Agent 架构设计

#### 单 Agent vs 多 Agent

| 架构模式 | 代表仓库 | 优点 | 缺点 |
|---------|---------|------|------|
| **单 Agent + 工具扩展** | cherry-studio | 简单、易调试 | 能力受限于工具集 |
| **单 Agent + 技能系统** | hermes-agent | 自学习、持续改进 | 需复杂的技能管理 |
| **多 Agent 协作** | trae-agent（子 Agent 并行）| 专业化分工、并行执行 | 协调开销、状态同步 |
| **Team Mode** | awesome-openclaw-agents（模板参考）| 角色明确、任务分解 | ❌ AionUi 未克隆，缺少参考实现 |

#### 推荐架构：**主 Agent + 专业化子 Agent**

基于 **trae-agent 的子 Agent 并行模式** + **hermes-agent 的技能学习循环**：

```
OxygenClaw Agent
├── Main Agent (Leader)
│   ├── 任务规划
│   ├── 子 Agent 调度
│   └── 结果整合
└── Specialized Agents (Teammates)
    ├── Computer Use Agent（GUI 操作）
    ├── Code Agent（代码编辑、测试）
    ├── Research Agent（搜索、总结）
    └── DevOps Agent（部署、监控）
```

**通信机制**:
- **方案 1**: TCP-based MCP Server（参考 AionUi TEAM_MCP_PRD.md 的描述）
- **方案 2**: 文件系统 Mailbox（参考 awesome-openclaw-agents 的 Agent 间消息传递）
- **方案 3**: SQLite + 事件表（轻量级、无额外依赖）

**推荐**: **SQLite 事件表**，复用现有 better-sqlite3 基础设施。

---

### 4. 技能学习循环（借鉴 hermes-agent）

hermes-agent 的核心创新：**Agent 从经验中学习并持续改进**

#### 技能生命周期

```
1. Skill Creation（技能创建）
   ↓
   完成复杂任务后，Agent 主动生成可复用技能
   存储为 skills/*.skill.md（含步骤、工具调用、错误处理）
   
2. Skill Execution（技能执行）
   ↓
   遇到类似任务时，检索并执行匹配技能
   记录执行结果、错误、用户反馈
   
3. Skill Improvement（技能改进）
   ↓
   基于执行反馈，自动优化技能步骤
   更新 skill.md 并增加版本号
   
4. Session Search（跨会话记忆）
   ↓
   FTS5 全文搜索历史对话 + LLM 摘要
   在新会话中找回相关知识
```

#### OxygenClaw 实现建议

1. **技能存储**: 复用 `C:\Users\Sails\Documents\Workspace\AgentWorkspace\oxygen-claw\packages\core\skills\` 目录
2. **技能格式**: Markdown（参考 hermes-agent 的 `skills/*.skill.md`）
3. **技能检索**: SQLite FTS5（已有 better-sqlite3）+ LLM Embedding
4. **改进触发**: 用户反馈（👍/👎）或执行失败时自动触发

---

### 5. MCP 集成（参考 cherry-studio）

cherry-studio 的 MCP 架构是目前最完善的 Electron + MCP 实现。

#### 核心组件

```
src/main/ai/mcp/
├── MCPServerManager.ts       # MCP Server 生命周期管理
├── MCPClientManager.ts       # MCP Client 连接池
├── servers/
│   ├── browser/               # 浏览器控制 MCP Server
│   └── filesystem/            # 文件系统 MCP Server
└── tools/
    └── adapters/              # 统一工具接口（Vercel AI SDK、LangChain 等）
```

#### 关键特性

1. **动态启停**: 用户可在 UI 中启用/禁用 MCP Server
2. **配置持久化**: SQLite 存储 MCP Server 配置（启动命令、环境变量、参数）
3. **工具适配**: 统一多种 AI SDK 的工具调用接口
4. **错误恢复**: MCP Server 崩溃后自动重启

#### OxygenClaw 迁移计划

1. **阶段 1**: 保留 Express backend，在 `packages/server/src/services/mcp.ts` 实现 MCP Manager
2. **阶段 2**: RNW 前端通过 HTTP API 调用 MCP 功能（复用现有 backend）
3. **阶段 3**: （可选）在 RNW 中实现原生 MCP Client（TurboModule + @modelcontextprotocol/sdk）

**推荐**: **先走阶段 1-2**，快速集成；性能瓶颈出现后再考虑阶段 3。

---

## React Native for Windows 技术栈推荐

### 核心框架

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-native": "^0.76.0",
    "react-native-windows": "^0.76.0",
    "zustand": "^5.0.0",                    // 状态管理（学习 cherry-studio/UI-TARS）
    "@react-navigation/native": "^7.0.0",   // 导航
    "axios": "^1.7.0",                      // HTTP 客户端（复用现有 backend）
    "@tanstack/react-query": "^5.0.0"      // 数据同步（已在 WebUI 中使用）
  }
}
```

### Computer Use 层

```json
{
  "dependencies": {
    "@computer-use/nut-js": "^4.2.0",       // 方案 B: 子进程调用
    "screenshot-desktop": "^1.15.0",        // 截图（子进程）
    "sharp": "^0.33.0"                      // 图像处理
  }
}
```

**注意**: 方案 A（TurboModule）需自定义 C++/C# 代码，无 npm 依赖。

### Agent 层

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.0",  // MCP 集成
    "better-sqlite3": "^11.0.0",             // 本地存储（已在 backend 使用）
    "drizzle-orm": "^0.36.0"                 // ORM（学习 cherry-studio）
  }
}
```

### UI 组件

```json
{
  "dependencies": {
    "react-native-paper": "^5.0.0",          // Material Design 组件
    "react-native-vector-icons": "^10.0.0",  // 图标
    "react-native-gesture-handler": "^2.0.0" // 手势
  }
}
```

---

## 实施路线图

### 阶段 0: 环境准备（1-2 天）

- [x] 克隆研究仓库（7/8 成功）
- [x] 分析架构模式
- [ ] 安装 React Native for Windows 开发环境
  ```bash
  npx @react-native-community/cli@latest init OxygenClawRNW --template react-native@latest
  npx react-native-windows-init --overwrite
  ```
- [ ] 验证 Windows 11 SDK 和 Visual Studio 2022 配置

### 阶段 1: RNW 基础架构（3-5 天）

- [ ] 创建 monorepo 结构（复用 `packages/core`、`packages/server`）
  ```
  packages/
  ├── core/          # Agent 核心（保留）
  ├── server/        # Express backend（保留）
  ├── rnw-app/       # React Native for Windows 应用（新建）
  └── shared/        # 共享类型（保留）
  ```
- [ ] 实现基础 UI 框架
  - 主窗口布局（侧边栏 + 聊天区 + 任务面板）
  - 导航系统（@react-navigation/native）
  - Zustand 状态管理
- [ ] 集成 React Query（复用 WebUI 的 API 层代码）
- [ ] 连接 Express backend（HTTP API + SSE）

### 阶段 2: Computer Use 集成（5-7 天）

- [ ] **方案 B 快速实现**（优先）
  - 创建 Node.js 子进程封装 `@computer-use/nut-js`
  - 实现 IPC 接口：`screenshot()`、`moveMouse(x, y)`、`click()`、`type(text)`
  - 集成 Vision LLM（OpenAI GPT-4 Vision 或 Claude 3.7 Sonnet）
  - 实现基础 GUI Agent 循环：截图 → VLM 分析 → 动作解析 → 执行
- [ ] **方案 A 原生优化**（后续）
  - 编写 TurboModule（C++/C# 封装 Windows API）
  - 性能测试：对比方案 A vs B 的延迟
  - 逐步迁移高频操作（截图、鼠标）到 TurboModule

### 阶段 3: Agent 架构重构（7-10 天）

- [ ] 实现主 Agent + 子 Agent 架构
  - 创建 Agent 注册表（`packages/core/agents/registry.ts`）
  - 实现 Computer Use Agent（GUI 操作专家）
  - 实现 Code Agent（代码编辑专家）
  - 实现 Research Agent（搜索总结专家）
- [ ] Agent 间通信
  - 设计 SQLite 事件表 schema
    ```sql
    CREATE TABLE agent_messages (
      id INTEGER PRIMARY KEY,
      from_agent TEXT NOT NULL,
      to_agent TEXT NOT NULL,
      type TEXT NOT NULL,     -- 'task' | 'result' | 'query'
      payload TEXT NOT NULL,  -- JSON
      status TEXT NOT NULL,   -- 'pending' | 'processing' | 'done'
      created_at INTEGER NOT NULL,
      processed_at INTEGER
    );
    CREATE INDEX idx_to_agent_status ON agent_messages(to_agent, status);
    ```
  - 实现消息队列和路由
- [ ] 任务分解与调度
  - 主 Agent 将复杂任务分解为子任务
  - 并行执行子任务（参考 trae-agent）
  - 结果聚合与摘要

### 阶段 4: 技能系统（5-7 天）

- [ ] 技能创建
  - 任务完成后自动提示生成技能
  - 技能模板：`skills/*.skill.md`
    ```markdown
    # Skill: 部署到 Vercel
    
    ## Trigger
    User asks to deploy a Next.js app to Vercel
    
    ## Steps
    1. Check if `vercel.json` exists
    2. Run `vercel --prod`
    3. Verify deployment URL
    
    ## Tools
    - bash
    - web_fetch (验证部署)
    
    ## Error Handling
    - 403 Forbidden → Check VERCEL_TOKEN env var
    - Build failed → Check build logs
    ```
- [ ] 技能检索
  - 基于任务描述的语义搜索（FTS5 + LLM Embedding）
  - 匹配度评分（0-1）
- [ ] 技能执行与改进
  - 执行技能步骤并记录结果
  - 失败时自动分析根因并更新技能
- [ ] 跨会话记忆
  - FTS5 搜索历史对话
  - LLM 摘要相关知识

### 阶段 5: MCP 集成（3-5 天）

- [ ] 在 Express backend 实现 MCP Manager
  - 参考 cherry-studio 的 `src/main/ai/mcp/MCPServerManager.ts`
  - 支持动态启停 MCP Server
  - 配置持久化到 SQLite
- [ ] 集成关键 MCP Server
  - `windows-computer-use-mcp`（Computer Use 工具）
  - `@modelcontextprotocol/server-playwright`（浏览器自动化）
  - `@modelcontextprotocol/server-filesystem`（文件系统访问）
- [ ] RNW 前端调用 MCP 功能
  - HTTP API: `POST /api/mcp/call-tool`
  - SSE: `GET /api/mcp/stream`

### 阶段 6: 打磨与测试（5-7 天）

- [ ] UI/UX 优化
  - 实时 Computer Use 预览（显示 Agent 正在操作的区域）
  - 任务进度可视化
  - 错误处理和重试
- [ ] 性能优化
  - 截图压缩（降低 Vision LLM 延迟）
  - 并发控制（限制同时运行的子 Agent 数量）
  - 内存管理（定期清理历史消息）
- [ ] 集成测试
  - Computer Use 循环测试
  - 多 Agent 协作测试
  - MCP Server 崩溃恢复测试
- [ ] 文档
  - 架构文档
  - API 文档
  - 用户手册

---

## 关键风险与缓解

### 风险 1: React Native for Windows Computer Use 实现难度高

**影响**: 延期 2-4 周  
**概率**: 中  
**缓解**:
- 先用方案 B（Node.js 子进程）快速验证
- 并行学习 TurboModule 开发
- 寻找社区现有方案（robotjs、@jitsi/robotjs）

### 风险 2: 磁盘空间不足导致 AionUi 未克隆

**影响**: 缺少 Team Mode 参考实现  
**概率**: 已发生  
**缓解**:
- 使用 awesome-openclaw-agents 的 205 个 Agent 模板作为替代参考
- 参考 trae-agent 的子 Agent 并行执行模式
- 查阅 AionUi 的 GitHub Issues 和文档（无需克隆完整仓库）

### 风险 3: React Native 生态缺少桌面应用最佳实践

**影响**: 踩坑时间增加  
**概率**: 中  
**缓解**:
- 参考 Microsoft 官方示例：[react-native-windows-samples](https://github.com/microsoft/react-native-windows-samples)
- 研究其他 RNW 桌面应用：[Fluent UI React Native](https://github.com/microsoft/fluentui-react-native)
- 必要时退回 Electron（保留后路）

---

## 下一步行动

1. **泽川决策点**: 确认 React Native for Windows 重构路线（vs 其他方案）
2. **环境搭建**: 安装 RNW 开发环境（Node 24 + Visual Studio 2022 + Windows 11 SDK）
3. **POC 验证**: 创建最小 RNW 应用 + 调用 nut-js（验证方案 B 可行性）
4. **架构设计**: 细化 monorepo 结构和模块边界
5. **开始实施**: 按阶段 1-6 路线图推进

---

**研究完成时间**: 2026-07-21 23:XX  
**文档版本**: 1.0  
**作者**: 小氧 (OxygenClaw Coding Assistant)
