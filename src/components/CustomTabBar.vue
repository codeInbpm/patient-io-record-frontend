<template>
  <view class="custom-tabbar-placeholder"></view>
  <view class="custom-tabbar-wrapper">
    <view 
      v-for="item in tabList" 
      :key="item.path"
      class="tabbar-item"
      :class="{ 'tabbar-item-active': current === item.key }"
      @tap="handleSwitch(item)"
    >
      <image class="tabbar-icon" :src="current === item.key ? item.selectedIcon : item.icon" />
      <text class="tabbar-label">{{ item.text }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '../stores/user'

const props = defineProps({
  current: {
    type: String,
    default: ''
  }
})

const userStore = useUserStore()

const nurseTabs = [
  {
    key: 'index',
    text: '病房工作台',
    path: '/pages/index/index',
    icon: '/static/tabbar/tab-home.png',
    selectedIcon: '/static/tabbar/tab-home-active.png'
  },
  {
    key: 'stats',
    text: '平衡统计',
    path: '/pages/stats/daily',
    icon: '/static/tabbar/tab-stats.png',
    selectedIcon: '/static/tabbar/tab-stats-active.png'
  },
  {
    key: 'mine',
    text: '我的',
    path: '/pages/mine/mine',
    icon: '/static/tabbar/tab-mine.png',
    selectedIcon: '/static/tabbar/tab-mine-active.png'
  }
]

const patientTabs = [
  {
    key: 'patient',
    text: '患者端',
    path: '/pages/patient-view/home',
    icon: '/static/tabbar/tab-patient.png',
    selectedIcon: '/static/tabbar/tab-patient-active.png'
  },
  {
    key: 'mine',
    text: '我的',
    path: '/pages/mine/mine',
    icon: '/static/tabbar/tab-mine.png',
    selectedIcon: '/static/tabbar/tab-mine-active.png'
  }
]

const tabList = computed(() => {
  return userStore.isPatient ? patientTabs : nurseTabs
})

function handleSwitch(item) {
  if (props.current === item.key) return
  uni.switchTab({
    url: item.path
  })
}
</script>

<style>
.custom-tabbar-placeholder {
  height: calc(108rpx + env(safe-area-inset-bottom));
  width: 100%;
}

.custom-tabbar-wrapper {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(108rpx + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-around;
  border-top: 1rpx solid #e8e8e8;
  z-index: 999;
  box-sizing: border-box;
}

.tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8rpx 0;
}

.tabbar-icon {
  width: 48rpx;
  height: 48rpx;
  margin-bottom: 4rpx;
}

.tabbar-label {
  font-size: 20rpx;
  color: #8c8c8c;
  line-height: 1.2;
}

.tabbar-item-active .tabbar-label {
  color: #1677ff;
  font-weight: 500;
}
</style>
