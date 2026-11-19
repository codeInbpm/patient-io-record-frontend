import request from '../utils/request'

export function getBedsByWardApi(wardId) {
  return request({
    url: `/v1/beds/by-ward/${wardId}`,
    method: 'GET'
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
