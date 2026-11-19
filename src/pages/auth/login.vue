<template>
  <view class="login-container">
    <!-- 顶部品牌展示区域（参考图2设计） -->
    <view class="brand-section">
      <view class="logo-box">
        <text class="logo-emoji">💧</text>
      </view>
      <text class="brand-title">出入量记录助手</text>
      <text class="brand-subtitle">住院病患液体平衡监测与按天统计系统</text>
    </view>

    <!-- 底部操作与授权区域 -->
    <view class="action-section">
      <!-- 微信一键授权登录大按钮 -->
      <button 
        class="wx-login-btn" 
        :loading="loading" 
        :disabled="loading"
        @tap="handleLogin"
      >
        <text class="wx-icon">💬</text>
        <text class="btn-text">微信一键授权登录</text>
      </button>

      <!-- 隐私与服务协议 -->
      <view class="protocol-box" @tap="toggleAgreement">
        <text class="checkbox" :class="{ checked: isAgreed }">{{ isAgreed ? '✓' : '' }}</text>
        <text class="protocol-text">
          已阅读并同意
          <text class="protocol-link" @tap.stop="showProtocol">《临床出入量记录服务协议与隐私政策》</text>
        </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '../../stores/user'
import { syncRoleTabBar } from '../../utils/tabbar'

const userStore = useUserStore()
const loading = ref(false)
const isAgreed = ref(true)

function toggleAgreement() {
  isAgreed.value = !isAgreed.value
}

async function handleLogin() {
  if (!isAgreed.value) {
    uni.showToast({
      title: '请先勾选同意服务协议与隐私政策',
      icon: 'none'
    })
    return
  }

  loading.value = true
  try {
    // 1. 调用微信原生登录并向后端换取 OpenID 与登录态
    const data = await userStore.loginWithWechat()

    // 2. 核心业务分流：微信登陆后，先验证是否已经绑定
    if (!data.isBound) {
      // 未绑定 -> 弹出提示并跳转到绑定界面（图3）
      uni.showToast({ 
        title: '微信授权成功，请核验身份', 
        icon: 'none', 
        duration: 1500 
      })
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/auth/bind' })
      }, 800)
    } else {
      // 已绑定 -> 根据临床角色分流至对应工作台
      uni.showToast({ 
        title: '登录成功', 
        icon: 'success',
        duration: 1200
      })
      setTimeout(() => {
        syncRoleTabBar()
        if (data.role === 'PATIENT') {
          uni.switchTab({ url: '/pages/patient-view/home' })
        } else {
          uni.switchTab({ url: '/pages/index/index' })
        }
      }, 600)
    }
  } catch (e) {
    uni.showToast({
      title: e.message || '微信授权登录失败，请重试',
      icon: 'none',
      duration: 2500
    })
  } finally {
    loading.value = false
  }
}

function showProtocol() {
  uni.showModal({
    title: '用户与临床服务规范',
    content: '1. 本系统严格遵循临床出入量记录规范与医疗数据安全要求。\n2. 医护人员需使用医院分配的6位纯数字工号进行身份核验与绑定。\n3. 住院患者凭真实姓名、病房及床位号进行精确匹配绑定。\n4. 授权微信仅用于系统安全会话凭证同步与身份识别。',
    showCancel: false
  })
}
</script>

<style>
.login-container {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  min-height: 100vh;
  padding: 160rpx 48rpx 100rpx 48rpx;
  background-color: #ffffff;
  box-sizing: border-box;
}

.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 100rpx;
}

.logo-box {
  width: 190rpx;
  height: 190rpx;
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16rpx 40rpx rgba(22, 119, 255, 0.28);
  margin-bottom: 44rpx;
}

.logo-emoji {
  font-size: 96rpx;
}

.brand-title {
  font-size: 52rpx;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: 2rpx;
  margin-bottom: 20rpx;
}

.brand-subtitle {
  font-size: 28rpx;
  color: #8c8c8c;
  text-align: center;
  line-height: 1.5;
}

.action-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 80rpx;
}

.wx-login-btn {
  width: 100%;
  height: 100rpx;
  line-height: 100rpx;
  background-color: #07c160;
  border-radius: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  box-shadow: 0 12rpx 30rpx rgba(7, 193, 96, 0.28);
  margin-bottom: 36rpx;
}

.wx-login-btn:active {
  background-color: #06ad56;
}

.wx-icon {
  font-size: 44rpx;
  margin-right: 16rpx;
  line-height: 1;
}

.btn-text {
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
}

.protocol-box {
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid #bfbfbf;
  border-radius: 6rpx;
  margin-right: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  color: #ffffff;
  transition: all 0.2s;
}

.checkbox.checked {
  background-color: #07c160;
  border-color: #07c160;
}

.protocol-text {
  font-size: 24rpx;
  color: #8c8c8c;
  line-height: 1.4;
}

.protocol-link {
  color: #1677ff;
}
</style>
