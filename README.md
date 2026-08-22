# OxygenClaw

> Next-gen AI Agent Platform integrating TinyClaw, EdgeClaw, NanoClaw, StepClaw, OpenHands & UI-TARS
> 
> **Multi-Model Switching** | **MCP Protocol** | **Material 3 WebUI** | **Container Isolation**

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/oxygen-claw/oxygen-claw)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## 🚀 Features

### Core Capabilities
- **Multi-Model Switching** - Seamlessly switch between LLMs using standard names (e.g., `gpt-4o`, `claude-3.5-sonnet`)
- **MCP Protocol Support** - Connect to any MCP server (stdio, streamable-http, sse)
- **Three Agent Modes** - Quick (L1), Expert (L3), Task (L4-L5 with MoA)
- **Container Isolation** - Secure agent execution in Docker containers (NanoClaw-inspired)
- **Edge-Cloud Collaboration** - Three-tier data security (S1/S2/S3) (EdgeClaw-inspired)
- **GUI Agent Support** - Computer use and desktop automation (UI-TARS-inspired)

### Model Management
- **Standard Model Names** - Canonical names for 8+ popular LLMs
- **Alias Support** - Multiple names for the same model (e.g., `gpt4o` = `gpt-4o`)
- **JSON Import** - Batch import models with full configuration
- **Keyword Search** - Find models by provider, capability, or keywords
- **Model Groups** - Pre-defined groups (Reasoning, Coding, Fast, Vision, Chinese)
- **Usage History** - Track recently used models

### Supported Models

| Model | Provider | Context | Vision | Tools | Cost/1K |
|-------|----------|---------|--------|-------|---------|
| GPT-4o | OpenAI | 128K | ✓ | ✓ | $0.005 |
| Claude 3.5 Sonnet | Anthropic | 200K | ✓ | ✓ | $0.003 |
| Gemini 2.5 Pro | Google | 1M | ✓ | ✓ | $0.00125 |
| Step 3.5 Flash | StepFun | 128K | ✓ | ✓ | $0.0001 |
| DeepSeek V3 | DeepSeek | 64K | ✗ | ✓ | $0.00027 |
| Qwen 2.5 72B | Alibaba | 32K | ✓ | ✓ | $0.0004 |
| Llama 3.1 405B | Meta | 128K | ✓ | ✓ | $0.0008 |
| Mistral Large | Mistral | 32K | ✓ | ✓ | $0.002 |

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/oxygen-claw/oxygen-claw.git
cd oxygen-claw

# Install dependencies
npm install

# Build packages
npm run build
```

## 🎯 Quick Start

### CLI Usage

```bash
# Initialize a new project
oxygen-claw init --template advanced

# Switch to a model
oxygen-claw models --switch gpt-4o

# Run a task
oxygen-claw run "Research AI trends 2025" --mode expert

# Run with specific model
oxygen-claw run "Write code" --switch-model claude-3.5-sonnet

# Manage MCP servers
oxygen-claw mcp --add '{"id":"fs","transport":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/path"]}'

# Start gateway
oxygen-claw gateway --start
```

### Model Switching

```bash
# Switch by standard name
oxygen-claw models --switch gpt-4o

# Switch by alias
oxygen-claw models --switch gpt4o
oxygen-claw models --switch claude-3-5-sonnet

# Find model by keywords
oxygen-claw models --match "vision coding"

# Show current model
oxygen-claw models --current

# Show usage history
oxygen-claw models --history
```

### WebUI

```bash
# Start development server
cd packages/webui
npm run dev

# Open browser
# Navigate to http://localhost:5173
```

## 🏗️ Architecture

```
oxygen-claw/
├── packages/
│   ├── core/              # Core engine
│   │   ├── src/
│   │   │   ├── types.ts           # Type definitions
│   │   │   ├── agent.ts           # Agent orchestrator
│   │   │   ├── cognition/odc.ts   # ODC dynamic cognition
│   │   │   ├── memory/omm.ts      # OMM hierarchical memory
│   │   │   ├── mcp/client.ts      # MCP client implementation
│   │   │   ├── containers/manager.ts  # Docker container management
│   │   │   └── models/registry.ts # Model registry & switching
│   │   └── package.json
│   │
│   ├── cli/               # Command-line interface
│   │   ├── src/
│   │   │   ├── index.ts           # CLI entry point
│   │   │   └── commands/          # Command implementations
│   │   │       ├── init.ts
│   │   │       ├── run.ts
│   │   │       ├── config.ts
│   │   │       ├── mcp.ts
│   │   │       ├── models.ts      # Model management & switching
│   │   │       └── gateway.ts
│   │   └── package.json
│   │
│   ├── webui/             # Material 3 WebUI
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Models.tsx     # Model switching UI
│   │   │   │   ├── Tasks.tsx
│   │   │   │   ├── MCP.tsx
│   │   │   │   └── Settings.tsx
│   │   │   └── components/
│   │   └── package.json
│   │
│   ├── gateway/           # Smart routing & API management
│   │   ├── router.ts      # Model routing & switching
│   │   └── package.json
│   │
│   └── shared/            # Shared utilities
│       ├── src/
│       │   ├── types.ts
│       │   ├── icons.ts   # Model icons & name matching
│       │   └── constants.ts
│       └── package.json
│
├── docs/                  # Documentation
├── scripts/               # Build and deployment scripts
├── examples/              # Example configurations
│   └── models.json        # Example model configurations
├── MULTI_MODEL_SWITCHING.md
└── README.md
```

## 🔄 Multi-Model Switching

OxygenClaw 的核心创新之一是多模型无缝切换：

### Standard Model Names

每个模型都有唯一的**标准名称**，用于精确切换：

```typescript
// 标准名称示例
const standardNames = [
  'gpt-4o',           // OpenAI
  'claude-3.5-sonnet', // Anthropic
  'gemini-2.5-pro',    // Google
  'step-3.5-flash',    // StepFun
  'deepseek-v3',       // DeepSeek
  'qwen-2.5-72b',      // Alibaba
  'llama-3.1-405b',    // Meta
  'mistral-large'      // Mistral
];
```

### Aliases

每个标准名称可以有多个别名：

```typescript
// 示例：gpt-4o 的别名
const aliases = ['gpt4o', 'gpt-4', 'gpt4', 'openai-gpt-4o'];

// 都可以切换到同一个模型
registry.switchModel({ modelName: 'gpt-4o' });
registry.switchModel({ modelName: 'gpt4o' });
registry.switchModel({ modelName: 'gpt-4' });
```

### Model Registry

```typescript
import { createModelRegistry, suggestModelNames, normalizeModelName } from '@oxygen-claw/core';

const registry = createModelRegistry();

// 注册模型
registry.registerModel({
  id: 'my-model',
  name: 'gpt-4o',           // 标准名称
  displayName: 'GPT-4o',
  provider: 'OpenAI',
  // ... other config
  aliases: ['gpt4o', 'gpt-4']  // 别名
});

// 切换模型
registry.switchModel({ modelName: 'gpt-4o' });

// 获取建议
const suggestions = suggestModelNames('gpt');
// ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']

// 标准化名称
normalizeModelName('gpt4o');  // 'gpt-4o'
normalizeModelName('gpt-4');  // 'gpt-4o'
```

## 🧠 ODC Dynamic Cognition

Five cognitive levels with confidence-gated early exit:

| Level | Name | Use Case | Web Searches |
|-------|------|----------|--------------|
| L1 | Fast Response | Simple queries | 1 |
| L2 | Step-by-Step | Structured tasks | 2-3 |
| L3 | Reflective | Complex analysis | 10 |
| L4 | Multi-Path | Parallel exploration | 5 |
| L5 | Collaborative | MoA multi-agent | 5 |

## 💾 OMM Hierarchical Memory

- **TLB Hot-Page Cache** - 70%+ hit rate for fast access
- **Pointer-Linked Associations** - Natural knowledge graph formation
- **Cross-Page Merging** - Combine related memories
- **Version Control** - Track memory changes

## 🔌 MCP Integration

```bash
# Add filesystem server
oxygen-claw mcp --add '{
  "id": "fs",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
}'

# Add GitHub server
oxygen-claw mcp --add '{
  "id": "github",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"]
}'

# Add Brave Search
oxygen-claw mcp --add '{
  "id": "search",
  "transport": "streamable-http",
  "url": "https://api.search.brave.com/res/v1/web/search"
}'
```

## 🎨 Material 3 WebUI

- **Dynamic Color Theming** - Automatic light/dark mode
- **Responsive Design** - Works on desktop, tablet, mobile
- **Dashboard** - Real-time stats and monitoring
- **Model Management** - Visual model switching interface
- **Task Tracking** - Monitor agent execution
- **MCP Management** - Server and tool visualization

## 🐳 Container Isolation

Inspired by NanoClaw, each agent runs in an isolated Docker container:

```typescript
const container = await containerManager.createAgentContainer({
  image: 'oxygen-claw/agent:latest',
  resourceLimits: {
    cpu: '1',
    memory: '2g',
    pids: 100
  },
  networkMode: 'bridge'
});
```

## 🌐 Edge-Cloud Collaboration

Inspired by EdgeClaw, three-tier data security:

- **S1 (Public)** - Can be processed in cloud
- **S2 (Sensitive)** - Requires anonymization
- **S3 (Private)** - Must stay local

## 📊 Cost Optimization

Smart routing selects the most cost-effective model:

```typescript
const model = router.selectModel({
  prompt: "Write a simple function",
  requiresVision: false,
  requiresTools: true,
  maxTokens: 4096,
  budget: 0.01  // Prefer cheaper models
});
// Result: step-3.5-flash ($0.0001/1K) instead of gpt-4o ($0.005/1K)
```

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- **TinyClaw** - Lightweight CLI architecture
- **EdgeClaw** - Edge-cloud collaboration & security
- **NanoClaw** - Container isolation
- **StepClaw** - Cloud deployment patterns
- **OpenHands** - Multi-platform agent framework
- **UI-TARS** - GUI agent capabilities

---

Built with ❤️ by the OxygenClaw Team
