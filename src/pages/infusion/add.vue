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
      <!-- 补液药物：先定药，再定量；从字典选择，避免手打错字 -->
      <view class="form-item">
        <view class="item-label">
          <text class="required">*</text>补液药物
          <text class="sub-label">从字典选择，支持拼音首字母</text>
        </view>
        <DrugPicker v-model="form.drugs" :max="5" :route="form.usageType" />

        <!-- 一条记录 = 一袋：容量和 ml 用量是同一个数，可手填也可点选 -->
        <view class="cap-line" v-if="form.drugs.length">
          <view class="cap-line-head">
            <text class="cap-line-label">本袋容量</text>
            <view class="cap-input-wrap">
              <input
                type="number"
                class="cap-input"
                :value="capText"
                @input="onCapacityInput"
              />
              <text class="cap-unit">ml</text>
            </view>
            <text class="cap-line-tip">{{ bagCapacity ? '计入今日入量' : '这袋给多少填这里' }}</text>
          </view>
          <view class="cap-chips">
            <view
              v-for="cap in [100, 250, 500, 1000]"
              :key="cap"
              :class="['cap-chip', Number(form.capacity) === cap ? 'active' : '']"
              @tap="setCapacity(cap)"
            >{{ cap }}</view>
          </view>
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

      <!-- 备注：滴速等补充说明 -->
      <view class="form-item">
        <view class="item-label">备注（可选）</view>
        <input
          class="input-box"
          v-model="form.remark"
          placeholder="如：静滴 40 滴/分"
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
import { ref, reactive, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createInfusionApi, uploadInfusionImageApi } from '../../api/infusion'
import { getPatientDetailApi } from '../../api/patient'
import DrugPicker from '../../components/DrugPicker.vue'

const patientInfo = ref(null)
const submitting = ref(false)
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
  drugs: [],
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
      content: '未获取到患者信息。请从工作台的患者卡片点「登记补液」进入，或在开发者工具给本页配置启动参数 patientId。',
      showCancel: false,
      success: () => {
        // 直接以本页为启动页时没有页面栈，navigateBack 会失败并卡死在白屏
        const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
        if (stack.length > 1) {
          uni.navigateBack()
        } else {
          uni.reLaunch({ url: '/pages/index/index' })
        }
      }
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

// 本袋容量 = 溶媒的用量（多药取最大）。一条记录一袋。
// 规格 ≤ 20ml 的 ml 药（氯化钾 10ml 这类）算添加药，不参与容量计算。
const ADDITIVE_SPEC_ML = 20

const isMlUnit = (d) => {
  const unit = String(d.unit || '').toLowerCase()
  if (unit === 'ml' || unit === '毫升') return true
  return !unit && /ml|毫升/i.test(String(d.spec || ''))
}

const specMl = (spec) => {
  const m = String(spec || '').match(/(\d+(?:\.\d+)?)\s*(毫升|ml|mL|ML|L)/)
  if (!m) return 0
  const v = parseFloat(m[1])
  if (!v) return 0
  return m[2].toLowerCase() === 'l' ? v * 1000 : v
}

// 溶媒：包装规格 > 20ml（规格没写 ml 的按非溶媒处理，容量交给人填）
const isSolvent = (d) => specMl(d.spec) > ADDITIVE_SPEC_ML

// 这一味药实际给了多少 ml：单位是 ml 就直接取用量，单位是袋/瓶/支就 用量 × 包装容量
const drugVolume = (d) => {
  const dose = Number(String(d.dose || '').replace(/[^\d.]/g, ''))
  if (!dose) return 0
  if (isMlUnit(d)) return dose
  const pack = specMl(d.spec)
  return pack ? dose * pack : 0
}

const bagCapacity = computed(() => {
  let max = 0
  ;(form.drugs || []).forEach((d) => {
    if (!isSolvent(d)) return
    const v = drugVolume(d)
    if (v > max) max = v
  })
  return max
})

// 用量一改，容量跟着走；这样不会出现「用量填 300、存下来 250」
watch(bagCapacity, (v) => {
  if (v > 0) form.capacity = v
})

const capText = computed(() => (form.capacity ? String(form.capacity) : ''))

// 手填或点选都走这里：容量写回 form.capacity，同时回写到 ml 那味药的用量，
// 保证「用量」和「容量」永远是同一个数。
const setCapacity = (v) => {
  const n = Number(v) || 0
  form.capacity = n
  const solvents = (form.drugs || []).filter((d) => isSolvent(d))
  const target = solvents.sort((a, b) => drugVolume(b) - drugVolume(a))[0]
  // 只有用量本身就是 ml 的药才回写，按袋/支计量的不换算，避免把「1 袋」写成「500」
  if (target && isMlUnit(target)) target.dose = String(n)
  autoCalcEndTime()
}

const onCapacityInput = (e) => {
  const raw = e?.detail?.value
  setCapacity(raw === undefined ? form.capacity : raw)
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
  if (!bagCapacity.value && !(form.capacity > 0)) {
    uni.showToast({ title: '请填这袋的容量（药品用量里填 ml 数）', icon: 'none' })
    return
  }
  if (!form.usageType) {
    uni.showToast({ title: '请选择给药用法', icon: 'none' })
    return
  }
  if (!form.drugs || !form.drugs.length) {
    uni.showToast({ title: '请从字典选择补液药物', icon: 'none' })
    return
  }
  // 只有高警示药强制用量，普通溶媒不强填，避免为了过校验乱填
  const missingDose = form.drugs.find((d) => d.highAlert === 1 && !String(d.dose || '').trim())
  if (missingDose) {
    uni.showToast({ title: `高警示药品「${missingDose.name}」必须填写用量`, icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const payload = {
      ...form,
      capacity: Number(bagCapacity.value || form.capacity || 0),
      drugs: form.drugs.map((d) => ({
        id: d.id || null,
        name: d.name,
        spec: d.spec || '',
        dose: String(d.dose || '').trim(),
        unit: d.unit || '',
        route: d.route || form.usageType || '',
        highAlert: d.highAlert || 0,
        manual: !!d.manual
      })),
      remark: (form.remark || '').trim(),
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

.cap-line {
  margin-top: 16rpx;
  padding: 20rpx 24rpx;
  background: #f7f9fc;
  border-radius: 14rpx;
}

.cap-line-head {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.cap-line-label {
  font-size: 26rpx;
  color: #595959;
  flex-shrink: 0;
}

.cap-input-wrap {
  display: flex;
  align-items: center;
  height: 64rpx;
  padding: 0 16rpx;
  background: #fff;
  border: 2rpx solid #d9d9d9;
  border-radius: 10rpx;
}

.cap-input {
  width: 130rpx;
  height: 64rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #1677ff;
  text-align: center;
}

.cap-unit {
  font-size: 24rpx;
  color: #8c8c8c;
}

.cap-line-tip {
  flex: 1;
  text-align: right;
  font-size: 22rpx;
  color: #8c8c8c;
}

.cap-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.cap-chip {
  padding: 0 26rpx;
  height: 56rpx;
  line-height: 56rpx;
  border-radius: 28rpx;
  background: #fff;
  border: 2rpx solid #e5e6eb;
  font-size: 24rpx;
  color: #595959;
}

.cap-chip.active {
  border-color: #1677ff;
  background: #e8f1ff;
  color: #1677ff;
  font-weight: 600;
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
