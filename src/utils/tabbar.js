/**
 * 隐藏原生微信小程序 TabBar，确保自定义角色 TabBar 正常展示
 */
export function syncRoleTabBar() {
  try {
    uni.hideTabBar({
      animation: false,
      fail: () => {}
    })
  } catch (e) {
    // 忽略平台兼容性异常
  }
}
