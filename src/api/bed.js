import request from '../utils/request'

export function getBedsByWardApi(wardId) {
  return request({
    url: `/v1/beds/by-ward/${wardId}`,
    method: 'GET'
  })
}

/**
 * 病区床位矩阵（带在床患者信息，用于绑定页二次核对）
 */
export function getBedMatrixApi(wardId) {
  return request({
    url: `/v1/beds/visual-matrix/${wardId}`,
    method: 'GET',
    silent: true
  })
}

export function createBedApi(data) {
  return request({
    url: '/v1/beds/create',
    method: 'POST',
    data
  })
}

export function deleteBedApi(bedId) {
  return request({
    url: `/v1/beds/${bedId}`,
    method: 'DELETE'
  })
}
