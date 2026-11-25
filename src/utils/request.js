import { getBaseUrl, REQUEST_TIMEOUT } from '../config'

let isRedirecting = false

/**
 * 统一错误对象：业务代码可以据此区分「没网」「服务异常」「登录过期」
 * kind: network | timeout | server | business | auth
 */
export class RequestError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'RequestError'
    this.kind = options.kind || 'business'
    this.statusCode = options.statusCode || 0
    this.code = options.code || 0
    this.silent = !!options.silent
  }
}

function toast(title) {
  uni.showToast({
    title,
    icon: 'none',
    duration: 2200
  })
}

function handleAuthExpired(message) {
  uni.removeStorageSync('token')
  uni.removeStorageSync('userInfo')
  if (isRedirecting) return
  isRedirecting = true
  toast(message || '登录已过期，请重新登录')
  setTimeout(() => {
    isRedirecting = false
    uni.reLaunch({ url: '/pages/auth/login' })
  }, 1200)
}

/**
 * 底层请求，不含任何 UI 提示
 */
function rawRequest(options) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token')
    const header = {
      'Content-Type': 'application/json',
      ...options.header
    }
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }

    const url = options.url.startsWith('http') ? options.url : getBaseUrl() + options.url

    // GET 请求允许用 params 传查询条件（uni.request 会自动拼到 query）
    const method = options.method || 'GET'
    let reqData = options.data || {}
    if (options.params) {
      reqData = { ...options.params, ...reqData }
    }

    uni.request({
      url,
      method,
      data: reqData,
      header,
      timeout: options.timeout || REQUEST_TIMEOUT,
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    })
  })
}

function normalizeSuccess(res, options) {
  const body = res.data

  // 非 200 的 HTTP 状态
  if (res.statusCode !== 200) {
    if (res.statusCode === 401) {
      handleAuthExpired(body?.message)
      throw new RequestError(body?.message || '登录已过期', { kind: 'auth', statusCode: 401 })
    }
    throw new RequestError(`服务暂时不可用（${res.statusCode}）`, {
      kind: 'server',
      statusCode: res.statusCode,
      silent: options.silent
    })
  }

  // 后端统一 Result 包装
  if (body && typeof body === 'object' && 'code' in body) {
    if (body.code === 200) return body.data
    if (body.code === 401) {
      handleAuthExpired(body.message)
      throw new RequestError(body.message || '登录已过期', { kind: 'auth', code: 401 })
    }
    throw new RequestError(body.message || '操作失败，请稍后重试', {
      kind: 'business',
      code: body.code,
      silent: options.silent
    })
  }

  // 后端直接返回裸数据的情况
  return body
}

function normalizeFail(err, options) {
  const isTimeout = String(err?.errMsg || '').indexOf('timeout') >= 0
  return new RequestError(
    isTimeout ? '请求超时，请检查网络后重试' : '网络不稳定，请稍后重试',
    { kind: isTimeout ? 'timeout' : 'network', silent: options.silent }
  )
}

/**
 * 统一请求入口
 * @param {Object} options
 *  - url / method / data / header
 *  - silent: 不弹出错误提示，由页面自己展示失败态（推荐列表类接口使用）
 *  - retry: 失败自动重试次数，默认 GET 请求重试 1 次
 */
export async function request(options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const autoRetry = options.retry !== undefined ? options.retry : (method === 'GET' ? 1 : 0)

  let lastError = null
  for (let attempt = 0; attempt <= autoRetry; attempt++) {
    try {
      const res = await rawRequest(options)
      return normalizeSuccess(res, options)
    } catch (e) {
      lastError = e && e.name === 'RequestError' ? e : normalizeFail(e, options)
      // 网络/超时类错误才值得重试，业务错误重试无意义
      const retryable = lastError.kind === 'network' || lastError.kind === 'timeout'
      if (!retryable || attempt === autoRetry) {
        break
      }
    }
  }

  if (!lastError.silent) {
    toast(lastError.message)
  }
  throw lastError
}

export default request
