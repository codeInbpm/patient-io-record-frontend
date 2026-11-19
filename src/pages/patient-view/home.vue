<template>
  <view class="container">
    <!-- 未登录提示卡片 -->
    <view class="unbind-card" v-if="!userStore.token">
      <view class="icon-wrap">🔒</view>
      <text class="unbind-title">您尚未登录微信账号</text>
      <text class="unbind-desc">登录后即可进入患者端查看个人出入量与进行快捷填报。</text>
      <button class="bind-nav-btn" type="primary" @tap="goToLogin">前往微信登录</button>
    </view>

    <!-- 未绑定状态提示 -->
    <view class="unbind-card" v-else-if="!userStore.isBound || !patient">
      <view class="icon-wrap">🏥</view>
      <text class="unbind-title">您尚未绑定住院病床</text>
      <text class="unbind-desc">请凭真实姓名、科室病房及床位号进行核验绑定后方可记录出入量。</text>
      <button class="bind-nav-btn" type="primary" @tap="goToBind">立即进行床位绑定</button>
    </view>

    <!-- 已绑定患者端主页 -->
    <view v-else>
      <view class="patient-card">
        <view class="p-top">
          <text class="p-bed">{{ patient.bedNo }}</text>
          <text class="p-name">{{ patient.patientName }}</text>
          <text class="p-ward">{{ patient.wardName }}</text>
        </view>
        <view class="p-sub-row">
          <text>住院号：{{ patient.hospitalNo }}</text>
          <text v-if="patient.assignedNurseName">责任护士：{{ patient.assignedNurseName }}</text>
        </view>
      </view>

      <!-- 今日出入量卡片 -->
      <view class="today-io-card" v-if="todayBalance">
        <view class="card-head">
          <text class="h-title">今日出入平衡 (自然日 {{ todayStr }})</text>
        </view>
        <view class="io-three-col">
          <view class="col-item in">
            <text class="val">{{ todayBalance.totalIntake || 0 }}</text>
            <text class="lbl">已摄入/喝水(ml)</text>
          </view>
          <view class="col-item out">
            <text class="val">{{ todayBalance.totalOutput || 0 }}</text>
            <text class="lbl">已排泄/排出(ml)</text>
          </view>
          <view class="col-item net">
            <text :class="['val', (todayBalance.netBalance || 0) >= 0 ? 'pos' : 'neg']">
              {{ (todayBalance.netBalance || 0) > 0 ? '+' : '' }}{{ todayBalance.netBalance || 0 }}
            </text>
            <text class="lbl">净平衡(ml)</text>
          </view>
        </view>
      </view>

      <!-- 极简一键快捷填报入口 -->
      <view class="quick-submit-section">
        <text class="sec-title">快捷填报</text>
        <view class="btn-grid">
          <view class="btn-box water" @tap="quickRecord('intake')">
            <text class="emoji">🥛</text>
            <text class="b-title">记喝水/吃流食</text>
            <text class="b-desc">水、粥、面条、米汤、藕粉</text>
          </view>
          <view class="btn-box urine" @tap="quickRecord('output')">
            <text class="emoji">🚽</text>
            <text class="b-title">记排尿/大便</text>
            <text class="b-desc">尿量、排便量及性状</text>
          </view>
        </view>
      </view>

      <!-- 我今天填报的流水记录 -->
      <view class="my-timeline">
        <text class="sec-title">今日流水记录 (共 {{ myItems.length }} 笔)</text>
        <view class="record-item" v-for="item in myItems" :key="item.id + item.category">
          <text :class="['r-type', item.category === 'INTAKE' ? 'in' : 'out']">
            {{ item.category === 'INTAKE' ? '入量' : '出量' }}
          </text>
          <view class="r-info">
            <text class="r-name">{{ item.itemName }}</text>
            <text class="r-time">{{ item.recordTime ? item.recordTime.substring(11, 16) : '' }} • {{ (item.recorderRole === 'PATIENT' || item.recorderText === '本人录入' || item.recorderName === '本人') ? '本人录入' : '护士录入' }}</text>
          </view>
          <text :class="['r-amt', item.category === 'INTAKE' ? 'in' : 'out']">
            {{ item.category === 'INTAKE' ? '+' : '-' }}{{ item.amount }} ml
          </text>
        </view>
        <view class="empty-text" v-if="myItems.length === 0">
          今日尚未有记录，请点击上方按钮记录
        </view>
      </view>
    </view>

    <!-- 底部角色定制导航栏 -->
    <CustomTabBar current="patient" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user'
import { getMyBoundPatientApi } from '../../api/patient'
import { getDailyBalanceApi } from '../../api/record'
import { formatDate } from '../../utils/date'
import { syncRoleTabBar } from '../../utils/tabbar'
import CustomTabBar from '../../components/CustomTabBar.vue'

const userStore = useUserStore()
const patient = ref(null)
const todayBalance = ref(null)
const todayStr = ref(formatDate())

const myItems = computed(() => {
  return todayBalance.value?.items || []
})

async function checkPatient() {
  if (!userStore.token || !userStore.isBound) {
    patient.value = null
    return
  }

  try {
    const p = await getMyBoundPatientApi()
    patient.value = p
    if (p) {
      const b = await getDailyBalanceApi(p.id, todayStr.value)
      todayBalance.value = b
    }
  } catch (e) {
    console.error(e)
  }
}

function goToLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}

function goToBind() {
  uni.navigateTo({ url: '/pages/auth/bind' })
}

function quickRecord(type) {
  if (!patient.value) return
  uni.navigateTo({
    url: `/pages/record/${type}?patientId=${patient.value.id}`
  })
}

onMounted(() => {
  checkPatient()
})

onShow(() => {
  syncRoleTabBar()
  checkPatient()
})

onPullDownRefresh(async () => {
  await checkPatient()
  uni.stopPullDownRefresh()
})
</script>

<style>
.container {
  padding: 24rpx;
}

.unbind-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 60rpx 40rpx;
  text-align: center;
  margin-top: 40rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.icon-wrap {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.unbind-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #262626;
  display: block;
  margin-bottom: 16rpx;
}

.unbind-desc {
  font-size: 26rpx;
  color: #8c8c8c;
  line-height: 1.6;
  display: block;
  margin-bottom: 40rpx;
}

.bind-nav-btn {
  border-radius: 40rpx;
  font-size: 28rpx;
}

.patient-card {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  color: #ffffff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 24rpx;
}

.p-top {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.p-bed {
  background: rgba(255, 255, 255, 0.25);
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-weight: bold;
  margin-right: 14rpx;
}

.p-name {
  font-size: 34rpx;
  font-weight: bold;
}

.p-ward {
  margin-left: auto;
  font-size: 24rpx;
  opacity: 0.9;
}

.p-sub-row {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  opacity: 0.85;
}

.today-io-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 24rpx;
}

.card-head {
  margin-bottom: 20rpx;
}

.h-title {
  font-size: 26rpx;
  font-weight: bold;
  color: #262626;
}

.io-three-col {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.val {
  font-size: 38rpx;
  font-weight: bold;
  display: block;
}

.lbl {
  font-size: 22rpx;
  color: #8c8c8c;
  margin-top: 6rpx;
}

.col-item.in .val { color: #52c41a; }
.col-item.out .val { color: #fa8c16; }
.val.pos { color: #1677ff; }
.val.neg { color: #eb2f96; }

.quick-submit-section {
  margin-bottom: 24rpx;
}

.sec-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #262626;
  display: block;
  margin-bottom: 16rpx;
}

.btn-grid {
  display: flex;
  gap: 20rpx;
}

.btn-box {
  flex: 1;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 30rpx 20rpx;
  text-align: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.emoji {
  font-size: 54rpx;
  display: block;
  margin-bottom: 12rpx;
}

.b-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #262626;
  display: block;
}

.b-desc {
  font-size: 22rpx;
  color: #8c8c8c;
  margin-top: 6rpx;
}

.btn-box.water { border-top: 6rpx solid #52c41a; }
.btn-box.urine { border-top: 6rpx solid #fa8c16; }

.my-timeline {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.record-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1px solid #f5f5f5;
}

.r-type {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  margin-right: 16rpx;
}

.r-type.in { background: #f6ffed; color: #52c41a; }
.r-type.out { background: #fffbe6; color: #fa8c16; }

.r-info { flex: 1; }
.r-name { font-size: 28rpx; font-weight: bold; color: #262626; display: block; }
.r-time { font-size: 22rpx; color: #8c8c8c; }
.r-amt { font-size: 30rpx; font-weight: bold; }
.r-amt.in { color: #52c41a; }
.r-amt.out { color: #fa8c16; }

.empty-text {
  text-align: center;
  font-size: 24rpx;
  color: #8c8c8c;
  padding: 40rpx 0;
}
</style>
