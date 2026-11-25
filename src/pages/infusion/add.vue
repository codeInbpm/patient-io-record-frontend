<template>
  <view class="infusion-add-container">
    <view class="patient-banner" v-if="patientInfo">
      <view class="patient-bed">{{ patientInfo.bedNo }}</view>
      <view class="patient-meta">
        <text class="name">{{ patientInfo.patientName }}</text>
        <text class="sub">住院号: {{ patientInfo.hospitalNo || '-' }}</text>
      </view>
    </view>

    <view class="form-card">
      <!-- 补液容量 -->
      <view class="form-item">
        <view class="item-label"><text class="required">*</text>补液容量 (ml)</view>
        <view class="preset-chips">
          <view
            v-for="cap in [100, 250, 500, 1000]"
            :key="cap"
            :class="['chip', form.capacity === cap ? 'active' : '']"
            @tap="selectCapacity(cap)"
          >
            {{ cap }} ml
          </view>
          <view
            :class="['chip', isCustomCapacity ? 'active' : '']"
            @tap="isCustomCapacity = true"
          >
            自定义
          </view>
        </view>
        <view class="custom-input-wrap" v-if="isCustomCapacity">
          <input
            type="number"
            class="input-box"
            v-model="form.capacity"
            placeholder="输入毫升数 (如 150)"
            @input="autoCalcEndTime"
          />
          <text class="unit">ml</text>
        </view>
      </view>

      <!-- 给药用法 -->
      <view class="form-item">
        <view class="item-label"><text class="required">*</text>给药用法</view>
        <view class="preset-chips">
          <view
            v-for="u in ['ivg', 'ibn']"
            :key="u"
            :class="['chip', !isCustomUsage && form.usageType === u ? 'active' : '']"
            @tap="selectUsage(u)"
          >
            {{ u }}
          </view>
          <view
            :class="['chip', isCustomUsage ? 'active' : '']"
            @tap="selectCustomUsage"
          >
            自定义
          </view>
        </view>
        <input
          v-if="isCustomUsage"
          class="input-box custom-usage"
          v-model="customUsageInput"
          placeholder="请输入自定义给药途径 (如: 泵入、皮下等)"
          @input="onCustomUsageInput"
        />
      </view>

      <!-- 开始时间 -->
      <view class="form-item">
        <view class="item-label"><text class="required">*</text>开始补液时间</view>
        <picker mode="time" :value="startTimeStr" @change="onStartTimeChange">
          <view class="picker-display">
            <text class="picker-val">今日 {{ startTimeStr }}</text>
            <text class="picker-hint">点击调整 ▾</text>
          </view>
        </picker>
      </view>

      <!-- 预计拔针时间 -->
      <view class="form-item">
        <view class="item-label"><text class="required">*</text>预计拔针时间 (护士预估)</view>
        <picker mode="time" :value="endTimeStr" @change="onEndTimeChange">
          <view class="picker-display">
            <text class="picker-val highlight">今日 {{ endTimeStr }}</text>
            <text class="picker-hint">点击调整 ▾</text>
          </view>
        </picker>
        <view class="adjust-chips">
          <view class="adjust-btn" @tap="adjustMinutes(15)">+15分</view>
          <view class="adjust-btn" @tap="adjustMinutes(30)">+30分</view>
          <view class="adjust-btn" @tap="adjustMinutes(60)">+1小时</view>
        </view>
      </view>

      <!-- 同步写入入量 -->
      <view class="form-item checkbox-item" @tap="form.syncToIntake = !form.syncToIntake">
        <checkbox :checked="form.syncToIntake" color="#1677ff" />
        <text class="checkbox-text">自动记入今日入量 (静脉补液: {{ form.capacity || 0 }}ml)</text>
      </view>

      <!-- 补液药物与说明 -->
      <view class="form-item">
        <view class="item-label"><text class="required">*</text>补液药物名称 / 规格说明</view>
        <textarea
          class="textarea-box"
          v-model="form.remark"
          placeholder="如: 0.9%氯化钠注射液250ml + 注射用头孢曲松钠2.0g，静滴40滴/分"
        />
      </view>

      <!-- 药袋与凭据拍照 -->
      <view class="form-item">
        <view class="item-label">
          <text>药袋 / 穿刺凭据图片</text>
          <text class="sub-label">已存至MinIO专属存储桶</text>
        </view>
        <view class="image-uploader">
          <view class="image-thumb" v-for="(img, idx) in uploadedImages" :key="idx">
            <image :src="img" mode="aspectFill" @tap="previewImg(img)" />
            <view class="delete-badge" @tap.stop="removeImg(idx)">×</view>
          </view>
          <view class="upload-trigger" v-if="uploadedImages.length < 3" @tap="chooseAndUpload">
            <text class="camera-icon">📷</text>
            <text class="camera-text">拍照/传图</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部提交按钮 -->
    <view class="submit-bar">
      <button class="submit-btn" :loading="submitting" @tap="handleSubmit">
        确认登记并开始监护
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createInfusionApi, uploadInfusionImageApi } from '../../api/infusion'
import { getPatientDetailApi } from '../../api/patient'

const patientInfo = ref(null)
const submitting = ref(false)
const isCustomCapacity = ref(false)
const isCustomUsage = ref(false)
const customUsageInput = ref('')

const startTimeStr = ref('')
const endTimeStr = ref('')
const uploadedImages = ref([])

const form = reactive({
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

const formatDateTime = (d) => {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

onLoad((options) => {
  // 绝不使用默认患者：缺参数直接拦回，避免补液被记到别的患者头上
  if (!options.patientId) {
    uni.showModal({
      title: '无法登记',
      content: '未获取到患者信息，请返回工作台重新进入。',
      showCancel: false,
      success: () => uni.navigateBack()
    })
    return
  }

  const patientId = options.patientId
  form.patientId = Number(patientId)

  // 初始化时间
  const now = new Date()
  startTimeStr.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  form.startTime = `${getTodayDateStr()} ${startTimeStr.value}:00`

  autoCalcEndTime()

  // 安全解码 URL 传参（避免中文字符显示为 %E5%BA%8A 等乱码）
  const bedNo = options.bedNo ? decodeURIComponent(options.bedNo) : ''
  const patientName = options.patientName ? decodeURIComponent(options.patientName) : ''
  const hospitalNo = options.hospitalNo ? decodeURIComponent(options.hospitalNo) : ''

  if (patientName) {
    patientInfo.value = {
      id: Number(patientId),
      bedNo: bedNo,
      patientName: patientName,
      hospitalNo: hospitalNo
    }
  } else {
    loadPatient(patientId)
  }
})

const loadPatient = async (id) => {
  try {
    const res = await getPatientDetailApi(id)
    if (res) {
      patientInfo.value = res
    }
  } catch (e) {}
}

const selectCapacity = (cap) => {
  isCustomCapacity.value = false
  form.capacity = cap
  autoCalcEndTime()
}

const selectUsage = (u) => {
  isCustomUsage.value = false
  form.usageType = u
}

const selectCustomUsage = () => {
  isCustomUsage.value = true
  form.usageType = customUsageInput.value.trim()
}

const onCustomUsageInput = (e) => {
  const val = (e.detail?.value !== undefined ? e.detail.value : customUsageInput.value) || ''
  form.usageType = val.trim()
}

const autoCalcEndTime = () => {
  let minutes = 90
  if (form.capacity <= 100) minutes = 45
  else if (form.capacity <= 250) minutes = 90
  else if (form.capacity <= 500) minutes = 150
  else minutes = 240

  const [h, m] = (startTimeStr.value || '00:00').split(':').map(Number)
  const [sYear, sMonth, sDay] = (form.startTime ? form.startTime.split(' ')[0] : getTodayDateStr()).split('-').map(Number)
  const start = new Date(sYear, sMonth - 1, sDay, h, m, 0)
  const end = new Date(start.getTime() + minutes * 60 * 1000)

  endTimeStr.value = `${pad(end.getHours())}:${pad(end.getMinutes())}`
  form.estimatedEndTime = formatDateTime(end)
}

const adjustMinutes = (mins) => {
  const base = form.estimatedEndTime ? new Date(form.estimatedEndTime.replace(/-/g, '/')) : new Date()
  const newEnd = new Date(base.getTime() + mins * 60 * 1000)

  endTimeStr.value = `${pad(newEnd.getHours())}:${pad(newEnd.getMinutes())}`
  form.estimatedEndTime = formatDateTime(newEnd)
}

const onStartTimeChange = (e) => {
  startTimeStr.value = e.detail.value
  form.startTime = `${getTodayDateStr()} ${startTimeStr.value}:00`
  autoCalcEndTime()
}

const onEndTimeChange = (e) => {
  endTimeStr.value = e.detail.value
  const [sDate, sTime] = (form.startTime || `${getTodayDateStr()} 00:00:00`).split(' ')
  const [sYear, sMonth, sDay] = sDate.split('-').map(Number)
  const [sHour, sMinute] = sTime.split(':').map(Number)
  const [eHour, eMinute] = endTimeStr.value.split(':').map(Number)

  const estDate = new Date(sYear, sMonth - 1, sDay, eHour, eMinute, 0)
  // 如果拔针时分小于开始时分，说明跨天到次日
  if (eHour < sHour || (eHour === sHour && eMinute < sMinute)) {
    estDate.setDate(estDate.getDate() + 1)
  }
  form.estimatedEndTime = formatDateTime(estDate)
}

const chooseAndUpload = () => {
  uni.chooseImage({
    count: 3 - uploadedImages.value.length,
    sizeType: ['compressed'],
    sourceType: ['camera', 'album'],
    success: async (res) => {
      uni.showLoading({ title: '上传至MinIO...' })
      try {
        for (const path of res.tempFilePaths) {
          const url = await uploadInfusionImageApi(path)
          const validUrl = typeof url === 'string' ? url : (url?.fileUrl || '')
          if (validUrl) {
            uploadedImages.value.push(validUrl)
          }
        }
      } catch (e) {
      } finally {
        uni.hideLoading()
      }
    }
  })
}

const removeImg = (idx) => {
  uploadedImages.value.splice(idx, 1)
}

const previewImg = (img) => {
  uni.previewImage({
    current: img,
    urls: uploadedImages.value
  })
}

const handleSubmit = async () => {
  if (!form.capacity || form.capacity <= 0) {
    uni.showToast({ title: '请填写有效补液容量', icon: 'none' })
    return
  }
  if (!form.usageType) {
    uni.showToast({ title: '请选择给药用法', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const payload = {
      ...form,
      imageUrls: uploadedImages.value
    }
    await createInfusionApi(payload)
    uni.showToast({ title: '登记成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1200)
  } catch (e) {
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.infusion-add-container {
  padding: 24rpx;
  background-color: #f5f7fa;
  min-height: 100vh;
  box-sizing: border-box;
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

.patient-banner {
  display: flex;
  align-items: center;
  background: #ffffff;
  padding: 24rpx;
  border-radius: 16rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
}

.patient-bed {
  font-size: 36rpx;
  font-weight: bold;
  color: #1677ff;
  background: #e6f4ff;
  padding: 12rpx 20rpx;
  border-radius: 12rpx;
  margin-right: 20rpx;
}

.patient-meta {
  display: flex;
  flex-direction: column;
}

.patient-meta .name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.patient-meta .sub {
  font-size: 24rpx;
  color: #8c8c8c;
  margin-top: 4rpx;
}

.form-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
}

.form-item {
  margin-bottom: 32rpx;
}

.item-label {
  font-size: 28rpx;
  font-weight: 600;
  color: #262626;
  margin-bottom: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.item-label .required {
  color: #ff4d4f;
  margin-right: 4rpx;
}

.sub-label {
  font-size: 22rpx;
  color: #8c8c8c;
  font-weight: normal;
}

.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  padding: 14rpx 28rpx;
  background: #f0f2f5;
  border-radius: 40rpx;
  font-size: 26rpx;
  color: #595959;
  border: 2rpx solid transparent;
}

.chip.active {
  background: #e6f4ff;
  color: #1677ff;
  border-color: #1677ff;
  font-weight: bold;
}

.custom-input-wrap {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
}

.input-box {
  background: #f5f7fa;
  height: 72rpx;
  padding: 0 20rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
  flex: 1;
}

.custom-usage {
  margin-top: 16rpx;
}

.unit {
  margin-left: 16rpx;
  font-size: 28rpx;
  color: #8c8c8c;
}

.picker-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f5f7fa;
  height: 80rpx;
  padding: 0 24rpx;
  border-radius: 12rpx;
}

.picker-val {
  font-size: 30rpx;
  color: #262626;
  font-weight: 500;
}

.picker-val.highlight {
  color: #1677ff;
  font-weight: bold;
}

.picker-hint {
  font-size: 24rpx;
  color: #8c8c8c;
}

.adjust-chips {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}

.adjust-btn {
  background: #f0f7ff;
  color: #1677ff;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
}

.checkbox-item {
  display: flex;
  align-items: center;
  background: #f9f9f9;
  padding: 20rpx;
  border-radius: 12rpx;
}

.checkbox-text {
  font-size: 26rpx;
  color: #262626;
  margin-left: 12rpx;
}

.textarea-box {
  background: #f5f7fa;
  width: 100%;
  height: 140rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.image-uploader {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.image-thumb {
  width: 150rpx;
  height: 150rpx;
  position: relative;
  border-radius: 12rpx;
  overflow: hidden;
}

.image-thumb image {
  width: 100%;
  height: 100%;
}

.delete-badge {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  width: 36rpx;
  height: 36rpx;
  line-height: 32rpx;
  text-align: center;
  border-radius: 50%;
  font-size: 28rpx;
}

.upload-trigger {
  width: 150rpx;
  height: 150rpx;
  border: 2rpx dashed #d9d9d9;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fafafa;
}

.camera-icon {
  font-size: 44rpx;
}

.camera-text {
  font-size: 22rpx;
  color: #8c8c8c;
  margin-top: 6rpx;
}

.submit-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #ffffff;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.submit-btn {
  background: #1677ff;
  color: #ffffff;
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: bold;
  height: 88rpx;
  line-height: 88rpx;
}
</style>
