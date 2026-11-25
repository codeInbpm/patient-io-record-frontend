/**
 * 弱网离线队列
 * 病房信号差时，入量/出量记录先落本地，网络恢复后自动补传
 * 存储结构：[{ id, type, payload, label, createdAt, retryCount }]
 */
import { recordIntakeApi, recordOutputApi } from '../api/record'

const STORAGE_KEY = 'offline_record_queue'
const MAX_RETRY = 5

let flushing = false

export function getQueue() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    return Array.isArray(raw) ? raw : []
  } catch (e) {
    return []
  }
}

function saveQueue(list) {
  try {
    uni.setStorageSync(STORAGE_KEY, list)
  } catch (e) {
    // ignore
  }
}

export function queueCount() {
  return getQueue().length
}

/**
 * 记录入队
 * @param {'intake'|'output'} type
 * @param {Object} payload 提交给后端的完整参数
 * @param {String} label 便于用户识别的描述，如「03床 张三 · 水 150ml」
 */
export function enqueueRecord(type, payload, label) {
  const list = getQueue()
  list.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    label: label || '',
    createdAt: Date.now(),
    retryCount: 0
  })
  saveQueue(list)
  return list.length
}

function removeById(id) {
  const list = getQueue().filter(item => item.id !== id)
  saveQueue(list)
  return list
}

/**
 * 尝试补传队列，全部成功返回 true
 */
export async function flushQueue() {
  if (flushing) return false
  const list = getQueue()
  if (list.length === 0) return true

  flushing = true
  let successCount = 0
  let blocked = false

  for (const item of list) {
    try {
      if (item.type === 'intake') {
        await recordIntakeApi(item.payload)
      } else if (item.type === 'output') {
        await recordOutputApi(item.payload)
      }
      removeById(item.id)
      successCount++
    } catch (e) {
      const kind = e?.kind
      if (kind === 'network' || kind === 'timeout') {
        // 仍然没网，停止本轮补传，保留队列
        blocked = true
        break
      }
      // 业务错误（如参数不合法）重试无意义，累计次数后丢弃，避免死循环
      const current = getQueue().find(q => q.id === item.id)
      if (current) {
        current.retryCount = (current.retryCount || 0) + 1
        if (current.retryCount >= MAX_RETRY) {
          removeById(item.id)
        } else {
          const next = getQueue().map(q => (q.id === item.id ? current : q))
          saveQueue(next)
        }
      }
    }
  }

  flushing = false

  if (successCount > 0) {
    uni.showToast({
      title: `已补传 ${successCount} 条离线记录`,
      icon: 'none'
    })
  }
  return blocked ? false : getQueue().length === 0
}

/**
 * 应用启动时挂载：网络恢复 / 回到前台时自动补传
 */
export function initOfflineSync() {
  uni.onNetworkStatusChange((res) => {
    if (res.isConnected) {
      flushQueue()
    }
  })

  // 启动即尝试一次（可能上次退出时还有残留）
  setTimeout(() => {
    if (queueCount() > 0) {
      flushQueue()
    }
  }, 3000)
}
