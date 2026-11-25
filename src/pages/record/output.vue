<template>
  <view class="record-page">
    <!-- 出量页同样固定患者身份，避免记错人 -->
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
        <!-- 出量类型 -->
        <view class="category-tabs">
          <view
            :class="['tab-item', form.outputType === 'URINE' ? 'active' : '']"
            @tap="switchType('URINE')"
          >
            尿量
          </view>
          <view
            :class="['tab-item', form.outputType === 'STOOL' ? 'active' : '']"
            @tap="switchType('STOOL')"
          >
            大便
          </view>
          <view
            :class="['tab-item', form.outputType === 'GASTRO_DRAINAGE' ? 'active' : '']"
            @tap="switchType('GASTRO_DRAINAGE')"
          >
            胃肠减压
          </view>
        </view>

        <!-- 最近使用 -->
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

        <!-- 量 -->
        <view class="form-group">
          <text class="label">排出量 (ml) *</text>
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
              v-for="amt in [100, 150, 200, 300, 400, 500]"
              :key="amt"
              @tap="form.amount = String(amt)"
            >
              {{ amt }}
            </view>
          </view>
        </view>

        <!-- 性状：必填。默认值会把血尿记成清亮，把黑便记成软便 -->
        <view class="form-group">
          <text class="label">性状 / 颜色 *</text>
          <view class="nature-chips">
            <view
              :class="['nature-chip', form.natureOrColor === tag ? 'selected' : '']"
              v-for="tag in currentNatureTags"
              :key="tag"
              @tap="form.natureOrColor = tag"
            >
              {{ tag }}
            </view>
          </view>
          <input class="input nature-input" v-model="form.natureOrColor" placeholder="也可自定义输入" />
          <view class="nature-warn" v-if="isDangerNature">
            这是要医生知道的信号，记录后请当面告知主管医生
          </view>
        </view>

        <!-- 时间 -->
        <view class="form-group">
          <view class="label-row">
            <text class="label">排出时间 *</text>
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
          <input class="input" v-model="form.remark" placeholder="如：留置导尿管引流、自主排尿" />
        </view>
      </view>

      <view class="session-tip" v-if="sessionCount > 0">
        本次已连续录入 {{ sessionCount }} 笔，患者今日共 {{ patient.todayRecordCount || 0 }} 笔
      </view>
    </view>

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
import { recordOutputApi } from '../../api/record'
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

const form = ref({
  patientId: null,
  outputType: 'URINE',
  // 量不预填：尿量 100 和 400 差 4 倍，猜一个数就是在替护士编数据
  amount: '',
  // 性状不预填：不选不许保存，避免血尿/黑便被默认成正常
  natureOrColor: '',
  remark: ''
})

const recentList = ref([])

const natureOptions = {
  URINE: ['淡黄色清亮', '深黄浓茶色', '洗肉水色/血尿', '混浊有沉淀'],
  STOOL: ['黄色软便', '成形硬便', '稀水便', '柏油样黑便'],
  GASTRO_DRAINAGE: ['黄绿草绿色', '墨绿色', '咖啡色胃液', '鲜红带血']
}

const currentNatureTags = computed(() => natureOptions[form.value.outputType] || [])

// 出血性信号：记下来不等于处理了，得让医生知道
const isDangerNature = computed(() => {
  const v = form.value.natureOrColor || ''
  return v.indexOf('血尿') > -1 || v.indexOf('黑便') > -1 || v.indexOf('带血') > -1 || v.indexOf('咖啡色') > -1
})

const typeLabel = computed(() => {
  if (form.value.outputType === 'STOOL') return '大便'
  if (form.value.outputType === 'GASTRO_DRAINAGE') return '胃肠减压'
  return '尿量'
})

function loadRecent() {
  recentList.value = getRecent('output')
}

function applyRecent(item) {
  const p = item.payload || {}
  form.value.outputType = p.outputType || 'URINE'
  form.value.amount = String(p.amount || '')
  form.value.natureOrColor = p.natureOrColor || ''
}

function switchType(type) {
  form.value.outputType = type
  // 量和性状都不预填：血尿被默认成「清亮」是这套系统里最危险的一种假数据
  form.value.amount = ''
  form.value.natureOrColor = ''
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
  const amount = Number(form.value.amount)
  if (!amount || amount <= 0) {
    uni.showToast({ title: '排出量必须大于 0', icon: 'none' })
    return false
  }
  if (amount > 10000) {
    uni.showToast({ title: '排出量超出合理范围，请核对', icon: 'none' })
    return false
  }
  // 性状必须自己选：默认值会把血尿记成清亮，把黑便记成软便
  if (!form.value.natureOrColor) {
    const label = form.value.outputType === 'URINE' ? '尿的颜色' : (form.value.outputType === 'STOOL' ? '大便的性状' : '引流液的颜色')
    uni.showToast({ title: `请选一下${label}`, icon: 'none' })
    return false
  }
  return true
}

function buildPayload() {
  const recordTime = `${recordDatePart.value} ${recordTimePart.value}:00`
  return {
    patientId: patientId.value,
    outputType: form.value.outputType,
    amount: Number(form.value.amount),
    natureOrColor: form.value.natureOrColor,
    recordTime,
    remark: form.value.remark
  }
}

function applyLocalSuccess(payload) {
  patient.value.todayOutput = Number(patient.value.todayOutput || 0) + payload.amount
  patient.value.todayBalance = Number(patient.value.todayBalance || 0) - payload.amount
  patient.value.todayRecordCount = Number(patient.value.todayRecordCount || 0) + 1
  sessionCount.value += 1
}

async function handleSubmit(continueMode) {
  if (loading.value) return
  if (!validate()) return

  const payload = buildPayload()
  loading.value = true
  try {
    await recordOutputApi(payload)
    applyLocalSuccess(payload)

    pushRecent('output', {
      label: `${typeLabel.value} ${payload.amount}ml`,
      payload: {
        outputType: payload.outputType,
        amount: payload.amount,
        natureOrColor: payload.natureOrColor
      }
    })
    loadRecent()

    if (continueMode) {
      uni.showToast({ title: `已记录 ${payload.amount}ml`, icon: 'none' })
      setNow()
      form.value.remark = ''
    } else {
      uni.showToast({ title: '出量已记录', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 600)
    }
  } catch (e) {
    if (e?.kind === 'network' || e?.kind === 'timeout') {
      const pending = enqueueRecord('output', payload, `${patient.value.bedNo} ${patient.value.patientName} · ${typeLabel.value} ${payload.amount}ml`)
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
  font-size: 28rpx;
  color: #595959;
  border-radius: 10rpx;
  font-weight: 500;
}

.tab-item.active {
  background: #fa8c16;
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
  background: #fff7e6;
  border: 1px solid #ffd591;
  color: #ad4e00;
  border-radius: 30rpx;
  padding: 12rpx 24rpx;
  font-size: 26rpx;
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
  color: #d46b08;
  text-align: center;
}

.amount-step {
  display: flex;
  gap: 8rpx;
}

.step-btn {
  background: #fff7e6;
  color: #d46b08;
  border: 1px solid #ffd591;
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
  background: #fff7e6;
  color: #d46b08;
  border: 1px solid #ffd591;
  border-radius: 24rpx;
  padding: 10rpx 28rpx;
  font-size: 28rpx;
}

.nature-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-bottom: 14rpx;
}

.nature-chip {
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 30rpx;
  padding: 12rpx 24rpx;
  font-size: 26rpx;
  color: #262626;
}

.nature-chip.selected {
  background: #fff7e6;
  border-color: #fa8c16;
  color: #ad4e00;
  font-weight: bold;
}

.nature-input {
  height: 80rpx;
  min-height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}

.nature-warn {
  margin-top: 12rpx;
  padding: 12rpx 16rpx;
  font-size: 26rpx;
  color: #cf1322;
  background: #fff1f0;
  border-radius: 10rpx;
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
  background: #fa8c16;
  color: #ffffff;
  flex: 1.4;
}
</style>
