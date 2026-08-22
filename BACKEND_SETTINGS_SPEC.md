# OxygenClaw 动态设置系统 — 后端协调文档

**受众**: GPT（后端开发者）  
**目的**: 定义前后端设置系统的契约，确保 schema 驱动、类型安全、可扩展。

---

## 1. 系统概述

OxygenClaw 的设置系统采用 **schema 驱动** 架构：

- **前端**：根据 `settingsSchema`（`packages/webui/src/settings/schema.ts`）动态渲染控件，无需为每个设置项手写 UI。
- **后端**：根据同一份 schema 进行**校验**、**持久化**、**迁移**。

新增设置项时，**只需在 schema 中声明**，前后端自动同步生效。

---

## 2. 核心文件

| 文件 | 职责 |
|------|------|
| `packages/webui/src/settings/types.ts` | TypeScript 类型定义（前后端共享） |
| `packages/webui/src/settings/schema.ts` | 设置 schema 数据（前后端共享） |
| `packages/webui/src/components/settings/SettingField.tsx` | 单个控件渲染器 |
| `packages/webui/src/components/settings/SchemaForm.tsx` | 表单渲染器（分组、条件显隐） |
| `packages/webui/src/i18n/zh.ts` & `en.ts` | i18n 翻译键（`settingsSchema.*`） |
| **后端待实现** | `settings.json` 存储、GET/PUT `/settings` API、校验逻辑 |

---

## 3. 后端需实现的 API

### 3.1 `GET /settings`

**功能**: 返回当前用户的所有设置值（扁平 key-value）。

**响应格式**:
```json
{
  "success": true,
  "data": {
    "theme": "system",
    "language": "zh",
    "fontSize": "normal",
    "temperature": 1.0,
    "visionEnabled": false,
    "visionApiKey": "sk-xxx",
    "autoStart": false,
    ...
  }
}
```

**说明**:
- 返回所有 `external: false` 的字段（`external: true` 的如 `theme`/`language` 由前端特殊处理，不存储在后端）。
- 未设置的字段返回 `schema` 中的 `default` 值。
- 敏感字段（`sensitive: true`）应**加密存储**，返回时解密。

---

### 3.2 `PUT /settings`

**功能**: 更新设置值（部分或全量）。

**请求体**:
```json
{
  "temperature": 1.2,
  "visionEnabled": true,
  "visionApiKey": "sk-new-key"
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    // 返回更新后的完整设置对象
  }
}
```

**校验要求**:
1. **类型校验**: 根据 `schema` 中的 `type` 检查值类型（`toggle` → boolean，`number` → number 等）。
2. **范围校验**: 
   - `validation.min/max` — 用于 `number`/`slider`。
   - `validation.pattern` — 用于 `text`/`url`（正则校验）。
   - `validation.required` — 必填项不可为空。
3. **选项校验**: `select`/`segmented` 的值必须在 `options` 列表中。
4. **敏感字段**: `sensitive: true` 的字段（如 API Key）需加密存储，日志脱敏。

**失败响应**:
```json
{
  "success": false,
  "error": "Validation failed: temperature must be between 0 and 2"
}
```

---

## 4. 存储格式

### 4.1 `settings.json` 结构

```json
{
  "version": 1,
  "userId": "user-123",
  "values": {
    "fontSize": "normal",
    "sidebarDensity": "compact",
    "temperature": 1.0,
    "maxTokens": 4096,
    "visionEnabled": false,
    "visionApiKey": "encrypted:aes256:xxxxx",
    "autoStart": false,
    "directModelAccess": false,
    ...
  },
  "updatedAt": "2026-07-04T12:34:56Z"
}
```

**说明**:
- `version` 字段用于 schema 迁移（未来 schema 升级时，后端根据 version 做数据迁移）。
- `userId` 关联用户（多用户场景）。
- 敏感字段值以 `encrypted:` 前缀标识加密存储。

---

## 5. Schema 版本迁移

当 `settingsSchema.version` 升级时（例如从 `1` → `2`），后端需实现迁移逻辑：

**示例场景**: 
- v1 有字段 `bubbleStyle`，v2 废弃改为 `messageStyle`。
- v2 新增字段 `enableWebSearch`，默认值 `false`。

**迁移伪代码**:
```typescript
function migrateSettings(data: any): SettingsValues {
  const schemaVersion = settingsSchema.version;
  const dataVersion = data.version || 1;

  if (dataVersion < schemaVersion) {
    // v1 → v2
    if (dataVersion === 1 && schemaVersion >= 2) {
      if (data.values.bubbleStyle) {
        data.values.messageStyle = data.values.bubbleStyle;
        delete data.values.bubbleStyle;
      }
      data.values.enableWebSearch = false; // 新增字段默认值
    }
    data.version = schemaVersion;
  }

  return data.values;
}
```

---

## 6. 控件类型与后端校验对照表

| 控件类型 (`type`) | 值类型 | 校验规则 |
|-------------------|--------|----------|
| `toggle` | `boolean` | — |
| `select` | `string \| number` | 值必须在 `options` 中 |
| `segmented` | `string \| number` | 值必须在 `options` 中 |
| `text` | `string` | `validation.pattern`（正则），`min/max`（长度） |
| `password` | `string` | 同 `text`，存储时加密 |
| `url` | `string` | URL 格式校验 |
| `number` | `number` | `validation.min/max` |
| `slider` | `number` | `validation.min/max/step` |
| `time` | `string` | `HH:mm` 格式 |
| `textarea` | `string` | 同 `text` |
| `color` | `string` | Hex 格式 `#RRGGBB` |
| `colorSwatch` | `string` | Hex 格式，值可能在 `options` 或自定义 |
| `kvList` | `Record<string,string>` | 键值对对象 |
| `action` | — | 不存储值 |
| `custom` | `any` | 根据具体实现校验 |

---

## 7. 敏感字段加密

**标记为 `sensitive: true` 的字段** 需加密存储、日志脱敏：

- `visionApiKey`
- `asrApiKey`
- `ttsApiKey`
- `imageGenApiKey`
- 其他所有 `type: 'password'` 的字段

**加密方案建议**:
- 使用 AES-256-GCM，密钥从环境变量 `SETTINGS_ENCRYPTION_KEY` 读取。
- 存储格式: `encrypted:aes256:<base64_ciphertext>`。
- 日志中脱敏: `visionApiKey: sk-****1234`（仅显示前缀+后4位）。

---

## 8. 条件显隐（`visibleWhen`）

前端根据 `visibleWhen` 条件动态隐藏字段，后端**无需主动处理**（前端不会发送隐藏字段的值）。但在校验时需注意：

**示例**: `visionApiKey` 的 `visibleWhen: [{ field: 'visionEnabled', truthy: true }]`  
→ 当 `visionEnabled: false` 时，前端不会提交 `visionApiKey`，后端不应报 required 错误。

**校验逻辑**:
```typescript
function isFieldVisible(field: FieldSchema, values: SettingsValues): boolean {
  if (!field.visibleWhen) return true;
  return field.visibleWhen.every(cond => {
    const depValue = values[cond.field];
    if (cond.truthy !== undefined) return cond.truthy ? Boolean(depValue) : !depValue;
    if (cond.equals) return cond.equals.includes(depValue);
    if (cond.notEquals) return !cond.notEquals.includes(depValue);
    return true;
  });
}

// 校验时跳过不可见字段
function validateSettings(values: SettingsValues): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const field of allFields) {
    if (!isFieldVisible(field, values)) continue; // 跳过隐藏字段
    // ... 执行校验
  }
  return errors;
}
```

---

## 9. External 字段（`external: true`）

以下字段由前端特殊 context 管理，**不应存储在后端 settings.json**：

- `theme` → ThemeContext
- `uiTheme` → ThemeContext
- `materialSeed` → ThemeContext
- `language` → i18n Context

后端应**忽略**这些字段的 PUT 请求，GET 时也不返回。

---

## 10. 新增设置项的工作流

1. **前端（Claude）**:
   - 在 `settingsSchema` 中添加字段定义。
   - 在 `i18n/zh.ts` 和 `en.ts` 中添加翻译键。
   - 无需改动渲染器代码。

2. **后端（GPT）**:
   - 更新 schema 副本（如果前后端代码分离）。
   - 在 `settings.json` 中新增字段的默认值。
   - 如需特殊校验逻辑，在校验器中扩展。

3. **测试**:
   - 前端渲染新控件 → 修改值 → PUT `/settings` → 刷新页面 → GET `/settings` 验证持久化。

---

## 11. 示例：新增「启用 Web 搜索」开关

### 11.1 前端修改

**`schema.ts`**:
```typescript
{
  id: 'system',
  groups: [
    {
      id: 'features',
      titleKey: 'settingsSchema.groups.features',
      fields: [
        {
          key: 'enableWebSearch',
          type: 'toggle',
          labelKey: 'settingsSchema.fields.enableWebSearch.label',
          descKey: 'settingsSchema.fields.enableWebSearch.desc',
          default: false,
        },
      ],
    },
  ],
}
```

**`zh.ts`**:
```typescript
settingsSchema: {
  groups: {
    features: '功能开关',
  },
  fields: {
    enableWebSearch: {
      label: '启用 Web 搜索',
      desc: '允许 AI 在回答时搜索互联网',
    },
  },
}
```

### 11.2 后端修改

**`settings.json` 默认值**:
```json
{
  "values": {
    ...
    "enableWebSearch": false
  }
}
```

**校验逻辑**:
```typescript
if (typeof values.enableWebSearch !== 'boolean') {
  throw new ValidationError('enableWebSearch must be boolean');
}
```

---

## 12. 测试清单

后端实现后，请确保以下测试通过：

- [ ] `GET /settings` 返回所有字段默认值（首次调用）
- [ ] `PUT /settings` 更新单个字段，`GET` 返回新值
- [ ] 超出 `min/max` 范围的值被拒绝（400 错误）
- [ ] 不在 `options` 列表中的值被拒绝
- [ ] `sensitive: true` 字段加密存储，解密返回
- [ ] 隐藏字段（`visibleWhen` 不满足）的 required 校验被跳过
- [ ] `external: true` 字段不存储、不返回
- [ ] schema 版本迁移（v1 → v2）正确执行

---

## 13. 参考

- **Schema 定义**: `packages/webui/src/settings/schema.ts`
- **类型定义**: `packages/webui/src/settings/types.ts`
- **前端演示页面**: `packages/webui/src/pages/SettingsV2.tsx`
- **现有 API**: `packages/webui/src/services/api.ts` → `settingsApi.get()` / `settingsApi.update()`

---

**协调完成标志**: 当前端调用 `settingsApi.update()` 后刷新页面，所有非 external 字段的值能从 `GET /settings` 正确返回。
