<script>
import { useUserStore } from './stores/user'
import { syncRoleTabBar } from './utils/tabbar'

export default {
  onLaunch: async function () {
    const userStore = useUserStore()
    
    // 1. 如果本地无有效 Token，直接重定向至图2所示的「独立微信登录页」
    if (!userStore.token) {
      uni.reLaunch({ url: '/pages/auth/login' })
      return
    }

    // 2. 如果本地有 Token，校验当前有效性与绑定状态
    try {
      const data = await userStore.refreshUserInfo()
      if (!data) {
        userStore.logout()
        uni.reLaunch({ url: '/pages/auth/login' })
        return
      }

      // 调整 TabBar
      syncRoleTabBar()

      // 未绑定临床身份 -> 跳转至图3所示的「身份绑定与核验页」
      if (!data.isBound) {
        uni.reLaunch({ url: '/pages/auth/bind' })
      } else if (data.role === 'PATIENT') {
        // 已绑定患者 -> 进入患者端
        uni.switchTab({ url: '/pages/patient-view/home' })
      } else {
        // 已绑定护士长或护士 -> 进入工作台
        uni.switchTab({ url: '/pages/index/index' })
      }
    } catch (e) {
      userStore.logout()
      uni.reLaunch({ url: '/pages/auth/login' })
    }
  },
  onShow: function () {
    syncRoleTabBar()
    console.log('App Show')
  },
  onHide: function () {
    console.log('App Hide')
  }
}
</script>

<style>
/* 全局基础样式 */
page {
  background-color: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #333333;
  box-sizing: border-box;
}

view, text, button, input {
  box-sizing: border-box;
}
</style>
