import { SettingsSchema } from './types';

/**
 * OxygenClaw 设置 Schema
 * 
 * 新增设置项时，在此文件中添加到对应的 tab/group/fields，
 * 前端会自动渲染控件，后端根据同一份 schema 校验和持久化。
 * 
 * 注意事项：
 * - key 需全局唯一，对应 settings.json 中的键名
 * - labelKey/descKey 需在 i18n/zh.ts 和 en.ts 的 settingsSchema 命名空间下定义
 * - external: true 的字段（如 theme/language）走特殊 binding，不存储在 settings 对象中
 * - sensitive: true 的字段后端应加密存储
 */
export const settingsSchema: SettingsSchema = {
  version: 1,
  tabs: [
    // 外观与主题
    {
      id: 'appearance',
      labelKey: 'settingsSchema.tabs.appearance',
      icon: 'Palette',
      groups: [
        {
          id: 'theme-mode',
          titleKey: 'settingsSchema.groups.themeMode',
          fields: [
            {
              key: 'theme',
              type: 'segmented',
              labelKey: 'settingsSchema.fields.theme.label',
              default: 'system',
              external: true,
              options: [
                { value: 'light', labelKey: 'settingsSchema.fields.theme.options.light' },
                { value: 'dark', labelKey: 'settingsSchema.fields.theme.options.dark' },
                { value: 'system', labelKey: 'settingsSchema.fields.theme.options.system' },
              ],
            },
          ],
        },
        {
          id: 'ui-style',
          titleKey: 'settingsSchema.groups.uiStyle',
          fields: [
            {
              key: 'uiTheme',
              type: 'select',
              labelKey: 'settingsSchema.fields.uiTheme.label',
              descKey: 'settingsSchema.fields.uiTheme.desc',
              default: 'apple',
              external: true,
              controlWidth: 160,
              options: [
                { value: 'apple', label: 'OxygenOrigin' },
                { value: 'material', label: 'Google Material 3' },
                { value: 'liquid-glass', label: 'Liquid Glass' },
              ],
            },
            {
              key: 'materialSeed',
              type: 'colorSwatch',
              labelKey: 'settingsSchema.fields.materialSeed.label',
              descKey: 'settingsSchema.fields.materialSeed.desc',
              default: '#6750A4',
              external: true,
              visibleWhen: [{ field: 'uiTheme', equals: ['material'] }],
              options: [
                { value: '#6750A4', color: '#6750A4' },
                { value: '#007AFF', color: '#007AFF' },
                { value: '#FF3B30', color: '#FF3B30' },
                { value: '#FF9500', color: '#FF9500' },
                { value: '#34C759', color: '#34C759' },
                { value: '#00C7BE', color: '#00C7BE' },
                { value: '#AF52DE', color: '#AF52DE' },
                { value: '#FF2D55', color: '#FF2D55' },
              ],
            },
          ],
        },
        {
          id: 'display',
          titleKey: 'settingsSchema.groups.display',
          fields: [
            {
              key: 'language',
              type: 'select',
              labelKey: 'settingsSchema.fields.language.label',
              default: 'zh',
              external: true,
              controlWidth: 120,
              options: [
                { value: 'zh', label: '中文' },
                { value: 'en', label: 'English' },
              ],
            },
            {
              key: 'fontSize',
              type: 'select',
              labelKey: 'settingsSchema.fields.fontSize.label',
              default: 'normal',
              controlWidth: 120,
              options: [
                { value: 'small', labelKey: 'settingsSchema.fields.fontSize.options.small' },
                { value: 'normal', labelKey: 'settingsSchema.fields.fontSize.options.normal' },
                { value: 'large', labelKey: 'settingsSchema.fields.fontSize.options.large' },
                { value: 'xlarge', labelKey: 'settingsSchema.fields.fontSize.options.xlarge' },
              ],
            },
            {
              key: 'sidebarDensity',
              type: 'select',
              labelKey: 'settingsSchema.fields.sidebarDensity.label',
              descKey: 'settingsSchema.fields.sidebarDensity.desc',
              default: 'normal',
              controlWidth: 120,
              options: [
                { value: 'compact', labelKey: 'common.compact' },
                { value: 'normal', labelKey: 'common.normal' },
                { value: 'comfortable', labelKey: 'common.comfortable' },
              ],
            },
          ],
        },
        {
          id: 'chat-interface',
          titleKey: 'settingsSchema.groups.chatInterface',
          fields: [
            {
              key: 'showMessageTime',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.showMessageTime.label',
              default: true,
            },
            {
              key: 'showAvatar',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.showAvatar.label',
              default: true,
            },
            {
              key: 'animations',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.animations.label',
              default: true,
            },
            {
              key: 'reduceMotion',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.reduceMotion.label',
              default: false,
            },
          ],
        },
        {
          id: 'sidebar-settings',
          titleKey: 'settingsSchema.groups.sidebarSettings',
          fields: [
            {
              key: 'showSidebar',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.showSidebar.label',
              default: true,
            },
            {
              key: 'sidebarIconSize',
              type: 'select',
              labelKey: 'settingsSchema.fields.sidebarIconSize.label',
              default: 'medium',
              controlWidth: 120,
              options: [
                { value: 'small', labelKey: 'settingsSchema.fields.fontSize.options.small' },
                { value: 'medium', labelKey: 'common.medium' },
                { value: 'large', labelKey: 'settingsSchema.fields.fontSize.options.large' },
              ],
            },
            {
              key: 'sidebarPosition',
              type: 'select',
              labelKey: 'settingsSchema.fields.sidebarPosition.label',
              default: 'left',
              controlWidth: 120,
              options: [
                { value: 'left', labelKey: 'common.left' },
                { value: 'right', labelKey: 'common.right' },
              ],
            },
          ],
        },
        {
          id: 'window-settings',
          titleKey: 'settingsSchema.groups.windowSettings',
          fields: [
            {
              key: 'zoomLevel',
              type: 'select',
              labelKey: 'settingsSchema.fields.zoomLevel.label',
              default: '100',
              controlWidth: 120,
              options: [
                { value: '75', label: '75%' },
                { value: '90', label: '90%' },
                { value: '100', label: '100%' },
                { value: '110', label: '110%' },
                { value: '125', label: '125%' },
                { value: '150', label: '150%' },
              ],
            },
          ],
        },
      ],
    },

    // 聊天设置
    {
      id: 'chat',
      labelKey: 'settingsSchema.tabs.chat',
      icon: 'MessageSquare',
      groups: [
        {
          id: 'model-defaults',
          titleKey: 'settingsSchema.groups.modelDefaults',
          fields: [
            {
              key: 'defaultModel',
              type: 'text',
              labelKey: 'settingsSchema.fields.defaultModel.label',
              placeholderKey: 'settingsSchema.fields.defaultModel.placeholder',
              default: '',
              controlWidth: 200,
            },
            {
              key: 'defaultMode',
              type: 'segmented',
              labelKey: 'settingsSchema.fields.defaultMode.label',
              default: 'chat',
              options: [
                { value: 'chat', labelKey: 'settingsSchema.fields.defaultMode.options.chat' },
                { value: 'task', labelKey: 'settingsSchema.fields.defaultMode.options.task' },
              ],
            },
            {
              key: 'defaultCapability',
              type: 'select',
              labelKey: 'settingsSchema.fields.defaultCapability.label',
              default: 'fast',
              controlWidth: 140,
              options: [
                { value: 'fast', labelKey: 'common.fast' },
                { value: 'think', labelKey: 'common.think' },
                { value: 'expert', labelKey: 'common.expert' },
                { value: 'research', labelKey: 'common.research' },
                { value: 'moa', label: 'MoA' },
              ],
            },
          ],
        },
        {
          id: 'model-params',
          titleKey: 'settingsSchema.groups.modelParams',
          fields: [
            {
              key: 'temperature',
              type: 'slider',
              labelKey: 'settingsSchema.fields.temperature.label',
              default: 1.0,
              showValue: true,
              validation: { min: 0, max: 2, step: 0.1 },
            },
            {
              key: 'maxTokens',
              type: 'number',
              labelKey: 'settingsSchema.fields.maxTokens.label',
              default: 4096,
              controlWidth: 120,
              validation: { min: 1, max: 100000 },
            },
            {
              key: 'topP',
              type: 'slider',
              labelKey: 'settingsSchema.fields.topP.label',
              default: 1.0,
              showValue: true,
              validation: { min: 0, max: 1, step: 0.05 },
            },
          ],
        },
        {
          id: 'behavior',
          titleKey: 'settingsSchema.groups.behavior',
          fields: [
            {
              key: 'autoScroll',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.autoScroll.label',
              default: true,
            },
            {
              key: 'autoSaveDraft',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.autoSaveDraft.label',
              default: true,
            },
            {
              key: 'streamOutput',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.streamOutput.label',
              default: true,
            },
            {
              key: 'showThinking',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.showThinking.label',
              default: true,
            },
          ],
        },
      ],
    },

    // 多模态
    {
      id: 'multimodal',
      labelKey: 'settingsSchema.tabs.multimodal',
      icon: 'Eye',
      groups: [
        {
          id: 'vision',
          titleKey: 'settingsSchema.groups.vision',
          fields: [
            {
              key: 'visionEnabled',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.visionEnabled.label',
              default: false,
            },
            {
              key: 'visionApiKey',
              type: 'password',
              labelKey: 'settingsSchema.fields.visionApiKey.label',
              sensitive: true,
              controlWidth: 240,
              visibleWhen: [{ field: 'visionEnabled', truthy: true }],
            },
            {
              key: 'visionBaseUrl',
              type: 'url',
              labelKey: 'settingsSchema.fields.visionBaseUrl.label',
              default: 'https://api.stepfun.com/step_plan/v1',
              controlWidth: 280,
              visibleWhen: [{ field: 'visionEnabled', truthy: true }],
            },
            {
              key: 'visionModel',
              type: 'text',
              labelKey: 'settingsSchema.fields.visionModel.label',
              default: 'step-3.7-flash',
              controlWidth: 200,
              visibleWhen: [{ field: 'visionEnabled', truthy: true }],
            },
          ],
        },
        {
          id: 'asr',
          titleKey: 'settingsSchema.groups.asr',
          fields: [
            {
              key: 'asrEnabled',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.asrEnabled.label',
              default: false,
            },
            {
              key: 'asrApiKey',
              type: 'password',
              labelKey: 'common.apiKey',
              sensitive: true,
              controlWidth: 240,
              visibleWhen: [{ field: 'asrEnabled', truthy: true }],
            },
            {
              key: 'asrBaseUrl',
              type: 'url',
              labelKey: 'common.apiUrl',
              default: 'https://api.stepfun.com/step_plan/v1',
              controlWidth: 280,
              visibleWhen: [{ field: 'asrEnabled', truthy: true }],
            },
            {
              key: 'asrModel',
              type: 'text',
              labelKey: 'common.model',
              default: 'stepaudio-2.5-asr',
              controlWidth: 200,
              visibleWhen: [{ field: 'asrEnabled', truthy: true }],
            },
          ],
        },
        {
          id: 'tts',
          titleKey: 'settingsSchema.groups.tts',
          fields: [
            {
              key: 'ttsEnabled',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.ttsEnabled.label',
              default: false,
            },
            {
              key: 'ttsApiKey',
              type: 'password',
              labelKey: 'common.apiKey',
              sensitive: true,
              controlWidth: 240,
              visibleWhen: [{ field: 'ttsEnabled', truthy: true }],
            },
            {
              key: 'ttsBaseUrl',
              type: 'url',
              labelKey: 'common.apiUrl',
              default: 'https://api.stepfun.com/step_plan/v1',
              controlWidth: 280,
              visibleWhen: [{ field: 'ttsEnabled', truthy: true }],
            },
            {
              key: 'ttsModel',
              type: 'text',
              labelKey: 'common.model',
              default: 'stepaudio-2.5-tts',
              controlWidth: 200,
              visibleWhen: [{ field: 'ttsEnabled', truthy: true }],
            },
            {
              key: 'ttsSpeed',
              type: 'slider',
              labelKey: 'settingsSchema.fields.ttsSpeed.label',
              default: 1.0,
              showValue: true,
              validation: { min: 0.5, max: 2.0, step: 0.1 },
              visibleWhen: [{ field: 'ttsEnabled', truthy: true }],
            },
          ],
        },
        {
          id: 'image-gen',
          titleKey: 'settingsSchema.groups.imageGen',
          fields: [
            {
              key: 'imageGenEnabled',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.imageGenEnabled.label',
              default: false,
            },
            {
              key: 'imageGenApiKey',
              type: 'password',
              labelKey: 'common.apiKey',
              sensitive: true,
              controlWidth: 240,
              visibleWhen: [{ field: 'imageGenEnabled', truthy: true }],
            },
            {
              key: 'imageGenBaseUrl',
              type: 'url',
              labelKey: 'common.apiUrl',
              default: 'https://api.stepfun.com/step_plan/v1',
              controlWidth: 280,
              visibleWhen: [{ field: 'imageGenEnabled', truthy: true }],
            },
            {
              key: 'imageGenDefaultSize',
              type: 'select',
              labelKey: 'settingsSchema.fields.imageGenDefaultSize.label',
              default: '1024x1024',
              controlWidth: 140,
              visibleWhen: [{ field: 'imageGenEnabled', truthy: true }],
              options: [
                { value: '512x512', label: '512×512' },
                { value: '1024x1024', label: '1024×1024' },
                { value: '1024x1792', label: '1024×1792' },
                { value: '1792x1024', label: '1792×1024' },
              ],
            },
            {
              key: 'imageGenDefaultSteps',
              type: 'slider',
              labelKey: 'settingsSchema.fields.imageGenDefaultSteps.label',
              default: 20,
              showValue: true,
              validation: { min: 1, max: 50, step: 1 },
              visibleWhen: [{ field: 'imageGenEnabled', truthy: true }],
            },
            {
              key: 'imageGenDefaultCfgScale',
              type: 'slider',
              labelKey: 'settingsSchema.fields.imageGenDefaultCfgScale.label',
              default: 7.5,
              showValue: true,
              validation: { min: 1, max: 20, step: 0.5 },
              visibleWhen: [{ field: 'imageGenEnabled', truthy: true }],
            },
          ],
        },
      ],
    },

    // 通知提醒
    {
      id: 'notifications',
      labelKey: 'settingsSchema.tabs.notifications',
      icon: 'Bell',
      groups: [
        {
          id: 'notification-general',
          titleKey: 'settingsSchema.groups.notificationGeneral',
          fields: [
            {
              key: 'notificationsEnabled',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.notificationsEnabled.label',
              default: true,
            },
            {
              key: 'soundEnabled',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.soundEnabled.label',
              default: true,
            },
            {
              key: 'taskRemindersEnabled',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.taskRemindersEnabled.label',
              default: true,
            },
          ],
        },
        {
          id: 'dnd',
          titleKey: 'settingsSchema.groups.dnd',
          fields: [
            {
              key: 'dndEnabled',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.dndEnabled.label',
              default: false,
            },
            {
              key: 'dndStart',
              type: 'time',
              labelKey: 'settingsSchema.fields.dndStart.label',
              default: '22:00',
              controlWidth: 100,
              visibleWhen: [{ field: 'dndEnabled', truthy: true }],
            },
            {
              key: 'dndEnd',
              type: 'time',
              labelKey: 'settingsSchema.fields.dndEnd.label',
              default: '08:00',
              controlWidth: 100,
              visibleWhen: [{ field: 'dndEnabled', truthy: true }],
            },
          ],
        },
      ],
    },

    // 系统设置
    {
      id: 'system',
      labelKey: 'settingsSchema.tabs.system',
      icon: 'Settings',
      groups: [
        {
          id: 'startup',
          titleKey: 'settingsSchema.groups.startup',
          fields: [
            {
              key: 'autoStart',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.autoStart.label',
              descKey: 'settingsSchema.fields.autoStart.desc',
              default: false,
            },
            {
              key: 'startMinimized',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.startMinimized.label',
              descKey: 'settingsSchema.fields.startMinimized.desc',
              default: false,
            },
            {
              key: 'disableGpuAccel',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.disableGpuAccel.label',
              descKey: 'settingsSchema.fields.disableGpuAccel.desc',
              default: false,
            },
          ],
        },
        {
          id: 'model-connection',
          titleKey: 'settingsSchema.groups.modelConnection',
          fields: [
            {
              key: 'directModelAccess',
              type: 'toggle',
              labelKey: 'settingsSchema.fields.directModelAccess.label',
              descKey: 'settingsSchema.fields.directModelAccess.desc',
              default: false,
            },
          ],
        },
        {
          id: 'storage',
          titleKey: 'settingsSchema.groups.storage',
          fields: [
            {
              key: 'maxCacheSize',
              type: 'select',
              labelKey: 'settingsSchema.fields.maxCacheSize.label',
              descKey: 'settingsSchema.fields.maxCacheSize.desc',
              default: '1024',
              controlWidth: 120,
              options: [
                { value: '256', label: '256 MB' },
                { value: '512', label: '512 MB' },
                { value: '1024', label: '1 GB' },
                { value: '2048', label: '2 GB' },
                { value: '5120', label: '5 GB' },
              ],
            },
          ],
        },
      ],
    },
  ],
};
