import { request } from '../utils/request'

export function createInfusionApi(data) {
  return request({
    url: '/v1/infusion/create',
    method: 'POST',
    data
  })
}

export function endInfusionApi(data) {
  return request({
    url: '/v1/infusion/end',
    method: 'POST',
    data
  })
}

export function getActiveInfusionsApi(wardId) {
  const url = wardId ? `/v1/infusion/active?wardId=${wardId}` : '/v1/infusion/active'
  return request({
    url,
    method: 'GET'
  })
}

export function getCompletedInfusionsApi(wardId, date) {
  let url = wardId ? `/v1/infusion/completed?wardId=${wardId}` : '/v1/infusion/completed'
  if (date) url += `&date=${date}`
  return request({
    url,
    method: 'GET'
  })
}

export function getPatientInfusionHistoryApi(patientId) {
  return request({
    url: `/v1/infusion/patient/history?patientId=${patientId}`,
    method: 'GET'
  })
}

export function uploadInfusionImageApi(filePath) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token')
    uni.uploadFile({
      url: 'http://localhost:8080/api/v1/file/upload',
      filePath: filePath,
      name: 'file',
      header: {
        Authorization: token ? `Bearer ${token}` : ''
      },
      formData: {
        folder: 'infusion'
      },
      success: (uploadRes) => {
        try {
          const res = JSON.parse(uploadRes.data)
          if (res.code === 200) {
            // 关键：后端返回的是 UploadResult 对象，必须取出纯字符串 fileUrl
            const fileUrl = (res.data && res.data.fileUrl) ? res.data.fileUrl : (typeof res.data === 'string' ? res.data : '')
            resolve(fileUrl)
          } else {
            uni.showToast({ title: res.message || '上传失败', icon: 'none' })
            reject(new Error(res.message))
          }
        } catch (e) {
          reject(e)
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络上传异常', icon: 'none' })
        reject(err)
      }
    })
  })
}
