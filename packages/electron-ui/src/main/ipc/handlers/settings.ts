import { SETTINGS_GET, SETTINGS_UPDATE } from '../../../shared/ipc-channels'
import type { Settings, SettingsUpdateRequest } from '../../../shared/ipc-types'
import type { IpcHandler } from '../router'
import { getDatabase } from '../../database'

// 默认设置
const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'zh-CN',
  defaultModel: 'claude-opus-4',
  apiKeys: {}
}

export const settingsHandlers: Record<string, IpcHandler<any, any>> = {
  [SETTINGS_GET]: async (): Promise<Settings> => {
    const db = getDatabase()
    const row = db.prepare("SELECT value FROM settings WHERE key = 'app_settings'").get() as any

    if (!row) {
      // 首次启动，初始化默认设置
      db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('app_settings', ?, ?)")
        .run(JSON.stringify(DEFAULT_SETTINGS), Date.now())
      return DEFAULT_SETTINGS
    }

    return JSON.parse(row.value) as Settings
  },

  [SETTINGS_UPDATE]: async (_, req: SettingsUpdateRequest): Promise<Settings> => {
    const db = getDatabase()

    // 读取当前设置
    const current = await settingsHandlers[SETTINGS_GET](null as any, {} as any)

    // 合并更新
    const updated: Settings = {
      ...current,
      ...req
    }

    // 写入 DB
    db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = 'app_settings'")
      .run(JSON.stringify(updated), Date.now())

    return updated
  }
}
