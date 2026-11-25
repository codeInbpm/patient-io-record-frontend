import request from '../utils/request'

export function getWardsApi(params = { status: 1 }) {
  return request({
    url: '/v1/wards/list',
    method: 'GET',
    params
  })
}

export function createWardApi(data) {
  return request({
    url: '/v1/wards/create',
    method: 'POST',
    data
  })
}

export function getWardOverviewApi(wardId) {
  return request({
    url: `/v1/wards/${wardId}/overview`,
    method: 'GET',
    silent: true // 失败态由页面统一展示，避免重复弹提示
  })
}
