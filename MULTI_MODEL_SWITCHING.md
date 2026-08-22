# OxygenClaw Multi-Model Switching

OxygenClaw 支持通过**标准模型名称**或**别名**在多模型之间切换，实现灵活的任务分配和成本优化。

## 核心特性

### 1. 标准模型名称

每个模型都有唯一的**标准名称**（canonical name），用于精确切换：

| 标准名称 | 提供商 | 别名 |
|---------|--------|------|
| `gpt-4o` | OpenAI | gpt4o, gpt-4, gpt4 |
| `claude-3.5-sonnet` | Anthropic | claude-3-5-sonnet, claude-sonnet |
| `gemini-2.5-pro` | Google | gemini-2.5, gemini-pro |
| `step-3.5-flash` | StepFun | step-3.5, stepfun-3.5 |
| `deepseek-v3` | DeepSeek | deepseek-3 |
| `qwen-2.5-72b` | Alibaba | qwen-2.5, qwen-turbo |
| `llama-3.1-405b` | Meta | llama-3.1, llama3 |
| `mistral-large` | Mistral | mistral-large-latest |

### 2. 模型切换方式

#### CLI 方式

```bash
# 通过标准名称切换
oxygen-claw models --switch gpt-4o

# 通过别名切换
oxygen-claw models --switch gpt4o
oxygen-claw models --switch claude-3-5-sonnet

# 运行任务时指定模型
oxygen-claw run "Analyze data" --switch-model gpt-4o
oxygen-claw run "Write code" --switch-model claude-3.5-sonnet

# 查看当前模型
oxygen-claw models --current

# 查看模型历史
oxygen-claw models --history
```

#### JSON 导入多模型

```json
[
  {
    "id": "gpt-4o-custom",
    "name": "gpt-4o",
    "displayName": "GPT-4o (Custom)",
    "provider": "OpenAI",
    "apiKey": "sk-...",
    "baseUrl": "https://api.openai.com/v1",
    "maxTokens": 128000,
    "supportsVision": true,
    "supportsTools": true,
    "costPer1KInput": 0.005,
    "costPer1KOutput": 0.015,
    "icon": "🟢",
    "keywords": ["gpt", "openai", "4o"],
    "aliases": ["gpt4o", "gpt-4", "gpt4"]
  }
]
```

导入命令：
```bash
oxygen-claw models --import models.json
```

#### WebUI 方式

在 WebUI 的 Models 页面：
1. 点击 "Switch Model" 按钮
2. 输入模型名称（支持部分匹配）
3. 从建议列表中选择模型
4. 点击 "Switch to this model"

### 3. 智能名称匹配

OxygenClaw 支持模糊搜索和自动补全：

```bash
# 部分匹配
oxygen-claw models --match "gpt"      # 匹配 gpt-4o, gpt-4-turbo...
oxygen-claw models --match "claude"   # 匹配 claude-3.5-sonnet, claude-3-opus...
oxygen-claw models --match "step"     # 匹配 step-3.5-flash
oxygen-claw models --match "vision"   # 匹配所有支持视觉的模型
```

### 4. 模型组

预定义的模型组，方便快速切换：

```bash
# 查看模型组
oxygen-claw models --groups

# 模型组包括：
# - Reasoning: gpt-4o, claude-3.5-sonnet, deepseek-r1, gemini-2.5-pro
# - Coding: claude-3.5-sonnet, deepseek-v3, codestral
# - Fast: gpt-4o-mini, claude-3-haiku, gemini-1.5-flash, step-3.5-flash
# - Vision: gpt-4o, claude-3.5-sonnet, gemini-2.5-pro, llama-3.1-405b
# - Chinese: qwen-2.5-72b, deepseek-v3, step-3.5-flash, yi-1.5-34b
```

## API 使用

### Python

```python
from oxygen_claw import ModelRegistry, createModelRegistry

# 创建模型注册表
registry = createModelRegistry()

# 注册模型
registry.registerModel({
    "id": "my-model",
    "name": "gpt-4o",
    "displayName": "My GPT-4o",
    "provider": "OpenAI",
    "apiKey": "sk-...",
    "baseUrl": "https://api.openai.com/v1",
    "maxTokens": 128000,
    "supportsVision": True,
    "supportsTools": True,
    "keywords": ["gpt", "openai"]
})

# 切换模型
model = registry.switchModel({"modelName": "gpt-4o"})
print(f"Switched to: {model.displayName}")

# 通过别名切换
model = registry.switchModel({"modelName": "gpt4o"})

# 获取当前模型
current = registry.getActiveModel()
print(f"Current: {current.displayName}")

# 搜索模型
suggestions = suggestModelNames("gpt")
# Returns: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']
```

### TypeScript

```typescript
import { createModelRegistry, suggestModelNames, normalizeModelName } from '@oxygen-claw/core';

// 创建注册表
const registry = createModelRegistry();

// 切换模型
const result = registry.switchModel({ modelName: 'gpt-4o' });
console.log(`Switched to: ${result?.displayName}`);

// 模糊搜索
const suggestions = suggestModelNames('claude');
// Returns: ['claude-3.5-sonnet', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']

// 标准化名称
const normalized = normalizeModelName('gpt4o');
console.log(normalized); // 'gpt-4o'
```

## 模型切换事件

切换模型时会触发事件，可用于审计和日志：

```typescript
interface ModelSwitchEvent {
  fromModelId: string;
  fromModelName: string;
  toModelId: string;
  toModelName: string;
  reason: string;
  timestamp: Date;
  taskId?: string;
}
```

```bash
# 查看切换历史
oxygen-claw models --history
```

## 配置文件

在 `oxygen-claw.json` 中配置默认模型：

```json
{
  "agent": {
    "mode": "expert",
    "model": {
      "name": "gpt-4o",
      "provider": "OpenAI"
    }
  },
  "models": {
    "default": "gpt-4o",
    "history": ["claude-3.5-sonnet", "gemini-2.5-pro"],
    "favorites": ["gpt-4o", "step-3.5-flash"]
  }
}
```

## 最佳实践

1. **使用标准名称**：优先使用标准名称（如 `gpt-4o`）而非别名
2. **配置多个 API Key**：为不同提供商配置 API Key
3. **利用模型组**：根据任务类型选择合适的模型组
4. **监控成本**：通过 WebUI Dashboard 监控不同模型的成本
5. **版本管理**：在 JSON 导入时包含 `version` 字段追踪模型版本

## 故障排除

### 模型未找到

```bash
# 检查可用模型
oxygen-claw models --list

# 获取建议
oxygen-claw models --match "gpt"
```

### 别名冲突

如果多个模型有相同的别名，系统会使用第一个注册的模型。建议使用标准名称进行精确切换。

### API Key 配置

确保在导入模型时配置正确的 API Key：

```bash
# 设置环境变量
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```
