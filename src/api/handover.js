import { request } from '../utils/request'
import { getBaseUrl } from '../config'

export function getSpecialHandoverApi(wardId, date, shiftType = 'ALL_DAY') {
  const dateParam = date ? `&date=${date}` : ''
  return request({
    url: `/v1/handover/special?wardId=${wardId}${dateParam}&shiftType=${shiftType}`,
    method: 'GET'
  })
}

export function saveSpecialHandoverApi(data) {
  return request({
    url: '/v1/handover/special/save',
    method: 'POST',
    data
  })
}

export function signSpecialHandoverApi(id) {
  return request({
    url: `/v1/handover/special/sign/${id}`,
    method: 'POST'
  })
}

export function confirmSpecialHandoverApi(id) {
  return request({
    url: `/v1/handover/special/confirm/${id}`,
    method: 'POST'
  })
}

export function getHandoverHistoryApi(wardId, startDate, endDate) {
  let url = `/v1/handover/special/history?wardId=${wardId}`
  if (startDate) url += `&startDate=${startDate}`
  if (endDate) url += `&endDate=${endDate}`
  return request({
    url,
    method: 'GET'
  })
}

/* =========================================================
 * 交班工作台（PC 提交 → 小程序接班签名）
 * 与「特殊交接班」是两套单据，接口前缀 /v1/handover/shift
 * ========================================================= */

export function getShiftHandoverPendingApi(wardId) {
  const suffix = wardId ? `?wardId=${wardId}` : ''
  return request({
    url: `/v1/handover/shift/pending${suffix}`,
    method: 'GET'
  })
}

export function getShiftHandoverDetailApi(id) {
  return request({
    url: `/v1/handover/shift/${id}`,
    method: 'GET'
  })
}

export function receiveShiftHandoverApi(id, data) {
  return request({
    url: `/v1/handover/shift/${id}/receive`,
    method: 'POST',
    data
  })
}

/**
 * 上传电子签名图片。
 * 走已有的 /v1/file/upload（MinIO），因此不能像普通接口那样统一封装 JSON，
 * 必须用 uni.uploadFile；地址取 getBaseUrl()，避免真机上写死 localhost。
 */
export function uploadSignatureApi(filePath) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token')
    uni.uploadFile({
      url: `${getBaseUrl()}/v1/file/upload`,
      filePath,
      name: 'file',
      header: {
        Authorization: token ? `Bearer ${token}` : ''
      },
      formData: {
        folder: 'signature'
      },
      success: (res) => {
        try {
          const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          if (body && body.code === 200) {
            const url = body.data && body.data.fileUrl ? body.data.fileUrl : ''
            if (url) {
              resolve(url)
            } else {
              reject(new Error('签名上传未返回地址'))
            }
          } else {
            reject(new Error((body && body.message) || '签名上传失败'))
          }
        } catch (e) {
          reject(new Error('签名上传返回异常'))
        }
      },
      fail: () => reject(new Error('签名上传失败，请检查网络'))
    })
  })
}
