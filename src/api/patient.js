import request from '../utils/request'

/**
 * 查询当前角色可见的病人列表（不做查询限制，护士可查看所有患者，亦可通过 myOnly=true 仅看我负责的）
 */
export function getPatientsApi(wardId, myOnly = false) {
  const params = []
  if (wardId) params.push(`wardId=${wardId}`)
  if (myOnly) params.push(`myOnly=true`)
  const url = params.length > 0 ? `/v1/patients/list?${params.join('&')}` : '/v1/patients/list'
  return request({
    url,
    method: 'GET'
  })
}

export const getPatientsByWardApi = getPatientsApi

export function getPatientDetailApi(patientId) {
  return request({
    url: `/v1/patients/${patientId}`,
    method: 'GET'
  })
}

/**
 * 护士长：创建病人档案
 */
export function createPatientApi(data) {
  return request({
    url: '/v1/patients/create',
    method: 'POST',
    data
  })
}

/**
 * 护士长：分配责任护士
 */
export function assignNurseApi(patientId, nurseId) {
  return request({
    url: '/v1/patients/assign-nurse',
    method: 'POST',
    data: { patientId, nurseId }
  })
}

/**
 * 患者端：查询本人已绑定的档案
 */
export function getMyBoundPatientApi() {
  return request({
    url: '/v1/patients/my',
    method: 'GET'
  })
}

/**
 * 护士长：办理出院
 */
export function dischargePatientApi(patientId) {
  return request({
    url: `/v1/patients/${patientId}/discharge`,
    method: 'POST'
  })
}
