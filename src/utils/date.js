export function formatDate(date = new Date()) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateTime(date = new Date()) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export function formatTimeOnly(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * 兼容 "2026-11-24T12:40:00" 与 "2026-11-24 12:40:00" 两种后端格式
 * iOS 对带 T 的字符串解析不稳定，这里直接截取，避免时区与兼容问题
 */
export function formatClock(dateTimeStr) {
  if (!dateTimeStr) return ''
  const str = String(dateTimeStr)
  const match = str.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (match) return `${match[4]}:${match[5]}`
  return formatTimeOnly(str)
}

/**
 * 距上次记录多久：返回「12:40（2.5 小时前）」
 */
export function formatSinceLastRecord(lastRecordTime, hours) {
  if (!lastRecordTime) return '今日尚未记录'
  const clock = formatClock(lastRecordTime)
  if (hours === null || hours === undefined) return `最后记录 ${clock}`
  const h = Number(hours)
  if (h < 1) {
    const minutes = Math.max(1, Math.round(h * 60))
    return `最后记录 ${clock}（${minutes} 分钟前）`
  }
  return `最后记录 ${clock}（${h.toFixed(1)} 小时前）`
}
