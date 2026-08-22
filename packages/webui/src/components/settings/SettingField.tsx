import React from 'react';
import { FieldSchema, FieldOption } from '../../settings/types';
import { useI18n } from '../../i18n';

interface SettingFieldProps {
  field: FieldSchema;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
}

/** 从 i18n 命名空间获取嵌套翻译键 */
function getI18nValue(t: any, key: string): string {
  const parts = key.split('.');
  let current = t;
  for (const part of parts) {
    current = current?.[part];
    if (current === undefined) return key; // fallback 到 key 本身
  }
  return typeof current === 'string' ? current : key;
}

/** 解析选项标签（优先 i18n labelKey，否则 label） */
function getOptionLabel(option: FieldOption, t: any): string {
  if (option.labelKey) return getI18nValue(t, option.labelKey);
  return option.label || String(option.value);
}

/** Toggle 开关组件（复用 Settings.tsx 中的样式） */
function Toggle({ checked, onChange, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`toggle-switch ${checked ? 'active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div className="toggle-switch-thumb" />
    </div>
  );
}

export const SettingField: React.FC<SettingFieldProps> = ({ field, value, onChange, disabled }) => {
  const { t } = useI18n();
  const label = getI18nValue(t, field.labelKey);
  const desc = field.descKey ? getI18nValue(t, field.descKey) : undefined;
  const placeholder = field.placeholderKey ? getI18nValue(t, field.placeholderKey) : undefined;

  const renderControl = () => {
    const val = value ?? field.default;

    switch (field.type) {
      case 'toggle':
        return (
          <Toggle
            checked={Boolean(val)}
            onChange={(v) => onChange(field.key, v)}
            disabled={disabled}
          />
        );

      case 'select':
        return (
          <select
            value={String(val ?? '')}
            onChange={(e) => onChange(field.key, e.target.value)}
            disabled={disabled}
            style={{ minWidth: field.controlWidth || 120 }}
          >
            {field.options?.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {getOptionLabel(opt, t)}
              </option>
            ))}
          </select>
        );

      case 'segmented':
        return (
          <div className="segmented-control">
            {field.options?.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => onChange(field.key, opt.value)}
                disabled={disabled}
                className={`segmented-control-item ${val === opt.value ? 'active' : ''}`}
              >
                {getOptionLabel(opt, t)}
              </button>
            ))}
          </div>
        );

      case 'text':
      case 'password':
      case 'url':
        return (
          <input
            type={field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text'}
            value={String(val ?? '')}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            style={{ width: field.controlWidth || 200 }}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={Number(val ?? field.validation?.min ?? 0)}
            onChange={(e) => onChange(field.key, parseFloat(e.target.value) || 0)}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.step}
            disabled={disabled}
            style={{ width: field.controlWidth || 120 }}
          />
        );

      case 'slider':
        return (
          <div className="flex items-center gap-3 flex-1">
            <input
              type="range"
              value={Number(val ?? field.default ?? field.validation?.min ?? 0)}
              onChange={(e) => onChange(field.key, parseFloat(e.target.value))}
              min={field.validation?.min ?? 0}
              max={field.validation?.max ?? 100}
              step={field.validation?.step ?? 1}
              disabled={disabled}
              className="flex-1"
            />
            {field.showValue && (
              <span className="text-sm text-on-surface-variant min-w-[3rem] text-right">
                {Number(val ?? field.default ?? 0).toFixed(
                  field.validation?.step && field.validation.step < 1 ? 1 : 0
                )}
              </span>
            )}
          </div>
        );

      case 'time':
        return (
          <input
            type="time"
            value={String(val ?? '')}
            onChange={(e) => onChange(field.key, e.target.value)}
            disabled={disabled}
            style={{ width: field.controlWidth || 100 }}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={String(val ?? '')}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={4}
            className="w-full text-sm"
          />
        );

      case 'color':
        return (
          <input
            type="color"
            value={String(val ?? '#6750A4')}
            onChange={(e) => onChange(field.key, e.target.value)}
            disabled={disabled}
            className="w-10 h-10 rounded cursor-pointer border-0 p-0"
          />
        );

      case 'colorSwatch':
        return (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {field.options?.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => onChange(field.key, opt.value)}
                  disabled={disabled}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: opt.color,
                    borderColor:
                      val === opt.value ? 'var(--md-on-surface)' : 'transparent',
                  }}
                  title={String(opt.value)}
                />
              ))}
            </div>
            <input
              type="color"
              value={String(val ?? '#6750A4')}
              onChange={(e) => onChange(field.key, e.target.value)}
              disabled={disabled}
              className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent"
              title="自定义颜色"
            />
          </div>
        );

      case 'kvList':
        // 简化实现：显示提示（完整实现需要状态管理，暂不在此组件中处理）
        return (
          <div className="text-sm text-on-surface-variant">
            键值对编辑器（需自定义组件）
          </div>
        );

      case 'action':
        return (
          <button
            onClick={() => {
              // 触发 actionId 对应的处理器，由父组件在 actions 映射中实现
              console.warn(`Action ${field.actionId} triggered but no handler provided`);
            }}
            disabled={disabled}
            className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {label}
          </button>
        );

      case 'custom':
        return (
          <div className="text-sm text-on-surface-variant">
            自定义组件（componentId: {field.componentId}）
          </div>
        );

      default:
        return (
          <div className="text-sm text-error">
            未知控件类型: {field.type}
          </div>
        );
    }
  };

  return (
    <div className="settings-row">
      <div className="flex-1 min-w-0 pr-4">
        <div className="settings-row-label">{label}</div>
        {desc && <div className="settings-row-desc">{desc}</div>}
      </div>
      <div className="settings-row-value">{renderControl()}</div>
    </div>
  );
};
