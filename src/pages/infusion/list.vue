<template>
  <view class="infusion-list-container">
    <!-- 顶部状态摘要卡片与快捷操作栏 -->
    <view class="summary-card">
      <view class="summary-item">
        <text class="num highlight">{{ activeList.length }}</text>
        <text class="label">正在补液</text>
      </view>
      <view class="summary-item">
        <text class="num timeout">{{ timeoutCount }}</text>
        <text class="label">超时未拔针</text>
      </view>
      <view class="summary-item">
        <text class="num">{{ todayCompletedList.length }}</text>
        <text class="label">今日已结束</text>
      </view>
    </view>

    <!-- 顶部操作条：直接在当前页登记补液 -->
    <view class="top-action-bar">
      <view class="ward-title">
        <text class="ward-tag">病区</text>
        <text class="ward-name">{{ userStore.userInfo?.wardName || '7#19B消化内科三病区' }}</text>
      </view>
      <button class="quick-add-btn" @tap="openAddModal">
        <text class="btn-icon">＋</text> 登记补液
      </button>
    </view>

    <!-- 列表分段切换 -->
    <view class="tab-segment">
      <view
        :class="['tab-item', currentTab === 'active' ? 'active' : '']"
        @tap="currentTab = 'active'"
      >
        正在补液 ({{ activeList.length }})
      </view>
      <view
        :class="['tab-item', currentTab === 'history' ? 'active' : '']"
        @tap="currentTab = 'history'"
      >
        已结束记录 ({{ todayCompletedList.length }})
      </view>
    </view>

    <!-- 1. 正在滴注列表 -->
    <view class="infusion-cards" v-if="currentTab === 'active'">
      <view
        v-for="item in activeList"
        :key="item.id"
        :class="['card', item.isTimeout ? 'is-timeout' : (item.remainingMinutes <= 15 ? 'is-warn' : '')]"
      >
        <view class="card-head">
          <view class="bed-patient">
            <text class="bed-badge">{{ item.bedNo }}</text>
            <text class="patient-name">{{ item.patientName }}</text>
          </view>
          <view class="status-pill" :class="item.isTimeout ? 'pill-timeout' : (item.remainingMinutes <= 15 ? 'pill-warn' : 'pill-normal')">
            {{ item.isTimeout ? `超时 ${Math.abs(item.remainingMinutes)}分` : `剩 ${item.remainingMinutes}分钟` }}
          </view>
        </view>

        <view class="card-content">
          <!-- 补液药物与用法 -->
          <view class="meta-row highlight-row">
            <text class="meta-label">补液药物:</text>
            <text class="meta-val medicine-title">{{ item.remark || '静脉滴注' }}</text>
            <text class="usage-tag">{{ item.usageType }}</text>
          </view>

          <view class="meta-row">
            <text class="meta-label">计划容量:</text>
            <text class="meta-val font-bold">{{ item.capacity }} ml</text>
            <text class="nurse-label">经办: {{ item.nurseName }}</text>
          </view>

          <view class="meta-row">
            <text class="meta-label">补液时间:</text>
            <text class="meta-val">
              {{ item.startTime?.substring(11, 16) }} 开始 ~ 预计 {{ item.estimatedEndTime?.substring(11, 16) }} 拔针
            </text>
          </view>

          <!-- 进度条 -->
          <view class="progress-box">
            <progress
              :percent="item.progressPercent"
              :color="item.isTimeout ? '#ff4d4f' : (item.remainingMinutes <= 15 ? '#faad14' : '#1677ff')"
              stroke-width="6"
              border-radius="4"
            />
          </view>

          <!-- 凭据照片预览 -->
          <view class="thumb-previews" v-if="item.imageUrls && item.imageUrls.length > 0">
            <block v-for="(img, idx) in item.imageUrls" :key="idx">
              <image
                v-if="typeof img === 'string' && img.startsWith('http')"
                :src="img"
                mode="aspectFill"
                class="thumb-img"
                @tap="previewImg(img, item.imageUrls)"
              />
            </block>
          </view>
        </view>

        <view class="card-actions">
          <button class="end-btn" size="mini" @tap="openEndModal(item)">
            拔针确认
          </button>
        </view>
      </view>

      <!-- 空状态：提供直接登记按钮 -->
      <view class="empty-box" v-if="activeList.length === 0">
        <text class="empty-icon">💧</text>
        <text class="empty-title">当前病区暂无正在补液的患者</text>
        <button class="empty-add-btn" @tap="openAddModal">
          ＋ 立即登记患者补液
        </button>
      </view>
    </view>

    <!-- 2. 已结束记录列表 -->
    <view class="infusion-cards" v-else>
      <view class="card completed-card" v-for="item in todayCompletedList" :key="item.id">
        <view class="card-head">
          <view class="bed-patient">
            <text class="bed-badge gray">{{ item.bedNo }}</text>
            <text class="patient-name">{{ item.patientName }}</text>
          </view>
          <text class="status-done">已结束</text>
        </view>
        <view class="card-content">
          <!-- 补的什么液（突出展示） -->
          <view class="meta-row highlight-row">
            <text class="meta-label">补液药物:</text>
            <text class="meta-val medicine-title">{{ item.remark || (item.usageType + ' 静滴补液') }}</text>
            <text class="usage-tag">{{ item.usageType }}</text>
          </view>

          <view class="meta-row">
            <text class="meta-label">滴入容量:</text>
            <text class="meta-val font-bold text-success">{{ item.actualIntakeAmount || item.capacity }} ml</text>
            <text class="sub-plan">(原计划 {{ item.capacity }}ml)</text>
          </view>

          <!-- 补液时间与滴注耗时 -->
          <view class="meta-row">
            <text class="meta-label">补液时间:</text>
            <text class="meta-val time-range">
              {{ item.startTime?.substring(11, 16) || '—' }} 开始 ~ {{ item.actualEndTime?.substring(11, 16) || item.estimatedEndTime?.substring(11, 16) || '—' }} 拔针
            </text>
          </view>

          <view class="meta-row nurse-row">
            <text class="nurse-label">经办护士: {{ item.nurseName || '当班护士' }}</text>
            <text class="nurse-label">拔针护士: {{ item.endNurseName || '当班护士' }}</text>
          </view>

          <!-- 照片凭据 -->
          <view class="thumb-previews" v-if="item.imageUrls && item.imageUrls.length > 0">
            <block v-for="(img, idx) in item.imageUrls" :key="idx">
              <image
                v-if="typeof img === 'string' && img.startsWith('http')"
                :src="img"
                mode="aspectFill"
                class="thumb-img"
                @tap="previewImg(img, item.imageUrls)"
              />
            </block>
          </view>
        </view>
      </view>

      <view class="empty-box" v-if="todayCompletedList.length === 0">
        <text class="empty-title">今日暂无已结束的补液记录</text>
      </view>
    </view>

    <!-- 右下角悬浮快捷按钮 -->
    <view class="fab-btn" @tap="openAddModal">
      <text class="fab-icon">＋</text>
      <text class="fab-text">记补液</text>
    </view>

    <!-- 弹窗一：拔针确认弹窗 -->
    <view class="modal-mask" v-if="showEndModal" @tap="showEndModal = false">
      <view class="modal-box" @tap.stop>
        <view class="modal-title">拔针 / 补液结束确认</view>
        <view class="modal-patient-info">
          {{ currentEndingItem?.bedNo }} - {{ currentEndingItem?.patientName }} (原计划 {{ currentEndingItem?.capacity }}ml)
        </view>

        <view class="modal-form-item">
          <text class="modal-label">实际滴入容量 (ml):</text>
          <input
            type="number"
            class="modal-input"
            v-model="endAmount"
            placeholder="默认原计划容量"
          />
        </view>

        <view class="modal-form-item">
          <text class="modal-label">拔针情况:</text>
          <radio-group class="modal-radio-group" @change="(e) => endStatus = e.detail.value">
            <label class="radio-label"><radio value="COMPLETED" :checked="endStatus === 'COMPLETED'" color="#1677ff" /> 正常滴毕</label>
            <label class="radio-label"><radio value="STOPPED" :checked="endStatus === 'STOPPED'" color="#1677ff" /> 提前拔针/中断</label>
          </radio-group>
        </view>

        <view class="modal-form-item">
          <text class="modal-label">拔针备注 (选填):</text>
          <input class="modal-input" v-model="endRemark" placeholder="如穿刺部位正常、回血等" />
        </view>

        <view class="modal-btns">
          <button class="m-btn cancel" @tap="showEndModal = false">取消</button>
          <button class="m-btn confirm" :loading="ending" @tap="submitEnd">确认拔针</button>
        </view>
      </view>
    </view>

    <!-- 弹窗二：直接在本页添加补液记录（完全免跳转） -->
    <view class="modal-mask" v-if="showAddModal" @tap="showAddModal = false">
      <view class="modal-box add-modal-box" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">登记患者补液</text>
          <text class="modal-close" @tap="showAddModal = false">✕</text>
        </view>

        <scroll-view scroll-y class="add-form-scroll">
          <!-- 1. 选择在床病患 -->
          <view class="modal-form-item">
            <text class="modal-label required">第一步：选择在床患者 *</text>
            <view class="bed-select-scroll">
              <view
                v-for="p in inBedPatients"
                :key="p.id"
                :class="['bed-select-chip', addForm.patientId === p.id ? 'active' : '']"
                @tap="selectPatient(p)"
              >
                <text class="b-no">{{ p.bedNo }}</text>
                <text class="b-name">{{ p.patientName }}</text>
              </view>
            </view>
          </view>

          <!-- 2. 补液药物名称 -->
          <view class="modal-form-item">
            <text class="modal-label required">补液药物名称 / 规格 *</text>
            <input
              class="modal-input"
              v-model="addForm.remark"
              placeholder="如: 0.9%氯化钠250ml + 注射用头孢2.0g"
            />
          </view>

          <!-- 3. 补液容量 -->
          <view class="modal-form-item">
            <text class="modal-label required">补液容量 (ml) *</text>
            <view class="chip-group">
              <view
                v-for="cap in [100, 250, 500, 1000]"
                :key="cap"
                :class="['val-chip', addForm.capacity === cap ? 'active' : '']"
                @tap="selectAddCapacity(cap)"
              >
                {{ cap }}ml
              </view>
              <view
                :class="['val-chip', isCustomCap ? 'active' : '']"
                @tap="isCustomCap = true"
              >
                自定义
              </view>
            </view>
            <input
              v-if="isCustomCap"
              type="number"
              class="modal-input mt-10"
              v-model="addForm.capacity"
              placeholder="输入毫升数"
              @input="calcAddEndTime"
            />
          </view>

          <!-- 4. 给药用法 -->
          <view class="modal-form-item">
            <text class="modal-label required">给药途径 / 用法 *</text>
            <view class="chip-group">
              <view
                v-for="u in ['ivg', 'ibn', 'iv drip', '维持液']"
                :key="u"
                :class="['val-chip', addForm.usageType === u ? 'active' : '']"
                @tap="addForm.usageType = u"
              >
                {{ u }}
              </view>
            </view>
          </view>

          <!-- 5. 开始时间与预计拔针时间 -->
          <view class="modal-form-item">
            <view class="time-select-row">
              <view class="time-col">
                <text class="modal-label">开始时间:</text>
                <picker mode="time" :value="addStartTimeStr" @change="onAddStartTimeChange">
                  <view class="time-picker-val">{{ addStartTimeStr }} ▾</view>
                </picker>
              </view>
              <view class="time-col">
                <text class="modal-label">预计拔针:</text>
                <picker mode="time" :value="addEndTimeStr" @change="onAddEndTimeChange">
                  <view class="time-picker-val highlight">{{ addEndTimeStr }} ▾</view>
                </picker>
              </view>
            </view>
          </view>

          <!-- 6. 自动记入出入量 -->
          <view class="checkbox-row" @tap="addForm.syncToIntake = !addForm.syncToIntake">
            <checkbox :checked="addForm.syncToIntake" color="#1677ff" />
            <text class="checkbox-tip">自动记入今日入量 (静脉补液: {{ addForm.capacity || 0 }}ml)</text>
          </view>

          <!-- 7. 药袋照片拍照/上传 MinIO -->
          <view class="modal-form-item">
            <text class="modal-label">药袋 / 穿刺凭据照片 (存至MinIO专属桶):</text>
            <view class="image-uploader-row">
              <view class="img-preview-box" v-for="(img, idx) in addImages" :key="idx">
                <image :src="typeof img === 'string' ? img : (img.fileUrl || '')" mode="aspectFill" class="uploaded-img" @tap="previewImg(typeof img === 'string' ? img : (img.fileUrl || ''), addImages)" />
                <view class="del-btn" @tap.stop="addImages.splice(idx, 1)">×</view>
              </view>
              <view class="upload-btn" v-if="addImages.length < 3" @tap="chooseAndUploadImage">
                <text class="cam-icon">📷</text>
                <text class="cam-text">拍照/传图</text>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="modal-btns">
          <button class="m-btn cancel" @tap="showAddModal = false">取消</button>
          <button class="m-btn confirm-add" :loading="addSubmitting" @tap="submitAddInfusion">
            确认登记并开始监护
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { getActiveInfusionsApi, getCompletedInfusionsApi, endInfusionApi, createInfusionApi, uploadInfusionImageApi } from '../../api/infusion'
import { getPatientsApi } from '../../api/patient'
import { useUserStore } from '../../stores/user'

const userStore = useUserStore()
const currentTab = ref('active')
const activeList = ref([])
const todayCompletedList = ref([])

// 拔针确认弹窗状态
const showEndModal = ref(false)
const ending = ref(false)
const currentEndingItem = ref(null)
const endAmount = ref(0)
const endStatus = ref('COMPLETED')
const endRemark = ref('')

// 直接添加补液弹窗状态
const showAddModal = ref(false)
const addSubmitting = ref(false)
const inBedPatients = ref([])
const isCustomCap = ref(false)
const addStartTimeStr = ref('')
const addEndTimeStr = ref('')
const addImages = ref([])

const addForm = reactive({
  patientId: null,
  capacity: 250,
  usageType: 'ivg',
  startTime: '',
  estimatedEndTime: '',
  remark: '',
  syncToIntake: true
})

const pad = (n) => (n < 10 ? '0' + n : n)
const getTodayDateStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const timeoutCount = computed(() => {
  return activeList.value.filter(item => item.isTimeout).length
})

onShow(() => {
  loadData()
})

onPullDownRefresh(async () => {
  await loadData()
  uni.stopPullDownRefresh()
})

const loadData = async () => {
  try {
    const wardId = userStore.userInfo?.wardId || 36
    const [activeRes, completedRes, patientsRes] = await Promise.all([
      getActiveInfusionsApi(wardId),
      getCompletedInfusionsApi(wardId),
      getPatientsApi(wardId)
    ])
    activeList.value = activeRes || []
    todayCompletedList.value = completedRes || []
    inBedPatients.value = (patientsRes || []).filter(p => p.status === 1)
  } catch (e) {}
}

const previewImg = (img, list) => {
  uni.previewImage({
    current: img,
    urls: list
  })
}

// 拔针操作
const openEndModal = (item) => {
  currentEndingItem.value = item
  endAmount.value = item.capacity
  endStatus.value = 'COMPLETED'
  endRemark.value = ''
  showEndModal.value = true
}

const submitEnd = async () => {
  ending.value = true
  try {
    const now = new Date()
    const actualEndTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    await endInfusionApi({
      infusionId: currentEndingItem.value.id,
      actualEndTime,
      actualIntakeAmount: Number(endAmount.value),
      status: endStatus.value,
      remark: endRemark.value
    })

    uni.showToast({ title: '已成功拔针', icon: 'success' })
    showEndModal.value = false
    await loadData()
  } catch (e) {
  } finally {
    ending.value = false
  }
}

// 直接在本页打开添加补液弹窗
const openAddModal = () => {
  const now = new Date()
  addStartTimeStr.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  addForm.startTime = `${getTodayDateStr()} ${addStartTimeStr.value}:00`
  addForm.capacity = 250
  addForm.usageType = 'ivg'
  addForm.remark = ''
  addForm.syncToIntake = true
  isCustomCap.value = false
  addImages.value = []

  if (inBedPatients.value.length > 0) {
    addForm.patientId = inBedPatients.value[0].id
  }
  calcAddEndTime()
  showAddModal.value = true
}

const selectPatient = (p) => {
  addForm.patientId = p.id
}

const selectAddCapacity = (cap) => {
  isCustomCap.value = false
  addForm.capacity = cap
  calcAddEndTime()
}

const calcAddEndTime = () => {
  let minutes = 90
  if (addForm.capacity <= 100) minutes = 45
  else if (addForm.capacity <= 250) minutes = 90
  else if (addForm.capacity <= 500) minutes = 150
  else minutes = 240

  const now = new Date()
  const [h, m] = addStartTimeStr.value.split(':').map(Number)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
  const end = new Date(start.getTime() + minutes * 60 * 1000)

  addEndTimeStr.value = `${pad(end.getHours())}:${pad(end.getMinutes())}`
  addForm.estimatedEndTime = `${getTodayDateStr()} ${addEndTimeStr.value}:00`
}

const onAddStartTimeChange = (e) => {
  addStartTimeStr.value = e.detail.value
  addForm.startTime = `${getTodayDateStr()} ${addStartTimeStr.value}:00`
  calcAddEndTime()
}

const onAddEndTimeChange = (e) => {
  addEndTimeStr.value = e.detail.value
  addForm.estimatedEndTime = `${getTodayDateStr()} ${addEndTimeStr.value}:00`
}

// 拍照上传药袋图片
const chooseAndUploadImage = () => {
  uni.chooseImage({
    count: 3 - addImages.value.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      uni.showLoading({ title: '上传药袋中...' })
      try {
        for (const tempPath of res.tempFilePaths) {
          const url = await uploadInfusionImageApi(tempPath)
          const validUrl = (typeof url === 'string') ? url : (url?.fileUrl || '')
          if (validUrl) {
            addImages.value.push(validUrl)
          }
        }
      } catch (e) {
        uni.showToast({ title: '部分图片上传失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    }
  })
}

// 提交补液登记
const submitAddInfusion = async () => {
  if (!addForm.patientId) {
    uni.showToast({ title: '请选择在床病患', icon: 'none' })
    return
  }
  if (!addForm.remark.trim()) {
    uni.showToast({ title: '请填写补液药物名称', icon: 'none' })
    return
  }

  addSubmitting.value = true
  try {
    const payload = {
      patientId: addForm.patientId,
      capacity: Number(addForm.capacity),
      usageType: addForm.usageType,
      startTime: addForm.startTime,
      estimatedEndTime: addForm.estimatedEndTime,
      remark: addForm.remark.trim(),
      syncToIntake: addForm.syncToIntake,
      imageUrls: addImages.value
    }

    await createInfusionApi(payload)
    uni.showToast({ title: '登记成功，监护开启', icon: 'success' })
    showAddModal.value = false
    currentTab.value = 'active'
    await loadData()
  } catch (e) {
  } finally {
    addSubmitting.value = false
  }
}
</script>

<style scoped>
.infusion-list-container {
  padding: 24rpx;
  background-color: #f5f7fa;
  min-height: 100vh;
  box-sizing: border-box;
  padding-bottom: 120rpx;
}

.summary-card {
  display: flex;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx 0;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1rpx solid #f0f0f0;
}

.summary-item:last-child {
  border-right: none;
}

.summary-item .num {
  font-size: 40rpx;
  font-weight: bold;
  color: #262626;
}

.summary-item .num.highlight {
  color: #1677ff;
}

.summary-item .num.timeout {
  color: #ff4d4f;
}

.summary-item .label {
  font-size: 24rpx;
  color: #8c8c8c;
  margin-top: 6rpx;
}

/* 顶部操作条 */
.top-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  border-radius: 14rpx;
  padding: 18rpx 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.ward-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.ward-tag {
  background: #e6f4ff;
  color: #1677ff;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  font-weight: bold;
}

.ward-name {
  font-size: 26rpx;
  font-weight: bold;
  color: #303133;
}

.quick-add-btn {
  background: #1677ff;
  color: #ffffff;
  font-size: 26rpx;
  border-radius: 30rpx;
  padding: 0 24rpx;
  height: 56rpx;
  line-height: 56rpx;
  margin: 0;
  display: flex;
  align-items: center;
}

.btn-icon {
  font-size: 28rpx;
  margin-right: 6rpx;
}

.tab-segment {
  display: flex;
  background: #eef0f4;
  border-radius: 12rpx;
  padding: 6rpx;
  margin-bottom: 24rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 28rpx;
  color: #595959;
  border-radius: 8rpx;
}

.tab-item.active {
  background: #ffffff;
  color: #1677ff;
  font-weight: bold;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
  border-left: 8rpx solid #1677ff;
}

.card.is-warn {
  border-left-color: #faad14;
  background-color: #fffdf5;
}

.card.is-timeout {
  border-left-color: #ff4d4f;
  background-color: #fff5f5;
}

.card.completed-card {
  border-left-color: #52c41a;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.bed-badge {
  font-size: 32rpx;
  font-weight: bold;
  color: #1677ff;
  background: #e6f4ff;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  margin-right: 14rpx;
}

.bed-badge.gray {
  background: #f0f0f0;
  color: #595959;
}

.patient-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #262626;
}

.status-pill {
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  border-radius: 30rpx;
  font-weight: 500;
}

.pill-normal {
  background: #e6f4ff;
  color: #1677ff;
}

.pill-warn {
  background: #fff7e6;
  color: #d46b08;
}

.pill-timeout {
  background: #fff1f0;
  color: #cf1322;
  font-weight: bold;
}

.status-done {
  font-size: 24rpx;
  color: #52c41a;
  background: #f6ffed;
  padding: 6rpx 16rpx;
  border-radius: 30rpx;
}

.meta-row {
  display: flex;
  align-items: center;
  font-size: 26rpx;
  margin-bottom: 10rpx;
  color: #595959;
}

.meta-row.highlight-row {
  background: #fafcff;
  padding: 8rpx 12rpx;
  border-radius: 8rpx;
  border: 1rpx solid #eef3ff;
}

.meta-label {
  color: #8c8c8c;
  width: 140rpx;
}

.meta-val {
  color: #262626;
}

.medicine-title {
  color: #1677ff;
  font-weight: bold;
  flex: 1;
}

.meta-val.font-bold {
  font-weight: bold;
}

.text-success {
  color: #52c41a;
}

.sub-plan {
  color: #8c8c8c;
  font-size: 22rpx;
  margin-left: 8rpx;
}

.time-range {
  color: #262626;
  font-weight: 500;
}

.usage-tag {
  background: #f0f5ff;
  color: #2f54eb;
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
  margin-left: 12rpx;
  font-weight: 500;
}

.nurse-label {
  font-size: 24rpx;
  color: #8c8c8c;
}

.nurse-row {
  display: flex;
  justify-content: space-between;
  margin-top: 6rpx;
  border-top: 1rpx dashed #f0f0f0;
  padding-top: 8rpx;
}

.progress-box {
  margin: 16rpx 0;
}

.thumb-previews {
  display: flex;
  gap: 12rpx;
  margin-top: 14rpx;
}

.thumb-img {
  width: 90rpx;
  height: 90rpx;
  border-radius: 8rpx;
  border: 1rpx solid #e8e8e8;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx dashed #f0f0f0;
}

.end-btn {
  background: #ff4d4f;
  color: #ffffff;
  font-size: 26rpx;
  border-radius: 30rpx;
  padding: 0 28rpx;
  height: 60rpx;
  line-height: 60rpx;
}

.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.empty-icon {
  font-size: 72rpx;
}

.empty-title {
  font-size: 30rpx;
  color: #262626;
  margin-top: 16rpx;
  font-weight: 500;
}

.empty-add-btn {
  margin-top: 24rpx;
  background: #1677ff;
  color: #ffffff;
  font-size: 28rpx;
  border-radius: 36rpx;
  padding: 0 40rpx;
  height: 72rpx;
  line-height: 72rpx;
}

/* 悬浮加号按钮 (FAB) */
.fab-btn {
  position: fixed;
  right: 36rpx;
  bottom: 80rpx;
  width: 110rpx;
  height: 110rpx;
  border-radius: 55rpx;
  background: #1677ff;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 20rpx rgba(22, 119, 255, 0.4);
  z-index: 99;
}

.fab-icon {
  font-size: 36rpx;
  line-height: 36rpx;
  font-weight: bold;
}

.fab-text {
  font-size: 20rpx;
  margin-top: 4rpx;
}

/* 弹窗通用样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-box {
  background: #ffffff;
  width: 86%;
  border-radius: 20rpx;
  padding: 32rpx;
  box-sizing: border-box;
}

.add-modal-box {
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  padding-bottom: 12rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #303133;
}

.modal-close {
  font-size: 36rpx;
  color: #909399;
  padding: 8rpx;
}

.add-form-scroll {
  max-height: 60vh;
}

.modal-patient-info {
  background: #f0f5ff;
  color: #1677ff;
  font-size: 26rpx;
  text-align: center;
  padding: 12rpx;
  border-radius: 8rpx;
  margin-bottom: 24rpx;
}

.modal-form-item {
  margin-bottom: 24rpx;
}

.modal-label {
  font-size: 26rpx;
  color: #595959;
  margin-bottom: 12rpx;
  display: block;
}

.modal-label.required {
  font-weight: 500;
  color: #303133;
}

.modal-input {
  background: #f5f7fa;
  height: 76rpx;
  padding: 0 20rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.bed-select-scroll {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  max-height: 180rpx;
  overflow-y: auto;
}

.bed-select-chip {
  border: 1rpx solid #dcdfe6;
  border-radius: 10rpx;
  padding: 8rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 110rpx;
}

.bed-select-chip.active {
  border-color: #1677ff;
  background: #e6f4ff;
}

.bed-select-chip .b-no {
  font-size: 26rpx;
  font-weight: bold;
  color: #1677ff;
}

.bed-select-chip .b-name {
  font-size: 22rpx;
  color: #595959;
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.val-chip {
  background: #f5f5f5;
  color: #595959;
  font-size: 26rpx;
  padding: 10rpx 22rpx;
  border-radius: 8rpx;
}

.val-chip.active {
  background: #e6f4ff;
  color: #1677ff;
  font-weight: bold;
  border: 1rpx solid #1677ff;
}

.mt-10 {
  margin-top: 14rpx;
}

.time-select-row {
  display: flex;
  gap: 20rpx;
}

.time-col {
  flex: 1;
}

.time-picker-val {
  background: #f5f7fa;
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 16rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
  color: #303133;
}

.time-picker-val.highlight {
  color: #1677ff;
  font-weight: bold;
}

.checkbox-row {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}

.checkbox-tip {
  font-size: 24rpx;
  color: #606266;
  margin-left: 10rpx;
}

.image-uploader-row {
  display: flex;
  gap: 16rpx;
}

.img-preview-box {
  position: relative;
  width: 120rpx;
  height: 120rpx;
}

.uploaded-img {
  width: 100%;
  height: 100%;
  border-radius: 8rpx;
}

.del-btn {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  width: 36rpx;
  height: 36rpx;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  border-radius: 18rpx;
  text-align: center;
  line-height: 34rpx;
  font-size: 24rpx;
}

.upload-btn {
  width: 120rpx;
  height: 120rpx;
  background: #f5f7fa;
  border: 2rpx dashed #d9d9d9;
  border-radius: 8rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.cam-icon {
  font-size: 36rpx;
}

.cam-text {
  font-size: 20rpx;
  color: #8c8c8c;
  margin-top: 4rpx;
}

.modal-radio-group {
  display: flex;
  gap: 24rpx;
}

.radio-label {
  font-size: 26rpx;
  color: #262626;
}

.modal-btns {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
}

.m-btn {
  flex: 1;
  height: 76rpx;
  line-height: 76rpx;
  font-size: 28rpx;
  border-radius: 38rpx;
}

.m-btn.cancel {
  background: #f5f5f5;
  color: #595959;
}

.m-btn.confirm {
  background: #ff4d4f;
  color: #ffffff;
}

.m-btn.confirm-add {
  background: #1677ff;
  color: #ffffff;
}
</style>
