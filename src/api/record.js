import request from '../utils/request'
import { getBaseUrl } from '../config'

export function recordIntakeApi(data) {
  return request({
    url: '/v1/fluid-records/intake',
    method: 'POST',
    data
  })
}

export function recordOutputApi(data) {
  return request({
    url: '/v1/fluid-records/output',
    method: 'POST',
    data
  })
}

export function deleteIntakeApi(recordId, reason) {
  return request({
    url: `/v1/fluid-records/intake/${recordId}${reason ? '?reason=' + encodeURIComponent(reason) : ''}`,
    method: 'DELETE'
  })
}

export function deleteOutputApi(recordId, reason) {
  return request({
    url: `/v1/fluid-records/output/${recordId}${reason ? '?reason=' + encodeURIComponent(reason) : ''}`,
    method: 'DELETE'
  })
}

export function getDailyBalanceApi(patientId, date) {
  const dateParam = date ? `&date=${date}` : ''
  return request({
    url: `/v1/fluid-records/daily-balance?patientId=${patientId}${dateParam}`,
    method: 'GET'
  })
}

/**
 * 患者反馈「这条记错了」，由护士核对修正
 */
export function submitCorrectionRequestApi(data) {
  return request({
    url: '/v1/fluid-records/correction-request',
    method: 'POST',
    data
  })
}

/**
 * 护士端待核对列表
 */
export function getCorrectionRequestsApi(wardId) {
  const wardParam = wardId ? `&wardId=${wardId}` : ''
  return request({
    url: `/v1/fluid-records/correction-requests?status=PENDING${wardParam}`,
    method: 'GET',
    silent: true
  })
}

/**
 * 护士处理完标记已处理
 */
export function handleCorrectionRequestApi(id) {
  return request({
    url: `/v1/fluid-records/correction-requests/${id}/handled`,
    method: 'POST'
  })
}

export function getHistorySummariesApi(patientId, days = 7) {
  return request({
    url: `/v1/fluid-records/history-summaries?patientId=${patientId}&days=${days}`,
    method: 'GET'
  })
}

/**
 * 多病患、时间范围、多筛选条件出入量查询
 */
export function queryFluidRecordsApi(params) {
  return request({
    url: '/v1/fluid-records/query',
    method: 'POST',
    data: params
  })
}

/**
 * 导出 Excel 文件并直接在小程序中打开
 */
export function exportFluidRecordsExcel(params) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token')
    
    // 构建 GET Query 参数
    const queryParts = []
    if (params) {
      if (params.patientIds && params.patientIds.length > 0) {
        queryParts.push(`patientIds=${params.patientIds.join(',')}`)
      }
      if (params.wardId) {
        queryParts.push(`wardId=${params.wardId}`)
      }
      if (params.startDate) {
        queryParts.push(`startDate=${params.startDate}`)
      }
      if (params.endDate) {
        queryParts.push(`endDate=${params.endDate}`)
      }
      if (params.category && params.category !== 'ALL') {
        queryParts.push(`category=${params.category}`)
      }
      if (params.recorderRole && params.recorderRole !== 'ALL') {
        queryParts.push(`recorderRole=${params.recorderRole}`)
      }
      if (params.keyword) {
        queryParts.push(`keyword=${encodeURIComponent(params.keyword)}`)
      }
    }
    
    const queryStr = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
    const url = `${getBaseUrl()}/v1/fluid-records/export-excel${queryStr}`

    uni.showLoading({ title: '正在生成报表...', mask: true })

    uni.downloadFile({
      url,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        uni.hideLoading()
        if (res.statusCode === 200) {
          const filePath = res.tempFilePath
          // 打开文档
          uni.openDocument({
            filePath: filePath,
            fileType: 'xlsx',
            showMenu: true, // 允许右上角菜单转发/保存
            success: () => {
              uni.showToast({ title: '报表已打开', icon: 'success' })
              resolve(filePath)
            },
            fail: (err) => {
              console.error('打开Excel失败', err)
              uni.showToast({ title: '打开文件失败', icon: 'none' })
              reject(err)
            }
          })
        } else {
          uni.showToast({ title: `导出失败(${res.statusCode})`, icon: 'none' })
          reject(new Error(`HTTP ${res.statusCode}`))
        }
      },
      fail: (err) => {
        uni.hideLoading()
        console.error('下载报表失败', err)
        uni.showToast({ title: '下载报表失败，请检查网络', icon: 'none' })
        reject(err)
      }
    })
  })
}
