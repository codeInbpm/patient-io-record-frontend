<script>
import { useUserStore } from './stores/user'
import { syncRoleTabBar } from './utils/tabbar'
import { initOfflineSync } from './utils/offline'

export default {
  onLaunch: async function () {
    const userStore = useUserStore()

    // 弱网离线队列：网络恢复 / 回到前台时自动补传
    initOfflineSync()

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
  },
  onHide: function () {}
}
</script>

<style>
/* 全局基础样式 */
page {
  background-color: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1f2329;
  box-sizing: border-box;
  /* 适配 iPhone 底部横条 */
  padding-bottom: env(safe-area-inset-bottom);
}

view, text, button, input, textarea {
  box-sizing: border-box;
}

/* 移动端可读性：正文不小于 26rpx（约 13px），关键信息 28rpx+ */
.u-text-base {
  font-size: 28rpx;
  color: #1f2329;
}

.u-text-sub {
  font-size: 26rpx;
  color: #6b7280;
}

/* 触控区不小于 88rpx（约 44px） */
.u-tap-area {
  min-height: 88rpx;
  display: flex;
  align-items: center;
}

/* 底部固定操作栏统一安全区 */
.u-bottom-bar {
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

button::after {
  border: none;
}
</style>
