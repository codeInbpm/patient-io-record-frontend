const BASE_URL = 'http://localhost:8080/api' // 开发环境后端服务地址

let isRedirecting = false

export function request(options = {}) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token')

    const header = {
      'Content-Type': 'application/json',
      ...options.header
    }

    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }

    uni.request({
      url: options.url.startsWith('http') ? options.url : BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: header,
      timeout: 10000,
      success: (res) => {
        if (res.statusCode === 200) {
          const body = res.data
          if (body.code === 200) {
            resolve(body.data)
          } else if (body.code === 401) {
            uni.removeStorageSync('token')
            uni.removeStorageSync('userInfo')
            if (!isRedirecting) {
              isRedirecting = true
              uni.showToast({
                title: body.message || '登录凭证已过期',
                icon: 'none',
                duration: 2000
              })
              setTimeout(() => {
                isRedirecting = false
                uni.reLaunch({ url: '/pages/auth/login' })
              }, 1200)
            }
            reject(new Error(body.message || '未登录'))
          } else {
            uni.showToast({
              title: body.message || '操作失败',
              icon: 'none',
              duration: 2500
            })
            reject(new Error(body.message || 'Error'))
          }
        } else {
          uni.showToast({
            title: `网络错误 ${res.statusCode}`,
            icon: 'none'
          })
          reject(new Error(`HTTP ${res.statusCode}`))
        }
      },
      fail: (err) => {
        uni.showToast({
          title: '网络连接异常，请检查后端服务',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

export default request
