import { request } from '../utils/request'

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
