<template>
  <view class="container">
    <!-- 病患基本信息卡 -->
    <view class="patient-header" v-if="patient">
      <view class="title-row">
        <text class="bed-tag">{{ patient.bedNo }}</text>
        <text class="name">{{ patient.patientName }}</text>
        <text class="hospital-no">住院号: {{ patient.hospitalNo }}</text>
        <text class="header-duty-tag duty" v-if="patient.isMyDuty">在管责任</text>
        <text class="header-duty-tag readonly" v-else-if="userStore.isNurse && !userStore.isHeadNurse">仅查阅</text>
      </view>
      <view class="detail-row">
        <text>科室病区: {{ patient.wardName }}</text>
        <text>责任护士: {{ patient.assignedNurseName || '暂未分配' }}</text>
      </view>
      <view class="diag-text">诊断: {{ patient.diagnosis || '无' }}</view>

      <view :class="['pulse-line', patient.isMissed ? 'warn' : '']">
        <text class="pulse-dot"></text>
        <text class="pulse-text">{{ lastRecordText }} · 今日已记录 {{ patient.todayRecordCount || 0 }} 笔</text>
      </view>
    </view>

    <StateView
      v-if="loadState === 'loading' && !patient"
      state="loading"
      :skeleton-rows="2"
    />
    <StateView
      v-else-if="loadState === 'error' && !patient"
      state="error"
      title="患者信息加载失败"
      desc="请检查网络后重试"
      @retry="loadData"
    />

    <!-- 从「患者说记错了」过来：把要改的那条摆在最前面，护士不用在流水里翻 -->
    <view class="correction-focus" v-if="focusItem">
      <view class="cf-head">
        <text class="cf-tag">患者反馈</text>
        <text class="cf-text">
          {{ formatTime(focusItem.recordTime) }} · {{ focusItem.itemName }} {{ focusItem.amount }}ml
        </text>
      </view>
      <text class="cf-reason">患者说：{{ focusReason || '这条记错了' }}</text>
      <view class="cf-actions">
        <text class="cf-btn danger" @tap="rejectCorrection(focusItem)">驳回，让患者重记</text>
        <text class="cf-btn primary" @tap="confirmCorrectionOk()">确认无误</text>
      </view>
    </view>

    <!-- 日期选择与导航 -->
    <view class="date-bar">
      <button class="date-nav-btn" size="mini" @tap="changeDate(-1)">前一天</button>
      <picker mode="date" :value="currentDate" @change="onDatePick">
        <view class="current-date-picker">
          <text class="cal-icon">📅</text>
          <text class="date-text">{{ currentDate }}</text>
          <text class="today-tag" v-if="isToday">（今日）</text>
        </view>
      </picker>
      <button class="date-nav-btn" size="mini" @tap="changeDate(1)">后一天</button>
    </view>

    <!-- 当日出入平衡大卡片 -->
    <view class="balance-card" v-if="dailyData">
      <view class="balance-overview">
        <view class="b-item in">
          <text class="b-label">总入量 (ml)</text>
          <text class="b-val">{{ dailyData.totalIntake || 0 }}</text>
        </view>
        <view class="b-item out">
          <text class="b-label">总出量 (ml)</text>
          <text class="b-val">{{ dailyData.totalOutput || 0 }}</text>
        </view>
        <!-- 规则2: 入量-出量差值>1000ml 标红 -->
        <view :class="['b-item', 'net', dailyData.isBalanceAlert ? 'bg-alert-red' : '']">
          <text class="b-label">净差值 (ml)</text>
          <text :class="['b-val', dailyData.isBalanceAlert ? 'alert-red-text' : ((dailyData.netBalance || 0) >= 0 ? 'pos' : 'neg')]">
            {{ (dailyData.netBalance || 0) > 0 ? '+' : '' }}{{ dailyData.netBalance || 0 }}
          </text>
          <text v-if="dailyData.isBalanceAlert" class="badge-tag-red">差值＞1000ml</text>
        </view>
      </view>

      <!-- 异常警示条 -->
      <view class="abnormal-banner" v-if="dailyData.isAbnormal">
        <text class="warn-icon">⚠️</text>
        <text class="warn-msg">{{ dailyData.abnormalReason || '出入量异常预警' }}</text>
      </view>

      <!-- 分项折叠汇总 -->
      <view class="sub-breakdown">
        <view class="sub-row">
          <text class="sub-cell">口服: {{ dailyData.oralIntake || 0 }}ml</text>
          <!-- 规则3: 静脉输液>3000ml 标黄 -->
          <view :class="['sub-cell', dailyData.isIvAlert ? 'bg-alert-yellow text-warn' : '']">
            <text>输液: {{ dailyData.ivIntake || 0 }}ml</text>
            <text v-if="dailyData.isIvAlert" class="tag-warn-pill">＞3000</text>
          </view>
          <text class="sub-cell">鼻饲: {{ dailyData.nasogastricIntake || 0 }}ml</text>
        </view>
        <view class="sub-row">
          <!-- 规则1: 24h尿量<400ml 标红 -->
          <view :class="['sub-cell', dailyData.isUrineAlert ? 'bg-alert-red text-danger' : '']">
            <text>尿量: {{ dailyData.urineOutput || 0 }}ml</text>
            <text v-if="dailyData.isUrineAlert" class="tag-danger-pill">少尿</text>
          </view>
          <text class="sub-cell">大便: {{ dailyData.stoolOutput || 0 }}ml</text>
          <text class="sub-cell">减压/引流: {{ dailyData.drainageOutput || 0 }}ml</text>
        </view>
      </view>
    </view>

    <!-- 近 7 天趋势：让「平衡」从一个数字变成走向 -->
    <view class="trend-wrap">
      <TrendBars :data="trendData" />
    </view>

    <!-- 当日流水明细 -->
    <view class="timeline-section">
      <view class="timeline-header">
        <text class="section-title">当日出入记录流水 ({{ timelineItems.length }}条)</text>
        <button class="export-btn" size="mini" @tap="handleExportExcel">📥 导出Excel</button>
      </view>

      <view class="timeline-list">
        <view 
          :id="'rec-' + item.category + '-' + item.id"
          :class="['timeline-card', item.alertLevel === 'red' ? 'item-alert-red' : (item.alertLevel === 'yellow' ? 'item-alert-yellow' : ''), isFocusItem(item) ? 'item-focus' : '']" 
          v-for="item in timelineItems" 
          :key="item.id + item.category"
        >
          <view class="t-line-left">
            <text :class="['badge-cat', item.category.toLowerCase()]">
              {{ item.category === 'INTAKE' ? '入' : '出' }}
            </text>
          </view>
          <view class="t-line-main">
            <view class="t-line-title">
              <text class="item-name">{{ item.itemName }}</text>
              <text :class="['item-amount', item.category.toLowerCase()]">
                {{ item.category === 'INTAKE' ? '+' : '-' }}{{ item.amount }} ml
              </text>
            </view>
            <view class="t-line-sub">
              <text class="t-time">{{ formatTime(item.recordTime) }}</text>
              <text :class="['t-recorder', item.recorderRole === 'PATIENT' ? 'patient' : 'nurse']">
                ({{ item.recorderText || (item.recorderRole === 'PATIENT' ? '患者本人录入' : (item.recorderName ? item.recorderName + '录入' : '护士录入')) }})
              </text>
              <text class="t-nature" v-if="item.natureOrColor">性状: {{ item.natureOrColor }}</text>
              <text class="t-reported" v-if="item.correctionStatus === 'PENDING'" @tap.stop="handleReportedTap(item)">患者说记错了 ›</text>
            </view>
            <view class="t-remark" v-if="item.remark">备注: {{ item.remark }}</view>
          </view>
          <view class="t-line-action">
            <text class="edit-btn" @tap.stop="openEdit(item)">改</text>
            <text class="del-btn" @tap.stop="handleDelete(item)">删</text>
          </view>
        </view>

        <view class="empty-timeline" v-if="timelineItems.length === 0">
          <text>当日尚无出入量记录，请点击底部按钮录入</text>
        </view>
      </view>
    </view>

    <!-- 修正记录：先建新记录再删旧记录，避免护理数据出现空档 -->
    <view class="modal-mask" v-if="showEditModal" @tap="showEditModal = false">
      <view class="edit-modal" @tap.stop>
        <text class="em-title">修正记录量</text>
        <text class="em-sub">{{ editItem?.itemName }} · 原 {{ editItem?.amount }} ml</text>
        <input class="em-input" type="digit" v-model="editAmount" placeholder="输入正确量 (ml)" />
        <text class="em-hint">保存后将替换原记录，并在留痕中记为新记录</text>
        <view class="em-actions">
          <button class="em-btn cancel" @tap="showEditModal = false">取消</button>
          <button class="em-btn confirm" :loading="editing" @tap="submitEdit">确认修正</button>
        </view>
      </view>
    </view>

    <!-- 底部悬浮录入按钮 -->
    <view class="bottom-bar">
      <view class="readonly-tip-bar" v-if="userStore.isNurse && !userStore.isHeadNurse && !patient?.isMyDuty">
        <text>ℹ️ 当前非您管辖负责床位，仅可查阅流水，无法录入</text>
      </view>
      <view class="btn-group-row">
        <button 
          :class="['footer-btn', 'in-btn', canRecord ? '' : 'btn-disabled']" 
          @tap="handleGoRecord('intake')"
        >
          + 记入量（口服/输液/鼻饲）
        </button>
        <button 
          :class="['footer-btn', 'out-btn', canRecord ? '' : 'btn-disabled']" 
          @tap="handleGoRecord('output')"
        >
          + 记出量（尿量/大便/引流）
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user'
import { getPatientDetailApi } from '../../api/patient'
import {
  getDailyBalanceApi,
  deleteIntakeApi,
  deleteOutputApi,
  exportFluidRecordsExcel,
  getHistorySummariesApi,
  recordIntakeApi,
  recordOutputApi,
  handleCorrectionRequestApi,
  rejectCorrectionRequestApi
} from '../../api/record'
import { formatDate, formatTimeOnly, formatSinceLastRecord } from '../../utils/date'
import TrendBars from '../../components/TrendBars.vue'
import StateView from '../../components/StateView.vue'

const userStore = useUserStore()
const patientId = ref(null)
const patient = ref(null)
const currentDate = ref(formatDate())
const dailyData = ref(null)
const loadState = ref('loading')
const trendData = ref([])

// 修正记录
const showEditModal = ref(false)
const editItem = ref(null)
const editAmount = ref('')
const editing = ref(false)

const lastRecordText = computed(() => {
  if (!patient.value) return ''
  return formatSinceLastRecord(patient.value.lastRecordTime, patient.value.hoursSinceLastRecord)
})

// 从「患者说记错了」跳进来时带着的那条记录
const focusRecordId = ref(null)
const focusCategory = ref('')
const focusReason = ref('')
const focusCorrectionId = ref(null)
const focusApplied = ref(false)

const focusItem = computed(() => {
  if (!focusRecordId.value) return null
  return timelineItems.value.find(
    it => String(it.id) === String(focusRecordId.value) && it.category === focusCategory.value
  ) || null
})

function isFocusItem(item) {
  return Boolean(focusItem.value) && String(item.id) === String(focusItem.value.id) && item.category === focusItem.value.category
}

// 滚到那条记录上，让护士一眼看到要改哪条
function applyFocus() {
  if (focusApplied.value || !focusRecordId.value) return
  const target = focusItem.value
  if (!target) {
    focusApplied.value = true
    uni.showToast({ title: '这条记录已被修改或撤销', icon: 'none' })
    return
  }
  focusApplied.value = true
  nextTick(() => {
    uni.pageScrollTo({
      selector: `#rec-${target.category}-${target.id}`,
      duration: 300,
      offsetTop: -100,
      fail: () => {}
    })
  })
}

// 护士看完认为记录本身没问题：直接把这条待核对请求关掉，不用回首页再点一遍
async function confirmCorrectionOk(requestId) {
  const id = typeof requestId === 'number' ? requestId : focusCorrectionId.value
  if (!id) {
    uni.showToast({ title: '没有待处理的核对请求', icon: 'none' })
    return
  }
  try {
    await handleCorrectionRequestApi(id)
    uni.showToast({ title: '已标记确认无误', icon: 'success' })
    focusRecordId.value = null
    focusCorrectionId.value = null
    focusReason.value = ''
    loadData()
  } catch (e) {
    console.error('标记核对失败', e)
  }
}

// 不走首页弹窗、直接进详情时，点流水上的「患者说记错了」也能就地判断
function handleReportedTap(item) {
  if (!canRecord.value) {
    uni.showToast({ title: '仅管辖护士可处理', icon: 'none' })
    return
  }
  uni.showActionSheet({
    itemList: ['记录没错，标记已核对', '驳回，让患者重新记'],
    success: (res) => {
      if (res.tapIndex === 0) {
        confirmCorrectionOk(item.correctionRequestId)
      } else {
        rejectCorrection(item)
      }
    }
  })
}

// 驳回：这条从当天出入量中移除，患者重新记。护士不代改，避免「谁录的谁负责」断掉
async function rejectCorrection(item) {
  const requestId = item?.correctionRequestId || focusCorrectionId.value
  if (!requestId) {
    uni.showToast({ title: '没有待处理的核对请求', icon: 'none' })
    return
  }
  const confirmed = await new Promise((resolve) => {
    uni.showModal({
      title: '驳回这条记录？',
      content: `【${item.itemName} ${item.amount}ml】会从出入量里移除，患者需要重新记一次。\n\n驳回后不可撤回。`,
      confirmText: '驳回',
      confirmColor: '#ff4d4f',
      success: (res) => resolve(res.confirm),
      fail: () => resolve(false)
    })
  })
  if (!confirmed) return
  try {
    await rejectCorrectionRequestApi(requestId)
    uni.showToast({ title: '已驳回，等患者重记', icon: 'none' })
    focusRecordId.value = null
    focusCorrectionId.value = null
    focusReason.value = ''
    loadData()
    loadTrend()
  } catch (e) {
    console.error('驳回失败', e)
    uni.showToast({ title: '驳回失败，请重试', icon: 'none' })
  }
}

const canRecord = computed(() => {
  if (userStore.isHeadNurse || userStore.isPatient) return true
  return Boolean(patient.value?.isMyDuty)
})

function handleGoRecord(type) {
  if (!canRecord.value) {
    uni.showToast({
      title: '您当前未管辖该床位，仅支持查询流水',
      icon: 'none'
    })
    return
  }
  goToRecord(type)
}

const isToday = computed(() => {
  return currentDate.value === formatDate()
})

const timelineItems = computed(() => {
  return dailyData.value?.items || []
})

function formatTime(str) {
  return formatTimeOnly(str)
}

async function loadData() {
  if (!patientId.value) return
  if (!patient.value) {
    loadState.value = 'loading'
  }
  try {
    const p = await getPatientDetailApi(patientId.value)
    patient.value = p

    const balance = await getDailyBalanceApi(patientId.value, currentDate.value)
    dailyData.value = balance
    loadState.value = 'ready'
    applyFocus()
  } catch (e) {
    console.error(e)
    if (!patient.value) {
      loadState.value = 'error'
    }
  }
}

async function loadTrend() {
  if (!patientId.value) return
  try {
    const list = await getHistorySummariesApi(patientId.value, 7)
    trendData.value = (list || []).map(d => ({
      date: d.recordDate,
      intake: Number(d.totalIntake || 0),
      output: Number(d.totalOutput || 0)
    }))
  } catch (e) {
    console.error('加载趋势失败', e)
    trendData.value = []
  }
}

function onDatePick(e) {
  currentDate.value = e.detail.value
  loadData()
}

function changeDate(deltaDays) {
  const d = new Date(currentDate.value)
  d.setDate(d.getDate() + deltaDays)
  currentDate.value = formatDate(d)
  loadData()
}

function goToRecord(type) {
  uni.navigateTo({
    url: `/pages/record/${type}?patientId=${patientId.value}`
  })
}

function handleExportExcel() {
  if (!patientId.value) return
  uni.showActionSheet({
    itemList: [
      `导出当日记录 (${currentDate.value})`,
      '导出近7天记录',
      '导出近30天记录'
    ],
    success: (res) => {
      let start = currentDate.value
      let end = currentDate.value
      const today = new Date(currentDate.value)
      if (res.tapIndex === 1) {
        const d7 = new Date(today)
        d7.setDate(d7.getDate() - 6)
        start = formatDate(d7)
      } else if (res.tapIndex === 2) {
        const d30 = new Date(today)
        d30.setDate(d30.getDate() - 29)
        start = formatDate(d30)
      }
      exportFluidRecordsExcel({
        patientIds: [patientId.value],
        startDate: start,
        endDate: end
      })
    }
  })
}

// 删除必须选原因，便于护士长事后追溯
function handleDelete(item) {
  const reasons = ['录入错误（患者/时间不对）', '数量填错', '重复录入', '医生要求删除']
  uni.showActionSheet({
    itemList: reasons,
    success: (sheetRes) => {
      const reason = reasons[sheetRes.tapIndex]
      uni.showModal({
        title: '确认删除',
        content: `将删除【${item.itemName} ${item.amount}ml】\n删除原因：${reason}\n删除后会记录操作人与原因。`,
        confirmColor: '#ff4d4f',
        confirmText: '确认删除',
        success: async (res) => {
          if (!res.confirm) return
          try {
            if (item.category === 'INTAKE') {
              await deleteIntakeApi(item.id, reason)
            } else {
              await deleteOutputApi(item.id, reason)
            }
            uni.showToast({ title: '已删除并留痕', icon: 'none' })
            loadData()
            loadTrend()
          } catch (e) {
            console.error('删除失败', e)
          }
        }
      })
    }
  })
}

function openEdit(item) {
  if (!canRecord.value) {
    uni.showToast({ title: '仅管辖护士可修正记录', icon: 'none' })
    return
  }
  editItem.value = item
  editAmount.value = String(item.amount || '')
  showEditModal.value = true
}

function toApiTime(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').substring(0, 19)
}

async function submitEdit() {
  if (!editItem.value) return
  const amount = Number(editAmount.value)
  if (!amount || amount <= 0) {
    uni.showToast({ title: '请输入正确的量', icon: 'none' })
    return
  }
  if (amount === Number(editItem.value.amount)) {
    showEditModal.value = false
    return
  }

  editing.value = true
  const item = editItem.value
  try {
    const recordTime = toApiTime(item.recordTime)
    if (item.category === 'INTAKE') {
      await recordIntakeApi({
        patientId: patientId.value,
        intakeType: item.type,
        subType: item.subType || item.type,
        itemName: item.itemName,
        amount,
        recordTime,
        remark: item.remark || ''
      })
    } else {
      await recordOutputApi({
        patientId: patientId.value,
        outputType: item.type,
        amount,
        natureOrColor: item.natureOrColor || '',
        recordTime,
        remark: item.remark || ''
      })
    }
    // 新记录写入成功后再删旧记录，避免中途失败导致数据缺失
    if (item.category === 'INTAKE') {
      await deleteIntakeApi(item.id, '修正记录量')
    } else {
      await deleteOutputApi(item.id, '修正记录量')
    }
    uni.showToast({ title: '已修正', icon: 'success' })
    showEditModal.value = false
    loadData()
    loadTrend()
  } catch (e) {
    console.error('修正失败', e)
  } finally {
    editing.value = false
  }
}

onLoad((options) => {
  if (options.patientId) {
    patientId.value = options.patientId
  }
  // 带着患者反馈进来：定位到那条记录，日期也切到它所在的那天（可能是昨天）
  if (options.recordId) {
    focusRecordId.value = options.recordId
    focusCategory.value = options.category || 'INTAKE'
    focusReason.value = options.reason ? decodeURIComponent(options.reason) : ''
    focusCorrectionId.value = options.correctionId ? Number(options.correctionId) : null
  }
  if (options.date) {
    currentDate.value = options.date
  }
})

onShow(() => {
  loadData()
  if (trendData.value.length === 0) {
    loadTrend()
  }
})
</script>

<style>
.container {
  padding: 24rpx;
  padding-bottom: calc(200rpx + env(safe-area-inset-bottom));
}

.patient-header {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 20rpx;
}

.title-row {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.bed-tag {
  background: #1677ff;
  color: #fff;
  font-weight: bold;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-size: 26rpx;
  margin-right: 14rpx;
}

.name {
  font-size: 34rpx;
  font-weight: bold;
  color: #262626;
}

.hospital-no {
  font-size: 24rpx;
  color: #8c8c8c;
  margin-left: 12rpx;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  color: #595959;
  margin-bottom: 8rpx;
}

.code {
  font-weight: bold;
  color: #1677ff;
  letter-spacing: 2rpx;
}

.diag-text {
  font-size: 24rpx;
  color: #8c8c8c;
}

.date-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  background: #ffffff;
  border-radius: 12rpx;
  padding: 12rpx 20rpx;
}

.current-date-picker {
  display: flex;
  align-items: center;
  font-size: 28rpx;
  font-weight: bold;
  color: #1677ff;
}

.date-text {
  margin: 0 8rpx;
}

.today-tag {
  font-size: 22rpx;
  color: #52c41a;
}

.balance-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 24rpx;
}

.balance-overview {
  display: flex;
  justify-content: space-around;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 24rpx;
}

.b-label {
  font-size: 24rpx;
  color: #8c8c8c;
  display: block;
  margin-bottom: 8rpx;
}

.b-val {
  font-size: 40rpx;
  font-weight: bold;
}

.b-item.in .b-val { color: #52c41a; }
.b-item.out .b-val { color: #fa8c16; }
.b-val.pos { color: #1677ff; }
.b-val.neg { color: #eb2f96; }

.abnormal-banner {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  color: #ff4d4f;
  border-radius: 8rpx;
  padding: 12rpx 20rpx;
  margin-top: 20rpx;
  font-size: 24rpx;
  display: flex;
  align-items: center;
}

.warn-icon {
  margin-right: 8rpx;
}

.sub-breakdown {
  margin-top: 20rpx;
  font-size: 24rpx;
  color: #595959;
}

.sub-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.timeline-section {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.timeline-header {
  margin-bottom: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.export-btn {
  background: #f0f5ff;
  color: #1677ff;
  border: 1px solid #adc6ff;
  border-radius: 20rpx;
  font-size: 22rpx;
  padding: 0 16rpx;
  height: 48rpx;
  line-height: 46rpx;
  margin: 0;
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #262626;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.timeline-card {
  display: flex;
  align-items: flex-start;
  padding: 16rpx 0;
  border-bottom: 1px solid #fafafa;
}

.badge-cat {
  font-size: 22rpx;
  font-weight: bold;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-right: 16rpx;
}

.badge-cat.intake {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.badge-cat.output {
  background: #fffbe6;
  color: #fa8c16;
  border: 1px solid #ffe58f;
}

.t-line-main {
  flex: 1;
}

.t-line-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6rpx;
}

.item-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #262626;
}

.item-amount {
  font-size: 30rpx;
  font-weight: bold;
}

.item-amount.intake { color: #52c41a; }
.item-amount.output { color: #fa8c16; }

.t-line-sub {
  font-size: 22rpx;
  color: #8c8c8c;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}

.t-recorder.nurse {
  color: #1677ff;
  font-weight: 500;
  background: #e6f4ff;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
}

.t-recorder.patient {
  color: #52c41a;
  font-weight: 500;
  background: #f6ffed;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
}

.t-remark {
  font-size: 22rpx;
  color: #595959;
  margin-top: 6rpx;
}

.edit-btn {
  font-size: 26rpx;
  color: #1677ff;
  padding: 10rpx 16rpx;
}

.del-btn {
  font-size: 26rpx;
  color: #ff4d4f;
  padding: 10rpx 16rpx;
}

.pulse-line {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
  background: #f7f9fc;
  border-radius: 10rpx;
  padding: 10rpx 16rpx;
}

.pulse-line.warn {
  background: #fff7e6;
  border: 1rpx solid #ffe58f;
}

.pulse-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #52c41a;
  margin-right: 10rpx;
}

.pulse-line.warn .pulse-dot {
  background: #fa8c16;
}

.pulse-text {
  font-size: 26rpx;
  color: #595959;
}

.trend-wrap {
  margin-bottom: 20rpx;
}

.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.edit-modal {
  width: 84%;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 36rpx 32rpx;
  display: flex;
  flex-direction: column;
}

.em-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #1f2329;
  text-align: center;
}

.em-sub {
  font-size: 26rpx;
  color: #8c8c8c;
  text-align: center;
  margin: 12rpx 0 24rpx;
}

.em-input {
  height: 96rpx;
  border: 2rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 40rpx;
  font-weight: bold;
  text-align: center;
  color: #1677ff;
}

.em-hint {
  font-size: 24rpx;
  color: #bfbfbf;
  margin-top: 14rpx;
  line-height: 1.5;
}

.em-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}

.em-btn {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  font-size: 30rpx;
  border-radius: 42rpx;
  margin: 0;
}

.em-btn.cancel {
  background: #f5f7fa;
  color: #595959;
}

.em-btn.confirm {
  background: #1677ff;
  color: #ffffff;
}

.empty-timeline {
  text-align: center;
  color: #8c8c8c;
  font-size: 26rpx;
  padding: 50rpx 0;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #ffffff;
  padding: 16rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.08);
}

.readonly-tip-bar {
  text-align: center;
  font-size: 22rpx;
  color: #fa8c16;
}

.btn-group-row {
  display: flex;
  gap: 20rpx;
}

.footer-btn {
  flex: 1;
  font-size: 26rpx;
  font-weight: bold;
  border-radius: 40rpx;
}

.footer-btn.btn-disabled {
  background: #f5f5f5 !important;
  color: #bfbfbf !important;
  border: 1px solid #d9d9d9 !important;
}

.in-btn {
  background: #52c41a;
  color: #ffffff;
}

.out-btn {
  background: #fa8c16;
  color: #ffffff;
}

.header-duty-tag {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
  font-weight: normal;
}

.header-duty-tag.duty {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.header-duty-tag.readonly {
  background: #f5f5f5;
  color: #8c8c8c;
  border: 1px solid #d9d9d9;
}

/* 临床智能预警高亮样式 (红底 / 黄底) */
.bg-alert-red {
  background-color: #fef0f0 !important;
}
.bg-alert-yellow {
  background-color: #fdf6ec !important;
}
.alert-red-text {
  color: #f56c6c !important;
  font-weight: bold;
}
.text-danger {
  color: #f56c6c !important;
  font-weight: bold;
}
.text-warn {
  color: #e6a23c !important;
  font-weight: bold;
}

.badge-tag-red {
  font-size: 18rpx;
  background-color: #f56c6c;
  color: #ffffff;
  padding: 2rpx 8rpx;
  border-radius: 8rpx;
  margin-top: 4rpx;
  display: inline-block;
}

.tag-warn-pill {
  font-size: 18rpx;
  background-color: #e6a23c;
  color: #ffffff;
  padding: 2rpx 6rpx;
  border-radius: 6rpx;
  margin-left: 6rpx;
}
.tag-danger-pill {
  font-size: 18rpx;
  background-color: #f56c6c;
  color: #ffffff;
  padding: 2rpx 6rpx;
  border-radius: 6rpx;
  margin-left: 6rpx;
}

.item-alert-red {
  background-color: #fef0f0 !important;
  border-left: 6rpx solid #f56c6c !important;
}
.item-alert-yellow {
  background-color: #fdf6ec !important;
  border-left: 6rpx solid #e6a23c !important;
}

/* 患者反馈了「记错了」：这条记录要先被看见、被处理 */
.correction-focus {
  background: #fffbe6;
  border: 2rpx solid #ffd591;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
}
.cf-head {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}
.cf-tag {
  background: #fa8c16;
  color: #ffffff;
  font-size: 22rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  margin-right: 12rpx;
}
.cf-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #262626;
}
.cf-reason {
  font-size: 26rpx;
  color: #d46b08;
  display: block;
  margin-bottom: 16rpx;
}
.cf-actions {
  display: flex;
}
.cf-btn {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 12rpx;
  box-sizing: border-box;
}
.cf-btn.ghost {
  background: #ffffff;
  color: #595959;
  border: 1rpx solid #d9d9d9;
  margin-right: 16rpx;
}
.cf-btn.danger {
  background: #fff1f0;
  color: #cf1322;
  border: 1rpx solid #ffccc7;
  margin-right: 16rpx;
}
.cf-btn.primary {
  background: #1677ff;
  color: #ffffff;
}

/* 高亮被反馈的那条流水 */
.item-focus {
  background-color: #fffdf5 !important;
  box-shadow: 0 0 0 3rpx #fa8c16;
  border-radius: 12rpx;
}

.t-reported {
  font-size: 22rpx;
  color: #d46b08;
  background: #fff7e6;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  margin-left: 10rpx;
}
</style>
