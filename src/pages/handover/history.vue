<template>
  <view class="history-container">
    <!-- 1. 顶部病区与角色卡片 -->
    <view class="top-header-card">
      <view class="ward-selector-row">
        <picker
          mode="selector"
          :range="wardList"
          range-key="wardName"
          :value="currentWardIndex"
          @change="onWardChange"
        >
          <view class="ward-pill">
            <text class="ward-icon">🏥</text>
            <text class="ward-name">{{ currentWardName }}</text>
            <text class="arrow">▼</text>
          </view>
        </picker>

        <view class="today-btn" @tap="goToTodayHandover">
          <text class="plus-icon">+</text>
          <text>填写今日交接簿</text>
        </view>
      </view>

      <view class="role-perspective-row">
        <text class="nurse-badge" :class="{ 'head-nurse': userStore.isHeadNurse }">
          {{ userStore.isHeadNurse ? '护士长全科监管视角' : '责任护士交接视角' }}
        </text>
        <text class="current-user-text">
          当前用户: {{ currentNurseName }}
        </text>
      </view>
    </view>

    <!-- 2. 交接关系切换 Tab（对齐PC端：全部记录 / 我交班的 / 我接班的） -->
    <view class="relation-tabs">
      <view
        class="tab-item"
        :class="{ active: relationType === 'ALL' }"
        @tap="changeRelation('ALL')"
      >
        <text class="tab-text">全部记录</text>
        <text class="badge-count" v-if="counts.all > 0">{{ counts.all }}</text>
      </view>
      <view
        class="tab-item"
        :class="{ active: relationType === 'MY_HANDOVER' }"
        @tap="changeRelation('MY_HANDOVER')"
      >
        <text class="tab-text">我交班的</text>
        <text class="badge-count" v-if="counts.myHandover > 0">{{ counts.myHandover }}</text>
      </view>
      <view
        class="tab-item"
        :class="{ active: relationType === 'MY_SUCCESSOR' }"
        @tap="changeRelation('MY_SUCCESSOR')"
      >
        <text class="tab-text">我接班的</text>
        <text class="badge-count warning" v-if="counts.myPendingSuccessor > 0">{{ counts.myPendingSuccessor }}</text>
      </view>
    </view>

    <!-- 3. 状态筛选横向滑动栏 -->
    <scroll-view scroll-x class="status-scroll" :show-scrollbar="false">
      <view class="status-wrap">
        <view
          class="status-pill"
          :class="{ active: statusFilter === '' }"
          @tap="changeStatus('')"
        >
          全部状态
        </view>
        <view
          class="status-pill warning"
          :class="{ active: statusFilter === 'SUBMITTED_PENDING' }"
          @tap="changeStatus('SUBMITTED_PENDING')"
        >
          待接班确认
        </view>
        <view
          class="status-pill success"
          :class="{ active: statusFilter === 'CONFIRMED' }"
          @tap="changeStatus('CONFIRMED')"
        >
          已接班确认
        </view>
        <view
          class="status-pill danger"
          :class="{ active: statusFilter === 'LOCKED' }"
          @tap="changeStatus('LOCKED')"
        >
          护士长已归档
        </view>
        <view
          class="status-pill default"
          :class="{ active: statusFilter === 'DRAFT' }"
          @tap="changeStatus('DRAFT')"
        >
          草稿中
        </view>
      </view>
    </scroll-view>

    <!-- 4. 历史交接记录清册卡片列表 -->
    <view class="history-list">
      <view
        class="record-card"
        v-for="item in filteredList"
        :key="item.id || item.handoverDate"
      >
        <!-- 卡片头部：交接日期 + 状态 Tag -->
        <view class="card-header">
          <view class="date-box">
            <text class="calendar-icon">📅</text>
            <text class="date-text">{{ item.handoverDate }}</text>
            <text class="ward-tag">{{ getWardName(item.wardId) }}</text>
          </view>
          <view class="status-tag" :class="getStatusClass(item)">
            {{ getStatusText(item) }}
          </view>
        </view>

        <!-- 交接双方卡片布局 -->
        <view class="nurses-compare-box">
          <!-- 交班方 -->
          <view class="nurse-col">
            <view class="col-title">交班护士</view>
            <view class="nurse-name-row">
              <text class="name">{{ item.handoverNurseName || item.lastEditorName || '当班护士' }}</text>
            </view>
            <view class="time-tip" v-if="item.handoverTime">
              提交: {{ formatTime(item.handoverTime) }}
            </view>
            <view class="time-tip text-muted" v-else>
              尚未交班提交
            </view>
          </view>

          <!-- 中间指示图标 -->
          <view class="exchange-indicator">
            <text class="arrow-icon">→</text>
          </view>

          <!-- 接班方 -->
          <view class="nurse-col">
            <view class="col-title">接班护士</view>
            <view class="nurse-name-row" v-if="item.successorNurseName">
              <text class="name">{{ item.successorNurseName }}</text>
            </view>
            <view class="nurse-name-row" v-else>
              <text class="name text-muted">待指定</text>
            </view>

            <view class="time-tip success" v-if="item.successorConfirmTime">
              已确认: {{ formatTime(item.successorConfirmTime) }}
            </view>
            <view class="time-tip warning" v-else-if="item.status === 'SUBMITTED'">
              ⚠️ 待接班确认
            </view>
            <view class="time-tip text-muted" v-else>
              未触发交班
            </view>
          </view>
        </view>

        <!-- 交接备忘或特别说明 -->
        <view class="notes-box" v-if="item.handoverNotes || item.specialCases">
          <text class="notes-label">交接备忘:</text>
          <text class="notes-content">{{ item.handoverNotes || item.specialCases }}</text>
        </view>

        <!-- 护士长核签栏 -->
        <view class="sign-meta-row">
          <view class="sign-status">
            <text class="sign-icon">{{ item.headNurseSigned ? '🛡️' : '⏳' }}</text>
            <text :class="item.headNurseSigned ? 'signed-text' : 'unsign-text'">
              护士长核签: {{ item.headNurseSigned ? `已核签 (${formatTime(item.headNurseSignedTime)})` : '未核签' }}
            </text>
          </view>
        </view>

        <!-- 卡片底部操作按钮 -->
        <view class="card-footer-actions">
          <button class="action-btn outline" @tap="openHandoverDetail(item)">
            调取交接单
          </button>
          
          <button
            class="action-btn confirm"
            v-if="item.status === 'SUBMITTED' && !item.successorConfirmTime"
            @tap="handleQuickConfirm(item)"
          >
            确认接班
          </button>
        </view>
      </view>

      <!-- 5. 空状态 -->
      <view class="empty-state" v-if="!loading && filteredList.length === 0">
        <text class="empty-icon">📂</text>
        <text class="empty-title">暂无符合条件的特殊交接记录</text>
        <text class="empty-desc">当前病区或筛选条件下无历史记录，您可立即填写今日交接簿</text>
        <button class="empty-btn" type="primary" @tap="goToTodayHandover">新建今日交接记录</button>
      </view>

      <view class="loading-state" v-if="loading">
        <text>正在加载交接班清册...</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { getHandoverHistoryApi, confirmSpecialHandoverApi } from '../../api/handover'
import { getWardsApi } from '../../api/ward'
import { useUserStore } from '../../stores/user'

const userStore = useUserStore()

const currentWardId = ref(36)
const currentWardIndex = ref(0)
const wardList = ref([])
const rawList = ref([])
const loading = ref(false)

// 视角切换：ALL, MY_HANDOVER, MY_SUCCESSOR
const relationType = ref('ALL')
// 状态过滤：'', SUBMITTED_PENDING, CONFIRMED, LOCKED, DRAFT
const statusFilter = ref('')

const currentNurseName = computed(() => {
  return userStore.userInfo?.realName || '当班护士'
})

const currentWardName = computed(() => {
  if (wardList.value.length > 0 && currentWardIndex.value >= 0 && currentWardIndex.value < wardList.value.length) {
    return wardList.value[currentWardIndex.value].wardName
  }
  return userStore.userInfo?.wardName || '7#19B消化内科三病区'
})

// 数量统计
const counts = computed(() => {
  let all = rawList.value.length
  let myHandover = 0
  let myPendingSuccessor = 0

  rawList.value.forEach(item => {
    if (item.handoverNurseName === currentNurseName.value || item.lastEditorName === currentNurseName.value) {
      myHandover++
    }
    if (item.successorNurseName === currentNurseName.value && item.status === 'SUBMITTED' && !item.successorConfirmTime) {
      myPendingSuccessor++
    }
  })

  return { all, myHandover, myPendingSuccessor }
})

// 列表过滤逻辑（与PC端保持完全一致）
const filteredList = computed(() => {
  return rawList.value.filter(item => {
    // 1. 关系视角过滤
    if (relationType.value === 'MY_HANDOVER') {
      const isMyHandover = item.handoverNurseName === currentNurseName.value || item.lastEditorName === currentNurseName.value
      if (!isMyHandover) return false
    } else if (relationType.value === 'MY_SUCCESSOR') {
      const isMySuccessor = item.successorNurseName === currentNurseName.value
      if (!isMySuccessor) return false
    }

    // 2. 状态过滤
    if (statusFilter.value === 'LOCKED' && item.status !== 'LOCKED') return false
    if (statusFilter.value === 'CONFIRMED' && !item.successorConfirmTime) return false
    if (statusFilter.value === 'SUBMITTED_PENDING' && (item.status !== 'SUBMITTED' || item.successorConfirmTime)) return false
    if (statusFilter.value === 'DRAFT' && item.status !== 'DRAFT') return false

    return true
  })
})

onShow(() => {
  if (userStore.userInfo?.wardId) {
    currentWardId.value = userStore.userInfo.wardId
  }
  fetchWards()
  fetchHistory()
})

onPullDownRefresh(async () => {
  await fetchHistory()
  uni.stopPullDownRefresh()
})

const fetchWards = async () => {
  try {
    const res = await getWardsApi({ status: 1 })
    wardList.value = res || []
    if (wardList.value.length > 0) {
      const idx = wardList.value.findIndex(w => w.id === currentWardId.value)
      if (idx !== -1) {
        currentWardIndex.value = idx
      } else {
        currentWardIndex.value = 0
        currentWardId.value = wardList.value[0].id
      }
    }
  } catch (e) {}
}

const onWardChange = (e) => {
  const idx = Number(e.detail.value)
  currentWardIndex.value = idx
  if (wardList.value[idx]) {
    currentWardId.value = wardList.value[idx].id
    fetchHistory()
  }
}

const fetchHistory = async () => {
  loading.value = true
  try {
    const res = await getHandoverHistoryApi(currentWardId.value)
    rawList.value = res || []
  } catch (e) {
  } finally {
    loading.value = false
  }
}

const changeRelation = (type) => {
  relationType.value = type
}

const changeStatus = (status) => {
  statusFilter.value = status
}

const getWardName = (wardId) => {
  const w = wardList.value.find(item => item.id === wardId)
  return w ? w.wardName : currentWardName.value
}

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  return timeStr.replace('T', ' ').substring(0, 16)
}

const getStatusClass = (item) => {
  if (item.status === 'LOCKED') return 'locked'
  if (item.successorConfirmTime) return 'confirmed'
  if (item.status === 'SUBMITTED') return 'submitted'
  return 'draft'
}

const getStatusText = (item) => {
  if (item.status === 'LOCKED') return '🔒 护士长已归档'
  if (item.successorConfirmTime) return '✓ 已接班确认'
  if (item.status === 'SUBMITTED') return '⏳ 待接班确认'
  return '✎ 草稿中'
}

// 调取交接单
const openHandoverDetail = (item) => {
  uni.navigateTo({
    url: `/pages/handover/special-record?wardId=${item.wardId}&date=${item.handoverDate}`
  })
}

// 今日填报
const goToTodayHandover = () => {
  uni.navigateTo({
    url: `/pages/handover/special-record?wardId=${currentWardId.value}`
  })
}

// 一键接班确认
const handleQuickConfirm = (item) => {
  uni.showModal({
    title: '确认接班',
    content: `确认接班【${item.handoverDate}】的特殊交接班登记簿？\n交班人: ${item.handoverNurseName || '当班护士'}`,
    confirmText: '确认接班',
    success: async (res) => {
      if (res.confirm) {
        try {
          await confirmSpecialHandoverApi(item.id)
          uni.showToast({ title: '已确认接班', icon: 'success' })
          fetchHistory()
        } catch (e) {}
      }
    }
  })
}
</script>

<style scoped>
.history-container {
  min-height: 100vh;
  background-color: #f4f6fa;
  padding: 20rpx;
  box-sizing: border-box;
}

/* 顶部病区卡片 */
.top-header-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.ward-selector-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.ward-pill {
  display: flex;
  align-items: center;
  background: #f0f5ff;
  border: 1px solid #d6e4ff;
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
}

.ward-icon {
  margin-right: 8rpx;
  font-size: 28rpx;
}

.ward-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #1677ff;
}

.arrow {
  margin-left: 10rpx;
  font-size: 20rpx;
  color: #1677ff;
}

.today-btn {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #1677ff, #4096ff);
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 500;
  padding: 12rpx 24rpx;
  border-radius: 30rpx;
  box-shadow: 0 4rpx 12rpx rgba(22, 119, 255, 0.3);
}

.plus-icon {
  font-size: 32rpx;
  margin-right: 6rpx;
  line-height: 1;
}

.role-perspective-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1rpx solid #f0f0f0;
  padding-top: 16rpx;
}

.nurse-badge {
  font-size: 22rpx;
  background: #e6f4ff;
  color: #1677ff;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-weight: 500;
}

.nurse-badge.head-nurse {
  background: #fff1f0;
  color: #ff4d4f;
}

.current-user-text {
  font-size: 24rpx;
  color: #8c8c8c;
}

/* 关系 Tab 栏 */
.relation-tabs {
  display: flex;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 8rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.03);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 12rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.2s;
}

.tab-item.active {
  background: #1677ff;
}

.tab-text {
  font-size: 28rpx;
  color: #595959;
  font-weight: 500;
}

.tab-item.active .tab-text {
  color: #ffffff;
  font-weight: bold;
}

.badge-count {
  font-size: 20rpx;
  background: #f0f0f0;
  color: #595959;
  padding: 2rpx 10rpx;
  border-radius: 20rpx;
  margin-left: 8rpx;
}

.tab-item.active .badge-count {
  background: rgba(255, 255, 255, 0.3);
  color: #ffffff;
}

.badge-count.warning {
  background: #ff4d4f;
  color: #ffffff;
}

/* 状态滚动标签 */
.status-scroll {
  white-space: nowrap;
  margin-bottom: 20rpx;
}

.status-wrap {
  display: inline-flex;
  gap: 14rpx;
  padding: 4rpx 0;
}

.status-pill {
  display: inline-block;
  padding: 10rpx 22rpx;
  background: #ffffff;
  border: 1px solid #d9d9d9;
  border-radius: 30rpx;
  font-size: 24rpx;
  color: #595959;
}

.status-pill.active {
  background: #1677ff;
  border-color: #1677ff;
  color: #ffffff;
  font-weight: 500;
}

.status-pill.warning.active {
  background: #faad14;
  border-color: #faad14;
}

.status-pill.success.active {
  background: #52c41a;
  border-color: #52c41a;
}

.status-pill.danger.active {
  background: #ff4d4f;
  border-color: #ff4d4f;
}

/* 记录卡片 */
.record-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1rpx solid #f0f0f0;
  padding-bottom: 16rpx;
}

.date-box {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.calendar-icon {
  font-size: 30rpx;
}

.date-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #262626;
}

.ward-tag {
  font-size: 22rpx;
  color: #8c8c8c;
  background: #f5f5f5;
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
  margin-left: 8rpx;
}

.status-tag {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.status-tag.locked {
  background: #fff1f0;
  color: #cf1322;
}

.status-tag.confirmed {
  background: #f6ffed;
  color: #389e0d;
}

.status-tag.submitted {
  background: #fffbe6;
  color: #d48806;
}

.status-tag.draft {
  background: #f5f5f5;
  color: #8c8c8c;
}

/* 交接双方对比卡片 */
.nurses-compare-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fafafa;
  border-radius: 14rpx;
  padding: 20rpx;
  margin: 18rpx 0;
}

.nurse-col {
  flex: 1;
}

.col-title {
  font-size: 22rpx;
  color: #8c8c8c;
  margin-bottom: 6rpx;
}

.nurse-name-row .name {
  font-size: 28rpx;
  font-weight: bold;
  color: #262626;
}

.exchange-indicator {
  padding: 0 16rpx;
  color: #bfbfbf;
  font-size: 32rpx;
}

.time-tip {
  font-size: 20rpx;
  color: #8c8c8c;
  margin-top: 6rpx;
}

.time-tip.success {
  color: #52c41a;
  font-weight: 500;
}

.time-tip.warning {
  color: #faad14;
  font-weight: bold;
}

/* 备忘录 */
.notes-box {
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 10rpx;
  padding: 14rpx 18rpx;
  margin-bottom: 16rpx;
}

.notes-label {
  font-size: 22rpx;
  font-weight: bold;
  color: #d46b08;
  margin-right: 8rpx;
}

.notes-content {
  font-size: 24rpx;
  color: #595959;
  line-height: 1.4;
}

/* 审核行 */
.sign-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0 16rpx;
}

.sign-status {
  display: flex;
  align-items: center;
  font-size: 22rpx;
}

.sign-icon {
  margin-right: 8rpx;
}

.signed-text {
  color: #52c41a;
}

.unsign-text {
  color: #bfbfbf;
}

/* 操作按钮 */
.card-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  border-top: 1rpx solid #f0f0f0;
  padding-top: 16rpx;
}

.action-btn {
  font-size: 26rpx;
  padding: 10rpx 28rpx;
  border-radius: 30rpx;
  line-height: 1.5;
  margin: 0;
}

.action-btn.outline {
  background: #ffffff;
  border: 1px solid #1677ff;
  color: #1677ff;
}

.action-btn.confirm {
  background: #faad14;
  color: #ffffff;
  border: none;
  font-weight: bold;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 80rpx 40rpx;
}

.empty-icon {
  font-size: 80rpx;
  display: block;
  margin-bottom: 20rpx;
}

.empty-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #262626;
  display: block;
  margin-bottom: 10rpx;
}

.empty-desc {
  font-size: 24rpx;
  color: #8c8c8c;
  display: block;
  margin-bottom: 30rpx;
}

.empty-btn {
  display: inline-block;
  padding: 12rpx 36rpx;
  font-size: 28rpx;
  border-radius: 40rpx;
}

.loading-state {
  text-align: center;
  padding: 40rpx;
  color: #8c8c8c;
  font-size: 26rpx;
}
</style>
