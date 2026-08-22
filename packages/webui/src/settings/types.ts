// OxygenClaw 动态设置系统 — Schema 类型定义
//
// 这是前后端共享的设置规范契约。前端根据 schema 动态渲染控件，
// 后端根据同一套 schema 校验与持久化到 settings.json。
// 新增设置项时，只需在 schema 中声明，无需改动渲染器代码。

/** 支持的控件类型。新增控件类型时在此扩展，并在 SettingField 中实现对应渲染分支。 */
export type FieldType =
  | 'toggle'      // 开关，值为 boolean
  | 'select'      // 下拉单选，值为 string | number
  | 'segmented'   // 分段按钮组，值为 string（选项较少时替代 select）
  | 'text'        // 单行文本
  | 'password'    // 密码（隐藏输入）
  | 'url'         // URL 文本（带格式校验）
  | 'number'      // 数字输入
  | 'slider'      // 滑块，值为 number
  | 'time'        // 时间 HH:mm
  | 'textarea'    // 多行文本
  | 'color'       // 颜色选择器，值为 hex 字符串
  | 'colorSwatch' // 预设色板 + 自定义颜色
  | 'kvList'      // 键值对列表，值为 Record<string,string>
  | 'action'      // 动作按钮（不绑定值，触发 actionId）
  | 'custom'      // 逃生舱：由 customRenderers[componentId] 渲染

/** 单个选项（用于 select / segmented / colorSwatch）。 */
export interface FieldOption {
  value: string | number;
  /** 显示文案。若提供 labelKey 则优先走 i18n。 */
  label?: string;
  /** i18n key，优先于 label。 */
  labelKey?: string;
  /** colorSwatch 专用：色值。 */
  color?: string;
  /** 选项描述（部分控件展示）。 */
  desc?: string;
}

/** 校验规则。前端即时校验，后端在写入前二次校验。 */
export interface FieldValidation {
  required?: boolean;
  min?: number;          // number/slider 最小值；text 最小长度
  max?: number;          // number/slider 最大值；text 最大长度
  step?: number;         // number/slider 步进
  pattern?: string;      // 正则字符串（text/url）
  /** 校验失败提示文案 i18n key。 */
  messageKey?: string;
}

/**
 * 条件显隐规则：当 field 的当前值满足条件时才显示本项。
 * 支持等值、包含、真值判断。多个条件之间为 AND 关系。
 */
export interface FieldCondition {
  /** 依赖的字段 key。 */
  field: string;
  /** 值等于其中之一时满足。 */
  equals?: (string | number | boolean)[];
  /** 值不等于其中任何一个时满足。 */
  notEquals?: (string | number | boolean)[];
  /** 依赖字段为真值时满足（忽略 equals/notEquals）。 */
  truthy?: boolean;
}

/** 单个设置字段定义。 */
export interface FieldSchema {
  /** 存储键。对应 settings.json 中的键名，需全局唯一。 */
  key: string;
  type: FieldType;
  /** 标签 i18n key。 */
  labelKey: string;
  /** 描述 i18n key（可选）。 */
  descKey?: string;
  /** 默认值。前端初始化与后端 fallback 使用。 */
  default?: unknown;
  /** 占位符 i18n key。 */
  placeholderKey?: string;
  /** select/segmented/colorSwatch 的选项。 */
  options?: FieldOption[];
  validation?: FieldValidation;
  /** 显示条件；不满足则该字段不渲染。 */
  visibleWhen?: FieldCondition[];
  /** 控件宽度提示（像素），用于 text/select 等右对齐控件。 */
  controlWidth?: number;
  /** slider 是否展示当前数值。 */
  showValue?: boolean;
  /** action 类型专用：触发的动作 id，由页面在 actions 映射中实现。 */
  actionId?: string;
  /** custom 类型专用：自定义渲染器 id。 */
  componentId?: string;
  /**
   * 标记该字段不通过通用 settings 存储（例如主题走 ThemeContext、语言走 i18n）。
   * 渲染器会调用 externalBindings[key] 读写，而非 settings 对象。
   */
  external?: boolean;
  /** 是否为敏感字段（密钥等）。后端应加密存储、日志脱敏。 */
  sensitive?: boolean;
  /** 高级项标记，UI 可折叠或降权展示。 */
  advanced?: boolean;
}

/** 设置分组（对应页面中的一个卡片区块）。 */
export interface GroupSchema {
  id: string;
  /** 分组标题 i18n key（可选，无标题则不显示 section title）。 */
  titleKey?: string;
  fields: FieldSchema[];
  /** 整组显隐条件。 */
  visibleWhen?: FieldCondition[];
}

/** 设置标签页（对应左侧导航的一项）。 */
export interface TabSchema {
  id: string;
  /** 标签 i18n key。 */
  labelKey: string;
  /** lucide 图标名（在 Settings 中映射为组件）。 */
  icon: string;
  groups: GroupSchema[];
}

/** 顶层设置 schema。 */
export interface SettingsSchema {
  /** schema 版本，后端据此做迁移。 */
  version: number;
  tabs: TabSchema[];
}

/** 设置值集合（扁平 key-value）。 */
export type SettingsValues = Record<string, unknown>;
