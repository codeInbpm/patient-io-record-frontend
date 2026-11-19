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
