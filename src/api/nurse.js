import request from '../utils/request'

/**
 * 护士长查询护士名册（含负责床位/病患统计）
 */
export function getManageNursesApi() {
  return request({
    url: '/v1/nurses/manage-list',
    method: 'GET'
  })
}

/**
 * 获取在职护士选项列表（免护士长鉴权，用于交接班选择接班护士等）
 */
export function getNurseOptionsApi(wardId) {
  return request({
    url: '/v1/nurses/options' + (wardId ? `?wardId=${wardId}` : ''),
    method: 'GET'
  })
}

/**
 * 护士长保存护士（新增或编辑）
 */
export function saveNurseApi(data) {
  return request({
    url: '/v1/nurses',
    method: 'POST',
    data
  })
}

/**
 * 切换护士在职/停用状态
 */
export function toggleNurseStatusApi(id) {
  return request({
    url: `/v1/nurses/${id}/toggle-status`,
    method: 'POST'
  })
}

/**
 * 护士长协助护士解绑微信账号
 */
export function unbindNurseWechatApi(id) {
  return request({
    url: `/v1/nurses/${id}/unbind-wechat`,
    method: 'POST'
  })
}

/**
 * 获取指定病房下某护士的床位分配情况
 */
export function getNurseAssignmentsApi(nurseId, wardId) {
  return request({
    url: `/v1/nurses/${nurseId}/assignments`,
    method: 'GET',
    data: { wardId }
  })
}

/**
 * 当前登录护士查询自己当班的床位管辖情况
 */
export function getMyAssignmentsApi(wardId) {
  return request({
    url: '/v1/nurses/my-assignments',
    method: 'GET',
    data: { wardId }
  })
}

/**
 * 护士当班自主认领/变更管辖床位（勾选接班不覆盖他人，取消勾选解除自身管辖）
 */
export function claimMyDutyBedsApi(data) {
  return request({
    url: '/v1/nurses/claim-my-beds',
    method: 'POST',
    data
  })
}

/**
 * 护士长批量分配床位给护士
 */
export function assignNurseBedsApi(data) {
  return request({
    url: '/v1/nurses/assign-beds',
    method: 'POST',
    data
  })
}
