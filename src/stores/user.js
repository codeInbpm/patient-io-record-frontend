import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wxLoginApi, getUserInfoApi, unbindApi } from '../api/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref(uni.getStorageSync('token') || '')
  const userInfo = ref(uni.getStorageSync('userInfo') || null)

  const isHeadNurse = computed(() => userInfo.value?.role === 'HEAD_NURSE')
  const isNurse = computed(() => userInfo.value?.role === 'NURSE')
  const isPatient = computed(() => userInfo.value?.role === 'PATIENT')
  const isBound = computed(() => Boolean(userInfo.value?.isBound))

  /**
   * 真实微信小程序授权登录
   */
  async function loginWithWechat() {
    return new Promise((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: async (loginRes) => {
          if (!loginRes.code) {
            reject(new Error('未获取到微信登录凭证 code'))
            return
          }
          try {
            const data = await wxLoginApi({ code: loginRes.code })
            token.value = data.token
            userInfo.value = data
            uni.setStorageSync('token', data.token)
            uni.setStorageSync('userInfo', data)
            resolve(data)
          } catch (e) {
            reject(e)
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  }

  async function refreshUserInfo() {
    if (!token.value) return null
    try {
      const data = await getUserInfoApi()
      userInfo.value = data
      uni.setStorageSync('userInfo', data)
      return data
    } catch (e) {
      console.error('获取用户信息失败:', e)
      return null
    }
  }

  async function unbind() {
    await unbindApi()
    if (userInfo.value) {
      userInfo.value.role = 'NONE'
      userInfo.value.isBound = false
      userInfo.value.realName = null
      userInfo.value.jobNumber = null
      userInfo.value.boundPatientId = null
      uni.setStorageSync('userInfo', userInfo.value)
    }
  }

  function setLoginData(data) {
    if (data && data.token) {
      token.value = data.token
      uni.setStorageSync('token', data.token)
    }
    if (data) {
      userInfo.value = data
      uni.setStorageSync('userInfo', data)
    }
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    uni.removeStorageSync('token')
    uni.removeStorageSync('userInfo')
  }

  return {
    token,
    userInfo,
    isHeadNurse,
    isNurse,
    isPatient,
    isBound,
    setLoginData,
    loginWithWechat,
    refreshUserInfo,
    unbind,
    logout
  }
})
