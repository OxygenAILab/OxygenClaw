# OxygenClaw React Native for Windows 实施计划

**日期**: 2026-07-21  
**版本**: 1.0  
**负责人**: 小氧 + 泽川

---

## 项目状态

### ✅ 已完成
1. **需求调研**: 8个仓库深度研究（详见 `docs/DEEP_RESEARCH_REPORT.md`）
2. **环境确认**: VS2026 + Windows SDK + Node.js 24 已就绪
3. **RN项目创建**: `C:\OxygenClawRNW` 初始化中
4. **技术方案**: 确定基于 React Native for Windows 0.76

### 🔄 进行中
- npm install 依赖安装（后台运行）

### ⏳ 待启动
- RNW 初始化
- Computer Use 集成
- Agent 架构重构
- MCP 集成

---

## 技术栈确认（基于研究报告）

### 核心框架
```json
{
  "react": "18.3.1",
  "react-native": "0.76.5",
  "react-native-windows": "^0.76.0"
}
```

### 状态管理 & 数据同步
- **Zustand** — 轻量级状态管理（学习 cherry-studio / UI-TARS）
- **React Query 5** — 服务端状态同步（复用 WebUI 已有代码）

### Computer Use 实现
**方案 B（快速验证）**: Node.js 子进程 + nut-js
```json
{
  "@computer-use/nut-js": "^4.2.0",
  "screenshot-desktop": "^1.15.0",
  "sharp": "^0.33.0"
}
```

**方案 A（长期优化）**: TurboModule + Windows API
- 自定义 C++/C# 模块封装 SendInput / GetCursorPos / BitBlt

### Agent 架构
```json
{
  "@modelcontextprotocol/sdk": "^1.27.0",
  "better-sqlite3": "^11.0.0",
  "drizzle-orm": "^0.36.0"
}
```

### Backend（保留现有）
- Express 4 + TypeScript
- better-sqlite3（已迁移完成）
- SSE 支持（已实现）

---

## 实施路线图

### Phase 0: RNW 基础搭建（1-2 天）✅ 进行中

**目标**: 完成 React Native for Windows 初始化并验证编译

**任务清单**:
- [x] 创建 RN 项目
- [x] 配置兼容的依赖版本（RN 0.76 + RNW 0.76）
- [ ] 运行 `npx react-native-windows-init --overwrite`
- [ ] 首次编译验证：`npx react-native run-windows`
- [ ] 验证 VS2026 C++ 工具链正常工作

**验收标准**:
- RNW 应用能成功编译并启动
- 显示默认 "Welcome to React Native" 界面

---

### Phase 1: 项目结构整合（2-3 天）

**目标**: 将 OxygenClaw 现有 backend 与 RNW 前端打通

**任务清单**:

#### 1.1 Monorepo 整合
```bash
oxygen-claw/
├── packages/
│   ├── core/          # Agent 核心（保留）
│   ├── server/        # Express backend（保留）
│   ├── rnw-app/       # RNW 前端（新建，从 C:\OxygenClawRNW 迁移）
│   ├── shared/        # 共享类型（保留）
│   └── gateway/       # 路由网关（保留）
```

#### 1.2 复用 WebUI 的 API 层
- 复制 `packages/webui/src/api/` 到 `packages/rnw-app/src/api/`
- 适配 React Native 环境（axios 配置、localStorage → AsyncStorage）

#### 1.3 集成 React Query
- 复制 `packages/webui/src/features/` 的 hooks
- 适配 RN 组件（View、Text、FlatList 等）

#### 1.4 基础 UI 框架
- 安装 React Navigation
- 创建主布局：侧边栏 + 聊天区 + 任务面板
- 使用 react-native-paper（Material Design 组件）

**验收标准**:
- RNW 应用能连接到 Express backend
- 显示会话列表（来自 `/api/conversations`）
- 发送消息并接收 SSE 流式响应

---

### Phase 2: Computer Use 集成（5-7 天）

**目标**: 实现基于 nut-js 的 Computer Use 功能（方案 B）

#### 2.1 Node.js 子进程封装
参考研究报告第 3 节，创建 `packages/computer-use-service/`:

```typescript
// packages/computer-use-service/src/index.ts
import nutjs from '@computer-use/nut-js';
import screenshot from 'screenshot-desktop';

interface ComputerUseAPI {
  screenshot(): Promise<Buffer>;
  moveMouse(x: number, y: number): Promise<void>;
  click(button: 'left' | 'right' | 'middle'): Promise<void>;
  type(text: string): Promise<void>;
  keyPress(key: string): Promise<void>;
}

// 通过 IPC (stdio) 与 RNW 通信
process.on('message', async (msg) => {
  // 处理 RNW 发来的命令
});
```

#### 2.2 RNW 桥接
```typescript
// packages/rnw-app/src/services/ComputerUseClient.ts
import { spawn } from 'child_process';

class ComputerUseClient {
  private worker: ChildProcess;
  
  constructor() {
    this.worker = spawn('node', [
      require.resolve('@oxygenclaw/computer-use-service')
    ]);
  }
  
  async screenshot(): Promise<string> {
    // 发送命令到子进程
    // 接收 base64 截图
  }
}
```

#### 2.3 Vision LLM 集成
- 集成 OpenAI GPT-4 Vision / Claude 3.7 Sonnet
- 实现截图 → Vision LLM → 动作解析流程
- 参考 UI-TARS-desktop 的 Action Parser（研究报告 3.3 节）

#### 2.4 GUI Agent 循环
```typescript
async function runGUIAgent(instruction: string) {
  while (true) {
    // 1. 截图
    const screenshot = await computerUse.screenshot();
    
    // 2. 发送给 Vision LLM
    const action = await visionLLM.analyze(screenshot, instruction);
    
    // 3. 解析动作
    const { type, x, y, text } = parseAction(action);
    
    // 4. 执行
    if (type === 'click') await computerUse.click(x, y);
    if (type === 'type') await computerUse.type(text);
    
    // 5. 检查任务完成
    if (action.done) break;
  }
}
```

**验收标准**:
- 能截取当前屏幕
- 能通过坐标点击鼠标
- 能输入文本
- Vision LLM 能正确解析界面元素
- 完成简单任务（如"打开记事本并输入 Hello World"）

---

### Phase 3: Team Mode 架构（7-10 天）

**目标**: 实现 Leader + Teammates 多 Agent 协作

#### 3.1 Agent 注册表
参考研究报告第 2 节（AionUi 架构）：

```typescript
// packages/core/src/agents/registry.ts
interface AgentDefinition {
  id: string;
  name: string;
  type: 'leader' | 'teammate';
  capabilities: string[];
  modelConfig: ModelConfig;
}

class AgentRegistry {
  private agents = new Map<string, AgentDefinition>();
  
  register(agent: AgentDefinition): void;
  get(id: string): AgentDefinition | undefined;
  findByCapability(cap: string): AgentDefinition[];
}
```

#### 3.2 专业化 Agent 实现
- **Computer Use Agent**: GUI 操作专家
- **Code Agent**: 代码编辑、测试专家
- **Research Agent**: 搜索、总结专家
- **DevOps Agent**: 部署、监控专家

#### 3.3 SQLite 通信表
参考研究报告第 5.2 节：

```sql
CREATE TABLE agent_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  type TEXT NOT NULL,     -- 'task' | 'result' | 'query'
  payload TEXT NOT NULL,  -- JSON
  status TEXT NOT NULL,   -- 'pending' | 'processing' | 'done'
  created_at INTEGER NOT NULL,
  processed_at INTEGER
);

CREATE INDEX idx_to_agent_status 
ON agent_messages(to_agent, status) 
WHERE status = 'pending';
```

#### 3.4 Leader 调度逻辑
```typescript
class LeaderAgent {
  async executeTask(instruction: string) {
    // 1. 分解任务
    const subtasks = await this.decomposeTask(instruction);
    
    // 2. 分配给 Teammates
    const promises = subtasks.map(async (task) => {
      const teammate = this.findBestTeammate(task);
      return this.delegateTask(teammate, task);
    });
    
    // 3. 并行执行
    const results = await Promise.all(promises);
    
    // 4. 聚合结果
    return this.aggregateResults(results);
  }
}
```

**验收标准**:
- Leader 能正确分解复杂任务
- Teammates 能并行执行子任务
- 结果能正确聚合并报告
- 完成跨Agent协作场景（如"搜索 React 教程 + 创建示例项目"）

---

### Phase 4: 技能系统（5-7 天）

**目标**: 实现技能学习循环（参考 hermes-agent）

#### 4.1 技能文件格式
参考研究报告第 4.2 节：

```markdown
---
name: deploy-to-vercel
description: Deploy a Next.js app to Vercel
version: 1.0.0
author: oxygen-claw
platforms:
  - windows
  - macos
  - linux
tags:
  - deployment
  - vercel
  - nextjs
---

# Deploy to Vercel

## Steps

1. Check if `vercel.json` exists
2. Run `vercel --prod`
3. Verify deployment URL

## Tools Required

- bash
- web_fetch

## Error Handling

- 403 Forbidden → Check VERCEL_TOKEN env var
- Build failed → Check build logs
```

#### 4.2 技能加载器
```typescript
// packages/core/src/skills/loader.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  platforms: string[];
  tags: string[];
}

class SkillLoader {
  async loadSkill(filePath: string): Promise<Skill> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data, content: markdown } = matter(content);
    
    return {
      metadata: data as SkillMetadata,
      steps: this.parseSteps(markdown),
      tools: this.extractTools(markdown),
    };
  }
  
  async discoverSkills(dir: string): Promise<Skill[]> {
    const files = await this.findSkillFiles(dir);
    return Promise.all(files.map(f => this.loadSkill(f)));
  }
}
```

#### 4.3 FTS5 检索
```sql
CREATE VIRTUAL TABLE skills_fts USING fts5(
  name,
  description,
  content,
  tags,
  tokenize = 'porter unicode61'
);

-- 搜索示例
SELECT * FROM skills_fts 
WHERE skills_fts MATCH 'deploy OR vercel OR nextjs' 
ORDER BY rank 
LIMIT 10;
```

#### 4.4 技能改进机制
- 执行后收集用户反馈（👍/👎）
- 失败时分析根因并更新步骤
- 版本号自增（1.0.0 → 1.0.1）

**验收标准**:
- 能发现并加载 `skills/*.skill.md`
- FTS5 搜索返回相关技能
- 执行技能并记录结果
- 失败后能自动改进技能

---

### Phase 5: MCP 集成（3-5 天）

**目标**: 在 Express backend 实现 MCP Manager

#### 5.1 MCP Server Manager
参考研究报告第 3.1 节（cherry-studio 实现）：

```typescript
// packages/server/src/services/mcp/manager.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { spawn, ChildProcess } from 'child_process';

interface MCPServerConfig {
  id: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  transport: 'stdio' | 'sse';
}

class MCPServerManager {
  private servers = new Map<string, ChildProcess>();
  private clients = new Map<string, Client>();
  
  async start(config: MCPServerConfig): Promise<void> {
    // 1. spawn 子进程
    const proc = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
    });
    
    // 2. 创建 MCP Client
    const client = new Client({
      name: 'oxygenclaw',
      version: '1.0.0',
    }, {
      capabilities: {},
    });
    
    // 3. 连接到 stdio
    await client.connect(new StdioClientTransport({
      command: config.command,
      args: config.args,
    }));
    
    this.servers.set(config.id, proc);
    this.clients.set(config.id, client);
    
    // 4. 监听崩溃并自动重启
    proc.on('exit', () => this.restart(config));
  }
  
  async callTool(serverId: string, toolName: string, args: any) {
    const client = this.clients.get(serverId);
    return client.callTool({ name: toolName, arguments: args });
  }
}
```

#### 5.2 集成关键 MCP Server
- `@modelcontextprotocol/server-filesystem` — 文件访问
- `@modelcontextprotocol/server-playwright` — 浏览器自动化
- `windows-computer-use-mcp` — Computer Use（补充 nut-js）

#### 5.3 RNW 调用接口
```typescript
// RNW 前端调用示例
const response = await fetch('http://localhost:3000/api/mcp/call-tool', {
  method: 'POST',
  body: JSON.stringify({
    serverId: 'filesystem',
    toolName: 'read_file',
    args: { path: 'C:\\test.txt' },
  }),
});
```

**验收标准**:
- MCP Server 能启动并响应工具调用
- 崩溃后能自动重启
- RNW 前端能通过 HTTP API 调用 MCP 工具
- 支持至少 3 个 MCP Server

---

### Phase 6: 打磨与测试（5-7 天）

#### 6.1 UI/UX 优化
- Computer Use 实时预览（高亮当前操作区域）
- 任务进度可视化（步骤树）
- 错误提示和重试按钮

#### 6.2 性能优化
- 截图压缩（降低 Vision LLM 延迟）
- 并发控制（最多 N 个并行 Agent）
- 内存管理（定期清理历史消息）

#### 6.3 集成测试
- Computer Use 循环测试
- 多 Agent 协作测试
- MCP Server 崩溃恢复测试

#### 6.4 文档
- 架构文档
- API 文档
- 用户手册

**验收标准**:
- 所有核心功能通过测试
- 性能指标达标（截图 <500ms、LLM 响应 <5s）
- 文档完整

---

## 里程碑时间表

| Phase | 任务 | 预计时长 | 累计时间 |
|-------|------|---------|---------|
| Phase 0 | RNW 基础搭建 | 1-2 天 | 2 天 |
| Phase 1 | 项目整合 | 2-3 天 | 5 天 |
| Phase 2 | Computer Use | 5-7 天 | 12 天 |
| Phase 3 | Team Mode | 7-10 天 | 22 天 |
| Phase 4 | 技能系统 | 5-7 天 | 29 天 |
| Phase 5 | MCP 集成 | 3-5 天 | 34 天 |
| Phase 6 | 打磨测试 | 5-7 天 | **41 天** |

**预计总工期**: 6-7 周（约 1.5 个月）

---

## 关键风险与缓解

### 风险 1: React Native Windows 兼容性问题
**影响**: 延期 1-2 周  
**概率**: 中  
**缓解**:
- Phase 0 立即验证 RNW 编译和运行
- 准备回退到 Electron 方案

### 风险 2: nut-js 性能不足
**影响**: Computer Use 延迟高（>1s）  
**概率**: 中  
**缓解**:
- Phase 2 早期进行性能测试
- 准备 TurboModule 方案（方案 A）

### 风险 3: Vision LLM 成本过高
**影响**: 运营成本增加  
**概率**: 高  
**缓解**:
- 实现截图缓存（相似截图不重复调用）
- 支持本地 Vision 模型（Qwen-VL 等）

### 风险 4: 磁盘空间不足
**影响**: 开发中断  
**概率**: 中（C 盘仅剩 6.46 GB）  
**缓解**:
- 定期清理 npm cache、node_modules
- 将大文件存储到外置硬盘

---

## 下一步行动

### 立即执行（今日）
1. ✅ 等待 npm install 完成
2. 运行 `npx react-native-windows-init --overwrite`
3. 首次编译：`npx react-native run-windows`
4. 验证 Hello World 界面

### 本周目标（Phase 0 完成）
- RNW 应用成功启动
- 修改默认界面显示 "OxygenClaw"
- 截图确认编译成功

### 下周规划（Phase 1 启动）
- Monorepo 整合
- 复用 WebUI API 层
- 连接 Express backend

---

**文档版本**: 1.0  
**最后更新**: 2026-07-21  
**作者**: 小氧 (OxygenClaw Coding Assistant)
