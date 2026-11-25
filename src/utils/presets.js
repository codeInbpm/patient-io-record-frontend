/**
 * 常用组合 / 最近使用
 * 病历里 80% 是重复输入，记住最近 3 条一键带出
 */

const PREFIX = 'recent_usage_'
const MAX_ITEMS = 3

function signature(item) {
  return JSON.stringify(item.payload || {})
}

export function getRecent(key) {
  try {
    const raw = uni.getStorageSync(PREFIX + key)
    return Array.isArray(raw) ? raw : []
  } catch (e) {
    return []
  }
}

export function pushRecent(key, item) {
  if (!item || !item.payload) return
  const list = getRecent(key).filter(i => signature(i) !== signature(item))
  list.unshift({
    label: item.label || '',
    payload: item.payload,
    usedAt: Date.now()
  })
  try {
    uni.setStorageSync(PREFIX + key, list.slice(0, MAX_ITEMS))
  } catch (e) {
    // ignore
  }
}

export function clearRecent(key) {
  uni.removeStorageSync(PREFIX + key)
}
