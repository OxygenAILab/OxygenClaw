# Handoff — Phase 1 Part 1-2 完成交接文档

**交接时间**: 2026-07-26  
**交接人**: 小氧 (OxygenClaw Coding Assistant)  
**项目**: OxygenClaw Electron UI — Phase 1 Part 1-2  
**状态**: ✅ IPC 架构 + SQLite 数据层已完整交付并验证通过

---

## 一、已完成工作概览

### Part 1: IPC 架构 (✅ 完成)

#### 1.1 类型安全的 IPC 通道定义
- **文件**: `src/shared/ipc-channels.ts`
- **内容**: 26 个通道常量，涵盖 6 大模块
  - Conversation: `CONVERSATION_LIST/GET/CREATE/DELETE`
  - Message: `MESSAGE_LIST/SEND`
  - Task: `TASK_LIST/GET/CANCEL`
  - Settings: `SETTINGS_GET/UPDATE`
  - MCP: `MCP_LIST/ADD/REMOVE/RESTART`
  - Database: `DB_QUERY/EXECUTE/TRANSACTION`

#### 1.2 完整的 TypeScript 类型系统
- **文件**: `src/shared/ipc-types.ts`
- **内容**:
  - 5 个核心实体类型: `Conversation`, `Message`, `Task`, `Settings`, `McpServer`
  - 12 个请求/响应类型: `*CreateRequest`, `*DeleteRequest`, `*ListRequest`, 等
  - 字段映射: DB snake_case ↔ TypeScript camelCase

#### 1.3 Main 进程 IPC 路由
- **文件**: `src/main/ipc/router.ts`
- **功能**:
  - 中央路由器注册所有 handler
  - 统一错误处理与日志输出
  - 支持 6 组 handler 动态注册

#### 1.4 Preload 层 API 暴露
- **文件**: `src/preload/index.ts`
- **功能**:
  - 通过 `contextBridge.exposeInMainWorld` 暴露类型安全 API
  - 白名单机制: 只暴露必需的 IPC 通道
  - 安全配置: `contextIsolation=true`, `nodeIntegration=false`

#### 1.5 Renderer 类型声明
- **文件**: `src/renderer/src/global.d.ts`
- **功能**:
  - 为 `window.api` 提供完整类型定义
  - 6 个命名空间: `conversation`, `message`, `task`, `settings`, `mcp`, `db`
  - IDE 自动补全与类型检查支持

#### 1.6 Handler 实现
**已实现**:
- `src/main/ipc/handlers/conversation.ts` — 完整 CRUD (list/get/create/delete)
- `src/main/ipc/handlers/message.ts` — list/send + 自动更新 conversation.updated_at
- `src/main/ipc/handlers/settings.ts` — get/update + JSON 序列化 + 默认值初始化
- `src/main/ipc/handlers/database.ts` — query/execute/transaction 通用接口

**桩代码 (Phase 2 实现)**:
- `src/main/ipc/handlers/task.ts` — list/get/cancel (返回空数组/null)
- `src/main/ipc/handlers/mcp.ts` — list/add/remove/restart (返回空数组/void)

---

### Part 2: SQLite + Drizzle 集成 (✅ 完成)

#### 2.1 数据库连接管理
- **文件**: `src/main/database/connection.ts`
- **功能**:
  - 单例模式: `getDatabase()` 返回全局唯一实例
  - WAL 模式: `PRAGMA journal_mode = WAL` (读写并发优化)
  - 外键约束: `PRAGMA foreign_keys = ON`
  - 参数归一化: `normalizeParams()` 处理 boolean→0/1, undefined→null, Date→timestamp
  - 生命周期: 启动时初始化，退出时 `closeDatabase()`
  - 数据目录: `{userData}/data/oxygenclaw.db`

#### 2.2 数据库 Schema
- **文件**: `src/main/database/schema.ts`
- **工具**: Drizzle ORM (仅用于类型定义，实际查询用 better-sqlite3 原生 SQL)
- **表结构**:
  1. **conversations**: id, title, model, created_at, updated_at
  2. **messages**: id, conversation_id (FK → conversations, ON DELETE CASCADE), role, content, created_at
     - 索引: `idx_messages_conversation`, `idx_messages_created`
  3. **tasks**: id, conversation_id (FK → conversations, ON DELETE SET NULL), type, status, result, error, created_at, updated_at
     - 索引: `idx_tasks_status`, `idx_tasks_conversation`
  4. **settings**: key (PK), value (JSON), updated_at
  5. **mcp_servers**: id, name, command, args (JSON), env (JSON), status, created_at, updated_at

#### 2.3 数据库迁移
- **文件**: `src/main/database/migrations.ts`
- **功能**:
  - `initializeSchema()`: 幂等 DDL，使用 `CREATE TABLE IF NOT EXISTS`
  - 索引创建: `CREATE INDEX IF NOT EXISTS`
  - 外键约束: 显式声明 FOREIGN KEY 与级联规则
  - 启动调用: `src/main/index.ts` 在 `app.whenReady()` 后立即执行

#### 2.4 数据层实现细节

**Conversation Handler**:
- `list()`: 按 `updated_at DESC` 排序
- `get(id)`: 单条查询，不存在返回 `null`
- `create(req)`: 生成 ID (`conv_${timestamp}_${random}`)，插入 DB
- `delete(req)`: 级联删除关联 messages (FK constraint)

**Message Handler**:
- `list(req)`: 按 `created_at ASC` 排序，过滤 `conversation_id`
- `send(req)`: 插入用户消息 + 更新 conversation.updated_at (TODO: Phase 2+ 调用 LLM 生成 assistant 回复)

**Settings Handler**:
- `get()`: 读取 `app_settings` key，首次启动插入默认值
- `update(req)`: 增量合并更新 (`{ ...current, ...req }`)，写回 DB
- 默认值:
  ```typescript
  {
    theme: 'system',
    language: 'zh-CN',
    defaultModel: 'claude-opus-4',
    apiKeys: {}
  }
  ```

**Database Handler**:
- `query(req)`: `stmt.all()` 返回结果集
- `execute(req)`: `stmt.run()` 返回 `{ changes, lastInsertRowid }`
- `transaction(req)`: 原子执行多条语句

---

## 二、验证结果

### 2.1 独立 DB 测试 (✅ 8/8 通过)
- **文件**: `test-db.js` (临时文件，可删除)
- **测试项**:
  1. 建表 (conversations/messages/settings)
  2. 插入对话
  3. 查询对话列表
  4. 插入消息 + 外键关联
  5. 查询消息列表
  6. 更新 conversation.updated_at
  7. 删除对话 + 级联删除 messages
  8. 设置读写 (JSON 序列化)

### 2.2 端到端 UI 测试 (✅ 6/6 通过)
- **文件**: `src/renderer/src/test-ipc.tsx`
- **运行方式**: `npm run dev` 后自动执行
- **测试项**:
  1. ✅ 创建对话 → 验证返回 ID
  2. ✅ 发送消息 → 验证插入成功
  3. ✅ 查询消息列表 → 验证返回 1 条
  4. ✅ 查询对话列表 → 验证包含新建对话
  5. ✅ 设置读写 → 验证 theme 更新为 dark
  6. ✅ 删除对话 → 验证级联删除，孤儿消息为 0

### 2.3 编译验证 (✅ 零错误)
- TypeScript 编译: 3 次完整构建通过
- ESLint: 无阻断性错误
- Vite dev server: 正常启动 (端口 5173/5174/5175)

---

## 三、技术亮点与架构决策

### 3.1 参数归一化
- **问题**: better-sqlite3 对参数类型严格，JS 的 `boolean` 和 `undefined` 会抛错
- **解决方案**: 在 `connection.ts` 的 `normalizeParams()` 单一入口处理
  - `boolean` → `0/1`
  - `undefined` → `null`
  - `Date` → `timestamp (milliseconds)`
- **优势**: 上层 handler 零改动，统一规范

### 3.2 外键级联
- **conversations → messages**: `ON DELETE CASCADE` (删除对话自动清理消息)
- **conversations → tasks**: `ON DELETE SET NULL` (删除对话后任务解绑)
- **验证**: UI 测试第 6 项确认级联删除生效

### 3.3 WAL 模式
- **配置**: `PRAGMA journal_mode = WAL`
- **优势**: 读写并发性能优化，适合 Electron 多进程场景

### 3.4 类型安全
- **端到端**: DB → Handler → IPC → Preload → Renderer 全程 TypeScript 守护
- **字段映射**: DB `snake_case` ↔ TS `camelCase` 在 handler 层统一转换

### 3.5 ID 生成策略
- **格式**: `${prefix}_${timestamp}_${random}`
- **示例**: `conv_1738012345678_a7b3k2m`
- **优势**: 时间戳排序 + 碰撞避免

---

## 四、如何运行与测试

### 4.1 开发环境要求
- **Node.js**: 24.15.0
- **npm**: 11.12.1
- **OS**: Windows 10/11 (x64)
- **Electron**: 43.2.0 (自动安装)

### 4.2 启动开发服务器
```bash
cd packages/electron-ui
npm run dev
```

**预期结果**:
- Electron 窗口自动打开
- 显示 "IPC + DB 端到端测试" 页面
- 6 个测试项自动运行，全部显示 ✅
- 底部显示 "🎉 全部测试通过！" 横幅

### 4.3 数据库位置
```
C:\Users\<用户名>\AppData\Roaming\oxygenclaw-electron\data\oxygenclaw.db
```

### 4.4 查看日志
- **Main 进程**: 控制台输出 (运行 `npm run dev` 的终端)
- **Renderer 进程**: Electron 开发者工具 (Ctrl+Shift+I)

---

## 五、已知限制与技术债务

### 5.1 桩代码 (Phase 2 实现)
- **Task Handler**: 当前返回空数组/null，Phase 2 实现任务调度
- **MCP Handler**: 当前返回空数组/void，Phase 2 集成 MCP Server 管理

### 5.2 Message Handler 不完整
- **当前**: 只插入用户消息，不调用 LLM
- **TODO**: Phase 2+ 集成 LLM API，生成 assistant 回复

### 5.3 日志系统缺失 (Phase 1 Part 3)
- **当前**: 使用 `console.log`，无结构化日志
- **TODO**: 实现 structured logging + 文件轮转 + renderer→IPC→file 路径

### 5.4 错误处理不完善 (Phase 1 Part 4)
- **当前**: 基础 try-catch + IPC 错误返回
- **TODO**: 
  - Main 进程: `uncaughtException/unhandledRejection` 全局捕获
  - Renderer 进程: React `ErrorBoundary`
  - IPC 错误: 统一错误码 + 用户友好提示

---

## 六、下一步工作 (Phase 1 Part 3-4)

### Part 3: 日志系统 (预计 1-2 天)
1. 引入 winston / pino 日志库
2. 配置文件轮转 (每日/大小限制)
3. Main 进程: 直接写文件
4. Renderer 进程: 通过 IPC 通道转发到 Main 写文件
5. 日志级别: DEBUG/INFO/WARN/ERROR
6. 日志目录: `{userData}/logs/main-YYYY-MM-DD.log`, `renderer-YYYY-MM-DD.log`

### Part 4: 错误处理 (预计 1-2 天)
1. Main 进程全局异常捕获:
   ```typescript
   process.on('uncaughtException', (error) => { /* log + graceful shutdown */ })
   process.on('unhandledRejection', (reason) => { /* log + warning */ })
   ```
2. IPC 错误包装:
   ```typescript
   interface IpcError {
     code: string
     message: string
     details?: unknown
   }
   ```
3. Renderer ErrorBoundary:
   ```tsx
   <ErrorBoundary fallback={<ErrorPage />}>
     <App />
   </ErrorBoundary>
   ```
4. 用户友好错误提示 (Toast/Dialog)

---

## 七、重要文件清单

### 核心架构文件
```
packages/electron-ui/
├── src/
│   ├── shared/
│   │   ├── ipc-channels.ts       # IPC 通道常量
│   │   └── ipc-types.ts          # TypeScript 类型定义
│   ├── main/
│   │   ├── index.ts              # Main 进程入口 (初始化 DB + IPC)
│   │   ├── database/
│   │   │   ├── connection.ts    # DB 连接管理 + normalizeParams
│   │   │   ├── schema.ts        # Drizzle ORM schema
│   │   │   └── migrations.ts    # 幂等 DDL
│   │   └── ipc/
│   │       ├── router.ts         # IPC 路由器
│   │       └── handlers/
│   │           ├── conversation.ts
│   │           ├── message.ts
│   │           ├── task.ts       # 桩代码
│   │           ├── settings.ts
│   │           ├── mcp.ts        # 桩代码
│   │           └── database.ts
│   ├── preload/
│   │   └── index.ts              # contextBridge API 暴露
│   └── renderer/
│       └── src/
│           ├── global.d.ts       # window.api 类型声明
│           ├── App.tsx           # 应用入口
│           └── test-ipc.tsx      # 端到端测试组件
├── package.json
├── electron.vite.config.ts
└── tsconfig.json
```

### 配置文件
- `electron.vite.config.ts`: Vite + Electron 构建配置，better-sqlite3 外部化
- `tsconfig.json`: TypeScript 项目引用 (node + web 环境分离)
- `package.json`: 依赖清单 (better-sqlite3@^13.0.1, drizzle-orm, electron@^43.2.0)

---

## 八、关键依赖版本

```json
{
  "electron": "^43.2.0",
  "better-sqlite3": "^13.0.1",
  "drizzle-orm": "^0.37.0",
  "electron-vite": "^2.3.0",
  "vite": "^5.4.11",
  "react": "^18.3.1",
  "typescript": "^5.8.3"
}
```

**重要**: 
- better-sqlite3 必须用 13.x (N-API 预编译二进制，无需本地编译)
- electron-vite 需要 vite ^4/^5 (不支持 vite 6)

---

## 九、常见问题与解决方案

### Q1: npm install 失败，better-sqlite3 下载超时
**A**: 使用国内镜像
```bash
npm install --registry=https://registry.npmmirror.com
```

### Q2: Electron 窗口启动报错 "Cannot read properties of undefined (reading 'whenReady')"
**A**: 检查环境变量污染
```bash
# Bash/Zsh
unset ELECTRON_RUN_AS_NODE

# PowerShell
Remove-Item Env:\ELECTRON_RUN_AS_NODE
```

### Q3: TypeScript 报错 "Cannot find module 'better-sqlite3'"
**A**: 确认 better-sqlite3 已在 `electron.vite.config.ts` 的 `external` 中声明
```typescript
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['better-sqlite3']
      }
    }
  }
})
```

### Q4: 数据库文件在哪里？
**A**: 
```javascript
// Main 进程
const { app } = require('electron')
const dbPath = path.join(app.getPath('userData'), 'data', 'oxygenclaw.db')
console.log(dbPath)
```

---

## 十、联系与支持

如有问题或需要澄清，请联系:
- **交接人**: 小氧 (OxygenClaw Coding Assistant)
- **项目负责人**: 泽川
- **文档位置**: `packages/electron-ui/Handoff.md`
- **更新日期**: 2026-07-26

---

**状态总结**: Phase 1 Part 1-2 已 100% 完成，所有验证通过，代码质量良好，可直接进入 Part 3 (日志系统) 或 Phase 2 (MCP 集成)。🎉
