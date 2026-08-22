import React, { useMemo } from 'react';
import {
  SettingsSchema,
  FieldSchema,
  FieldCondition,
  SettingsValues,
} from '../../settings/types';
import { SettingField } from './SettingField';
import { useI18n } from '../../i18n';

interface SchemaFormProps {
  schema: SettingsSchema;
  /** 当前 tab id */
  activeTab: string;
  /** 设置值（扁平 key-value）*/
  values: SettingsValues;
  /** 修改回调 */
  onChange: (key: string, value: unknown) => void;
  /** 保存中状态 */
  saving?: boolean;
  /**
   * External bindings：external: true 的字段走此映射读写，
   * 而非 values 对象（例如 theme 走 ThemeContext）。
   */
  externalBindings?: Record<string, {
    value: unknown;
    onChange: (v: unknown) => void;
  }>;
  /**
   * Action 处理器映射（用于 action 类型字段）。
   */
  // actions?: Record<string, () => void>;
  /**
   * Custom 渲染器映射（用于 custom 类型字段）。
   */
  // customRenderers?: Record<string, React.ComponentType<any>>;
}

/** 从 i18n 命名空间获取嵌套翻译键 */
function getI18nValue(t: any, key: string): string {
  const parts = key.split('.');
  let current = t;
  for (const part of parts) {
    current = current?.[part];
    if (current === undefined) return key;
  }
  return typeof current === 'string' ? current : key;
}

/** 检查单个条件是否满足 */
function checkCondition(condition: FieldCondition, values: SettingsValues): boolean {
  const fieldValue = values[condition.field];

  if (condition.truthy !== undefined) {
    return condition.truthy ? Boolean(fieldValue) : !fieldValue;
  }

  if (condition.equals) {
    return condition.equals.includes(fieldValue as any);
  }

  if (condition.notEquals) {
    return !condition.notEquals.includes(fieldValue as any);
  }

  return true;
}

/** 检查字段是否可见（所有条件 AND） */
function isVisible(
  conditions: FieldCondition[] | undefined,
  values: SettingsValues
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((cond) => checkCondition(cond, values));
}

/** Section 标题组件 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 mt-6 first:mt-0 px-1">
      {children}
    </div>
  );
}

/** 设置分组容器 */
function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      {title && <SectionTitle>{title}</SectionTitle>}
      <div className="settings-list">{children}</div>
    </div>
  );
}

export const SchemaForm: React.FC<SchemaFormProps> = ({
  schema,
  activeTab,
  values,
  onChange,
  saving,
  externalBindings = {},
  // actions = {},
  // customRenderers = {},
}) => {
  const { t } = useI18n();

  // 找到当前激活的 tab
  const tab = schema.tabs.find((t) => t.id === activeTab);

  // 过滤可见的分组与字段（基于 visibleWhen）
  const visibleGroups = useMemo(() => {
    if (!tab) return [];
    return tab.groups
      .filter((group) => isVisible(group.visibleWhen, values))
      .map((group) => ({
        ...group,
        fields: group.fields.filter((field) => isVisible(field.visibleWhen, values)),
      }))
      .filter((group) => group.fields.length > 0);
  }, [tab, values]);

  if (!tab) {
    return (
      <div className="p-8 text-center text-on-surface-variant">
        未找到标签页: {activeTab}
      </div>
    );
  }

  const handleChange = (key: string, value: unknown) => {
    // 查找字段定义，判断是否 external
    const field = tab.groups
      .flatMap((g) => g.fields)
      .find((f) => f.key === key);

    if (field?.external && externalBindings[key]) {
      externalBindings[key].onChange(value);
    } else {
      onChange(key, value);
    }
  };

  const getFieldValue = (field: FieldSchema): unknown => {
    if (field.external && externalBindings[field.key]) {
      return externalBindings[field.key].value;
    }
    return values[field.key] ?? field.default;
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-on-surface mb-6">
        {getI18nValue(t, tab.labelKey)}
      </h2>

      {visibleGroups.map((group) => (
        <SettingsGroup
          key={group.id}
          title={group.titleKey ? getI18nValue(t, group.titleKey) : undefined}
        >
          {group.fields.map((field) => (
            <SettingField
              key={field.key}
              field={field}
              value={getFieldValue(field)}
              onChange={handleChange}
              disabled={saving}
            />
          ))}
        </SettingsGroup>
      ))}
    </div>
  );
};
