import request from '../utils/request'

/**
 * 获取医院及科室级联字典列表
 */
export function getHospitalsApi() {
  return request({
    url: '/v1/dict/hospitals',
    method: 'GET'
  })
}

/**
 * 按医院获取科室列表
 */
export function getDepartmentsApi(hospitalId) {
  return request({
    url: '/v1/dict/departments',
    method: 'GET',
    data: hospitalId ? { hospitalId } : {}
  })
}

/**
 * 补液药品检索（中文名 / 拼音全拼 / 首字母）
 * kw 为空时返回科室高频用药
 */
export function searchDrugsApi(kw, options = {}) {
  return request({
    url: '/v1/dict/drugs/search',
    method: 'GET',
    data: {
      kw: kw || '',
      limit: options.limit || 10,
      ...(options.route ? { route: options.route } : {})
    }
  })
}

/**
 * 我的药品库（含待确认、已停用），个人自查自改用
 */
export function getDrugLibraryApi(options = {}) {
  return request({
    url: '/v1/dict/drugs/library',
    method: 'GET',
    data: {
      kw: options.kw || '',
      page: options.page || 1,
      size: options.size || 20
    }
  })
}

/**
 * 新增 / 编辑药品，保存后自动启用
 */
export function saveDrugApi(payload) {
  return request({
    url: '/v1/dict/drugs',
    method: 'POST',
    data: payload
  })
}

/**
 * 启用(1) / 停用(2)
 */
export function updateDrugStatusApi(id, status) {
  return request({
    url: `/v1/dict/drugs/${id}/status?status=${status}`,
    method: 'PUT'
  })
}

/**
 * 从药品库删除
 */
export function deleteDrugApi(id) {
  return request({
    url: `/v1/dict/drugs/${id}`,
    method: 'DELETE'
  })
}
