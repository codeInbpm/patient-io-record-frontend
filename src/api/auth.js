import request from '../utils/request'

/**
 * 真实微信授权登录（传入wx.login获取的code）
 */
export function wxLoginApi(data) {
  return request({
    url: '/v1/auth/wx-login',
    method: 'POST',
    data
  })
}

/**
 * 医护人员通过6位纯数字工号绑定（支持关联所属医院与科室）
 */
export function bindNurseApi(data) {
  const payload = typeof data === 'string' ? { jobNumber: data } : data
  return request({
    url: '/v1/auth/bind-nurse',
    method: 'POST',
    data: payload
  })
}

/**
 * 患者/家属通过「姓名 + 病房 + 床位号」精确匹配绑定
 */
export function bindPatientApi(data) {
  return request({
    url: '/v1/auth/bind-patient',
    method: 'POST',
    data
  })
}

/**
 * 获取当前用户信息与绑定状态
 */
export function getUserInfoApi() {
  return request({
    url: '/v1/auth/me',
    method: 'GET'
  })
}

/**
 * 解绑当前身份
 */
export function unbindApi() {
  return request({
    url: '/v1/auth/unbind',
    method: 'POST'
  })
}

/**
 * 查询在职护士名册（护士长分配护士使用）
 */
export function getActiveNursesApi() {
  return request({
    url: '/v1/auth/nurses',
    method: 'GET'
  })
}
