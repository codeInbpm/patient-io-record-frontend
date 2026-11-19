<template>
  <view class="container">
    <!-- 顶部目标护士信息卡片 -->
    <view class="nurse-target-card">
      <view class="nt-avatar">👩‍⚕️</view>
      <view class="nt-info">
        <view class="nt-name-row">
          <text class="nt-name">{{ nurseName }}</text>
          <text class="nt-job">工号: {{ jobNumber }}</text>
        </view>
        <view class="nt-tip">请选择要为其分配负责的病房与具体床位</view>
      </view>
    </view>

    <!-- 病房选择器 -->
    <view class="ward-select-card">
      <text class="card-label">选择分配病房/病区：</text>
      <picker :range="wardList" range-key="wardName" @change="onWardChange">
        <view class="ward-picker-box">
          <text class="w-name">{{ currentWard?.wardName || '点击选择病房' }}</text>
          <text class="arrow">▼ 切换病房</text>
        </view>
      </picker>
    </view>

    <!-- 快捷操作栏 -->
    <view class="quick-bar">
      <text class="qb-title">床位列表（点击卡片勾选）</text>
      <view class="qb-btns">
        <text class="qb-btn" @tap="selectAllBeds">全选本区</text>
        <text class="qb-btn" @tap="clearAllBeds">清空勾选</text>
      </view>
    </view>

    <!-- 床位网格选择区域 -->
    <view class="bed-grid" v-if="bedList.length > 0">
      <view 
        v-for="bed in bedList" 
        :key="bed.bedId"
        :class="['bed-card', selectedBedIds.includes(bed.bedId) ? 'selected' : '', (bed.currentNurseId && bed.currentNurseId != nurseId) ? 'other-nurse' : '']"
        @tap="toggleBed(bed)"
      >
        <view class="bc-top">
          <text class="bc-no">{{ bed.bedNo }}</text>
          <view class="bc-check-icon">
            {{ selectedBedIds.includes(bed.bedId) ? '✓' : '' }}
          </view>
        </view>
        
        <view class="bc-patient">
          <text class="p-icon">🛏️</text>
          <text class="p-name">{{ bed.patientName }}</text>
        </view>

        <view class="bc-footer">
          <text v-if="selectedBedIds.includes(bed.bedId)" class="tag mine">由她负责</text>
          <text v-else-if="bed.currentNurseName" class="tag other">{{ bed.currentNurseName }}在管</text>
          <text v-else class="tag none">暂无责任护士</text>
        </view>
      </view>
    </view>

    <view class="empty-state" v-else>
      <text class="empty-icon">📭</text>
      <text class="empty-text">该病房暂无床位，请先在工作台添加床位</text>
    </view>

    <!-- 底部保存悬浮条 -->
    <view class="footer-bar">
      <view class="fb-left">
        <text class="fb-summary">已勾选负责：<text class="hl-num">{{ selectedBedIds.length }}</text> 张床位</text>
      </view>
      <button class="save-btn" type="primary" :loading="saving" @tap="handleSaveAssignment">
        保存分配
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getWardsApi } from '../../api/ward'
import { getNurseAssignmentsApi, assignNurseBedsApi } from '../../api/nurse'

const nurseId = ref(null)
const nurseName = ref('')
const jobNumber = ref('')

const wardList = ref([])
const currentWard = ref(null)
const bedList = ref([])
const selectedBedIds = ref([])
const saving = ref(false)

onLoad(async (options) => {
  nurseId.value = options.nurseId ? Number(options.nurseId) : null
  nurseName.value = options.nurseName ? decodeURIComponent(options.nurseName) : ''
  jobNumber.value = options.jobNumber || ''

  await loadWards()
})

async function loadWards() {
  try {
    const list = await getWardsApi()
    wardList.value = list || []
    if (wardList.value.length > 0) {
      let targetWard = null
      if (userStore.userInfo?.wardId) {
        targetWard = wardList.value.find(w => w.id === Number(userStore.userInfo.wardId))
      }
      currentWard.value = targetWard || wardList.value[0]
      await loadAssignments(currentWard.value.id)
    }
  } catch (e) {
    console.error(e)
  }
}

async function loadAssignments(wardId) {
  if (!nurseId.value || !wardId) return
  try {
    const res = await getNurseAssignmentsApi(nurseId.value, wardId)
    bedList.value = res?.beds || []
    // 找出分配给当前护士的床位ID
    selectedBedIds.value = bedList.value
      .filter(b => b.isAssignedToThisNurse)
      .map(b => b.bedId)
  } catch (e) {
    console.error(e)
  }
}

function onWardChange(e) {
  const idx = e.detail.value
  const ward = wardList.value[idx]
  if (ward) {
    currentWard.value = ward
    loadAssignments(ward.id)
  }
}

function toggleBed(bed) {
  const id = bed.bedId
  const idx = selectedBedIds.value.indexOf(id)
  if (idx > -1) {
    selectedBedIds.value.splice(idx, 1)
  } else {
    selectedBedIds.value.push(id)
  }
}

function selectAllBeds() {
  selectedBedIds.value = bedList.value.map(b => b.bedId)
}

function clearAllBeds() {
  selectedBedIds.value = []
}

async function handleSaveAssignment() {
  if (!nurseId.value || !currentWard.value) return

  saving.value = true
  try {
    await assignNurseBedsApi({
      nurseId: nurseId.value,
      wardId: currentWard.value.id,
      bedIds: selectedBedIds.value
    })
    uni.showToast({ title: '责任床位分配成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1000)
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}
</script>

<style>
.container {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 24rpx;
  padding-bottom: 140rpx;
  box-sizing: border-box;
}

.nurse-target-card {
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  border-radius: 20rpx;
  padding: 28rpx 32rpx;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 20rpx rgba(22, 119, 255, 0.22);
}

.nt-avatar {
  font-size: 64rpx;
}

.nt-name-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 8rpx;
}

.nt-name {
  font-size: 34rpx;
  font-weight: bold;
}

.nt-job {
  font-size: 24rpx;
  background-color: rgba(255, 255, 255, 0.2);
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
}

.nt-tip {
  font-size: 22rpx;
  opacity: 0.85;
}

.ward-select-card {
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
}

.card-label {
  font-size: 26rpx;
  color: #8c8c8c;
  display: block;
  margin-bottom: 12rpx;
}

.ward-picker-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #f9f9f9;
  border: 2rpx solid #e8e8e8;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
}

.w-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #1677ff;
}

.arrow {
  font-size: 24rpx;
  color: #8c8c8c;
}

.quick-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.qb-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #262626;
}

.qb-btns {
  display: flex;
  gap: 20rpx;
}

.qb-btn {
  font-size: 24rpx;
  color: #1677ff;
}

.bed-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.bed-card {
  background-color: #ffffff;
  border: 3rpx solid #e8e8e8;
  border-radius: 16rpx;
  padding: 20rpx;
  position: relative;
  transition: all 0.2s;
}

.bed-card.selected {
  border-color: #1677ff;
  background-color: #f0f7ff;
  box-shadow: 0 4rpx 14rpx rgba(22, 119, 255, 0.15);
}

.bed-card.other-nurse {
  border-left: 8rpx solid #fa8c16;
}

.bc-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.bc-no {
  font-size: 30rpx;
  font-weight: bold;
  color: #1a1a1a;
}

.bc-check-icon {
  width: 36rpx;
  height: 36rpx;
  border-radius: 18rpx;
  border: 2rpx solid #d9d9d9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  color: #ffffff;
}

.bed-card.selected .bc-check-icon {
  background-color: #1677ff;
  border-color: #1677ff;
}

.bc-patient {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 16rpx;
}

.p-icon {
  font-size: 24rpx;
}

.p-name {
  font-size: 26rpx;
  color: #595959;
}

.bc-footer {
  display: flex;
}

.tag {
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
}

.tag.mine {
  background-color: #e6f4ff;
  color: #1677ff;
}

.tag.other {
  background-color: #fff7e6;
  color: #fa8c16;
}

.tag.none {
  background-color: #f5f5f5;
  color: #bfbfbf;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.empty-text {
  font-size: 26rpx;
  color: #bfbfbf;
}

.footer-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 110rpx;
  background-color: #ffffff;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 32rpx;
  z-index: 99;
}

.fb-summary {
  font-size: 28rpx;
  color: #595959;
}

.hl-num {
  font-size: 36rpx;
  font-weight: bold;
  color: #1677ff;
}

.save-btn {
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  padding: 0 48rpx;
  font-size: 28rpx;
  font-weight: bold;
  margin: 0 !important;
}
</style>
