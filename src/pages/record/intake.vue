<template>
  <view class="record-page">
    <!-- 记录时始终看得见「记给谁」，避免连续记录时张冠李戴 -->
    <PatientHeader
      :bed-no="patient.bedNo"
      :patient-name="patient.patientName"
      :hospital-no="patient.hospitalNo"
      :intake="patient.todayIntake"
      :output="patient.todayOutput"
      :balance="patient.todayBalance"
      :count="patient.todayRecordCount"
      @switch="goBackToWorkbench"
    />

    <view class="container">
      <view class="form-card">
        <!-- 入量大类切换 -->
        <view class="category-tabs">
          <view
            :class="['tab-item', form.intakeType === 'ORAL' ? 'active' : '']"
            @tap="switchType('ORAL')"
          >
            口服
          </view>
          <view
            :class="['tab-item', form.intakeType === 'IV' ? 'active' : '']"
            @tap="switchType('IV')"
          >
            静脉输液
          </view>
          <view
            :class="['tab-item', form.intakeType === 'NASOGASTRIC' ? 'active' : '']"
            @tap="switchType('NASOGASTRIC')"
          >
            鼻饲
          </view>
        </view>

        <!-- 最近使用：一键带出上次的品名与量 -->
        <view class="recent-block" v-if="recentList.length > 0">
          <text class="field-label">最近使用</text>
          <view class="chips-container">
            <view
              class="recent-chip"
              v-for="(r, idx) in recentList"
              :key="idx"
              @tap="applyRecent(r)"
            >
              {{ r.label }}
            </view>
          </view>
        </view>

        <!-- 口服快捷品类 -->
        <view class="item-selector" v-if="form.intakeType === 'ORAL'">
          <text class="field-label">常用品类</text>
          <view class="chips-container">
            <view
              :class="['chip-item', form.itemName === item.name ? 'selected' : '']"
              v-for="item in oralPresets"
              :key="item.name"
              @tap="selectOralPreset(item)"
            >
              {{ item.name }}
            </view>
          </view>
        </view>

        <!-- 品名输入 -->
        <view class="form-group">
          <text class="label">品名 *</text>
          <input class="input" v-model="form.itemName" placeholder="如：温开水、米汤、生理盐水 500ml" />
        </view>

        <!-- 容量 -->
        <view class="form-group">
          <text class="label">摄入量 (ml) *</text>
          <view class="amount-row">
            <input class="input amount-input" type="digit" v-model="form.amount" placeholder="输入或点选" />
            <view class="amount-step">
              <view class="step-btn" @tap="adjustAmount(-50)">−50</view>
              <view class="step-btn" @tap="adjustAmount(50)">+50</view>
            </view>
          </view>
          <view class="amount-chips">
            <view
              class="amount-chip"
              v-for="amt in [50, 100, 150, 200, 250, 500]"
              :key="amt"
              @tap="form.amount = String(amt)"
            >
              {{ amt }}
            </view>
          </view>
        </view>

        <!-- 时间 -->
        <view class="form-group">
          <view class="label-row">
            <text class="label">摄入时间 *</text>
            <text class="quick-now" @tap="setNow">设为现在</text>
          </view>
          <view class="time-picker-row">
            <picker mode="date" :value="recordDatePart" @change="onDateChange">
              <view class="picker-box">{{ recordDatePart }}</view>
            </picker>
            <picker mode="time" :value="recordTimePart" @change="onTimeChange">
              <view class="picker-box">{{ recordTimePart }}</view>
            </picker>
          </view>
        </view>

        <!-- 备注 -->
        <view class="form-group">
          <text class="label">备注（可选）</text>
          <input class="input" v-model="form.remark" placeholder="如：患者自行饮用、遵医嘱输注" />
        </view>
      </view>

      <view class="session-tip" v-if="sessionCount > 0">
        本次已连续录入 {{ sessionCount }} 笔，患者今日共 {{ patient.todayRecordCount || 0 }} 笔
      </view>
    </view>

    <!-- 底部固定操作栏：两个动作都可见，减少来回进出 -->
    <view class="bottom-bar">
      <button class="bar-btn secondary" :disabled="loading" @tap="handleSubmit(false)">保存并返回</button>
      <button class="bar-btn primary" :disabled="loading" @tap="handleSubmit(true)">
        {{ loading ? '保存中…' : '保存并继续' }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { recordIntakeApi } from '../../api/record'
import { getPatientDetailApi } from '../../api/patient'
import { formatDate, formatTimeOnly } from '../../utils/date'
import { getRecent, pushRecent } from '../../utils/presets'
import { enqueueRecord } from '../../utils/offline'
import PatientHeader from '../../components/PatientHeader.vue'

const patientId = ref(null)
const loading = ref(false)
const sessionCount = ref(0)

const patient = ref({
  bedNo: '',
  patientName: '',
  hospitalNo: '',
  todayIntake: 0,
  todayOutput: 0,
  todayBalance: 0,
  todayRecordCount: 0
})

const recordDatePart = ref(formatDate())
const recordTimePart = ref(formatTimeOnly(new Date()))

const oralPresets = [
  { name: '水', subType: 'WATER' },
  { name: '粥', subType: 'CONGEE' },
  { name: '面条', subType: 'NOODLES' },
  { name: '米汤', subType: 'RICE_SOUP' },
  { name: '藕粉', subType: 'LOTUS_STARCH' },
  { name: '牛奶/豆浆', subType: 'CUSTOM' }
]

const form = ref({
  patientId: null,
  intakeType: 'ORAL',
  subType: 'WATER',
  itemName: '水',
  // 不预填 150：护士手快直接保存就会凭空产生一条「水 150ml」，
  // 这类假数据比漏记更难发现，必须让录入人自己点一个量
  amount: '',
  remark: ''
})

const recentList = ref([])

const currentTypeLabel = computed(() => {
  if (form.value.intakeType === 'IV') return '静脉输液'
  if (form.value.intakeType === 'NASOGASTRIC') return '鼻饲'
  return '口服'
})

function loadRecent() {
  recentList.value = getRecent('intake')
}

function applyRecent(item) {
  const p = item.payload || {}
  form.value.intakeType = p.intakeType || 'ORAL'
  form.value.subType = p.subType || 'WATER'
  form.value.itemName = p.itemName || ''
  form.value.amount = String(p.amount || '')
}

function switchType(type) {
  form.value.intakeType = type
  // 量不跟着预填：输液规格有 100/250/500，鼻饲有 200/500，猜一个就是在替护士编数据
  form.value.amount = ''
  if (type === 'ORAL') {
    form.value.itemName = '水'
    form.value.subType = 'WATER'
  } else if (type === 'IV') {
    form.value.itemName = '静脉输液'
    form.value.subType = 'IV_FLUID'
  } else if (type === 'NASOGASTRIC') {
    form.value.itemName = '鼻饲营养液'
    form.value.subType = 'TUBE_FEED'
  }
}

function selectOralPreset(item) {
  form.value.itemName = item.name
  form.value.subType = item.subType
}

function adjustAmount(delta) {
  const next = Math.max(0, Number(form.value.amount || 0) + delta)
  form.value.amount = String(next)
}

function setNow() {
  const now = new Date()
  recordDatePart.value = formatDate(now)
  recordTimePart.value = formatTimeOnly(now)
}

function onDateChange(e) {
  recordDatePart.value = e.detail.value
}

function onTimeChange(e) {
  recordTimePart.value = e.detail.value
}

function validate() {
  if (!form.value.itemName.trim()) {
    uni.showToast({ title: '请输入品名', icon: 'none' })
    return false
  }
  const amount = Number(form.value.amount)
  if (!amount || amount <= 0) {
    uni.showToast({ title: '摄入量必须大于 0', icon: 'none' })
    return false
  }
  if (amount > 10000) {
    uni.showToast({ title: '摄入量超出合理范围，请核对', icon: 'none' })
    return false
  }
  return true
}

function buildPayload() {
  const recordTime = `${recordDatePart.value} ${recordTimePart.value}:00`
  return {
    patientId: patientId.value,
    intakeType: form.value.intakeType,
    subType: form.value.subType,
    itemName: form.value.itemName.trim(),
    amount: Number(form.value.amount),
    recordTime,
    remark: form.value.remark
  }
}

function applyLocalSuccess(payload) {
  patient.value.todayIntake = Number(patient.value.todayIntake || 0) + payload.amount
  patient.value.todayBalance = Number(patient.value.todayBalance || 0) + payload.amount
  patient.value.todayRecordCount = Number(patient.value.todayRecordCount || 0) + 1
  patient.value.lastRecordTime = payload.recordTime
  sessionCount.value += 1
}

async function handleSubmit(continueMode) {
  if (loading.value) return
  if (!validate()) return

  const payload = buildPayload()
  loading.value = true
  try {
    await recordIntakeApi(payload)
    applyLocalSuccess(payload)

    // 记住这次组合，下次一键带出
    pushRecent('intake', {
      label: `${payload.itemName} ${payload.amount}ml`,
      payload: {
        intakeType: payload.intakeType,
        subType: payload.subType,
        itemName: payload.itemName,
        amount: payload.amount
      }
    })
    loadRecent()

    if (continueMode) {
      uni.showToast({ title: `已记录 ${payload.amount}ml`, icon: 'none' })
      // 时间自动跳到当前，品名和量保留（同一患者常连续记同类同量，护士少点两下）
      setNow()
      form.value.remark = ''
    } else {
      uni.showToast({ title: '入量已记录', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 600)
    }
  } catch (e) {
    // 断网：落到本地队列，不让护士白填一遍
    if (e?.kind === 'network' || e?.kind === 'timeout') {
      const pending = enqueueRecord('intake', payload, `${patient.value.bedNo} ${patient.value.patientName} · ${payload.itemName} ${payload.amount}ml`)
      uni.showModal({
        title: '网络不稳定',
        content: `这条记录已暂存在本机（待同步 ${pending} 条），网络恢复后会自动补传。`,
        showCancel: false,
        confirmText: '知道了'
      })
      applyLocalSuccess(payload)
      if (continueMode) {
        setNow()
      } else {
        setTimeout(() => uni.navigateBack(), 600)
      }
    }
    // 业务错误已由请求层提示，这里不重复弹
  } finally {
    loading.value = false
  }
}

async function loadPatient(pid) {
  try {
    const data = await getPatientDetailApi(pid)
    if (data) {
      patient.value = {
        bedNo: data.bedNo || '',
        patientName: data.patientName || '',
        hospitalNo: data.hospitalNo || '',
        todayIntake: data.todayIntake || 0,
        todayOutput: data.todayOutput || 0,
        todayBalance: data.todayBalance || 0,
        todayRecordCount: data.todayRecordCount || 0,
        lastRecordTime: data.lastRecordTime || null
      }
    }
  } catch (e) {
    // 详情拿不到不阻断记录，顶部会显示「未获取到患者」，但仍可保存
    console.error('加载患者信息失败', e)
  }
}

function goBackToWorkbench() {
  uni.navigateBack({
    fail: () => uni.switchTab({ url: '/pages/index/index' })
  })
}

onLoad((options) => {
  if (!options.patientId) {
    // 没有患者 ID 绝不允许记录，直接拦回，避免记到错误患者头上
    uni.showModal({
      title: '无法记录',
      content: '未获取到患者信息，请返回工作台重新进入。',
      showCancel: false,
      success: () => uni.navigateBack()
    })
    return
  }
  patientId.value = options.patientId
  form.value.patientId = options.patientId
  loadPatient(options.patientId)
  loadRecent()
})
</script>

<style>
.record-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}

.container {
  padding: 24rpx;
}

.form-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.category-tabs {
  display: flex;
  background: #f0f2f5;
  border-radius: 12rpx;
  padding: 6rpx;
  margin-bottom: 28rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  font-size: 30rpx;
  color: #595959;
  border-radius: 10rpx;
  font-weight: 500;
}

.tab-item.active {
  background: #52c41a;
  color: #ffffff;
  font-weight: bold;
}

.recent-block {
  margin-bottom: 24rpx;
}

.field-label {
  font-size: 26rpx;
  color: #8c8c8c;
  margin-bottom: 12rpx;
  display: block;
}

.chips-container {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.recent-chip {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #389e0d;
  border-radius: 30rpx;
  padding: 12rpx 24rpx;
  font-size: 26rpx;
}

.chip-item {
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 30rpx;
  padding: 12rpx 26rpx;
  font-size: 28rpx;
  color: #262626;
}

.chip-item.selected {
  background: #f6ffed;
  border-color: #52c41a;
  color: #389e0d;
  font-weight: bold;
}

.item-selector {
  margin-bottom: 24rpx;
}

.form-group {
  margin-bottom: 30rpx;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.label {
  font-size: 28rpx;
  color: #595959;
  display: block;
  margin-bottom: 10rpx;
}

.quick-now {
  font-size: 26rpx;
  color: #1677ff;
  padding: 0 8rpx;
}

.input {
  height: 88rpx;
  min-height: 88rpx;
  line-height: 88rpx;
  padding: 0 20rpx;
  border: 1px solid #d9d9d9;
  border-radius: 10rpx;
  font-size: 30rpx;
  background: #fafafa;
  box-sizing: border-box;
}

.amount-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.amount-input {
  flex: 1;
  height: 96rpx;
  min-height: 96rpx;
  line-height: 96rpx;
  font-size: 40rpx;
  font-weight: bold;
  color: #389e0d;
  text-align: center;
}

.amount-step {
  display: flex;
  gap: 8rpx;
}

.step-btn {
  background: #f0f5ff;
  color: #1677ff;
  border: 1px solid #adc6ff;
  border-radius: 10rpx;
  font-size: 24rpx;
  padding: 18rpx 14rpx;
}

.amount-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 16rpx;
}

.amount-chip {
  background: #f0f5ff;
  color: #1677ff;
  border: 1px solid #adc6ff;
  border-radius: 24rpx;
  padding: 10rpx 28rpx;
  font-size: 28rpx;
}

.time-picker-row {
  display: flex;
  gap: 20rpx;
}

.picker-box {
  border: 1px solid #d9d9d9;
  border-radius: 10rpx;
  padding: 20rpx 28rpx;
  font-size: 30rpx;
  background: #fafafa;
}

.session-tip {
  margin-top: 20rpx;
  text-align: center;
  font-size: 26rpx;
  color: #8c8c8c;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 20rpx;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
  z-index: 60;
}

.bar-btn {
  flex: 1;
  height: 92rpx;
  line-height: 92rpx;
  font-size: 32rpx;
  font-weight: bold;
  border-radius: 46rpx;
  margin: 0;
}

.bar-btn.secondary {
  background: #f5f7fa;
  color: #595959;
  border: 1px solid #d9d9d9;
}

.bar-btn.primary {
  background: #52c41a;
  color: #ffffff;
  flex: 1.4;
}
</style>
