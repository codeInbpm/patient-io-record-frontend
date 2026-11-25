/**
 * 全局运行配置
 * 目的：请求地址、版本号、演示数据开关不再散落在业务代码里
 * 真机调试时只需改 .env 的 VITE_API_BASE_URL，或在「我的 → 服务器设置」里临时改
 */

const STORAGE_BASE_URL_KEY = 'api_base_url_override'

// 兜底地址（仅开发环境使用）
const FALLBACK_BASE_URL = 'http://localhost:8080/api'

function readEnv(key, defaultValue) {
  try {
    const value = import.meta.env?.[key]
    return value === undefined || value === '' ? defaultValue : value
  } catch (e) {
    return defaultValue
  }
}

/**
 * 获取后端地址。优先级：本地覆盖 > 构建环境变量 > 兜底地址
 */
export function getBaseUrl() {
  try {
    const override = uni.getStorageSync(STORAGE_BASE_URL_KEY)
    if (override) return String(override).replace(/\/+$/, '')
  } catch (e) {
    // ignore
  }
  return String(readEnv('VITE_API_BASE_URL', FALLBACK_BASE_URL)).replace(/\/+$/, '')
}

/**
 * 设置后端地址（用于现场临时切换内网地址），传空则恢复默认
 */
export function setBaseUrl(url) {
  if (!url) {
    uni.removeStorageSync(STORAGE_BASE_URL_KEY)
    return
  }
  uni.setStorageSync(STORAGE_BASE_URL_KEY, String(url).trim().replace(/\/+$/, ''))
}

export const BASE_URL = FALLBACK_BASE_URL

export const APP_VERSION = readEnv('VITE_APP_VERSION', '2.1.0')

// 是否展示演示数据（演示工号、示例患者），生产构建必须为 false
export const SHOW_DEMO = readEnv('VITE_SHOW_DEMO', 'false') === 'true'

// 超过多少小时未记录即视为「可能漏记」
export const MISSED_RECORD_HOURS = Number(readEnv('VITE_MISSED_RECORD_HOURS', '4'))

// 请求超时（毫秒）
export const REQUEST_TIMEOUT = 15000
