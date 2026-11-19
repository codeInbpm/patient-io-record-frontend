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

    <!-- 当日流水明细 -->
    <view class="timeline-section">
      <view class="timeline-header">
        <text class="section-title">当日出入记录流水 ({{ timelineItems.length }}条)</text>
        <button class="export-btn" size="mini" @tap="handleExportExcel">📥 导出Excel</button>
      </view>

      <view class="timeline-list">
        <view 
          :class="['timeline-card', item.alertLevel === 'red' ? 'item-alert-red' : (item.alertLevel === 'yellow' ? 'item-alert-yellow' : '')]" 
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
            </view>
            <view class="t-remark" v-if="item.remark">备注: {{ item.remark }}</view>
          </view>
          <view class="t-line-action">
            <text class="del-btn" @tap="handleDelete(item)">删除</text>
          </view>
        </view>

        <view class="empty-timeline" v-if="timelineItems.length === 0">
          <text>当日尚无出入量记录，请点击底部按钮录入</text>
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
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user'
import { getPatientDetailApi } from '../../api/patient'
import { getDailyBalanceApi, deleteIntakeApi, deleteOutputApi, exportFluidRecordsExcel } from '../../api/record'
import { formatDate, formatTimeOnly } from '../../utils/date'

const userStore = useUserStore()
const patientId = ref(null)
const patient = ref(null)
const currentDate = ref(formatDate())
const dailyData = ref(null)

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
  try {
    const p = await getPatientDetailApi(patientId.value)
    patient.value = p

    const balance = await getDailyBalanceApi(patientId.value, currentDate.value)
    dailyData.value = balance
  } catch (e) {
    console.error(e)
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

function handleDelete(item) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除该条【${item.itemName} ${item.amount}ml】的记录吗？`,
    success: async (res) => {
      if (res.confirm) {
        if (item.category === 'INTAKE') {
          await deleteIntakeApi(item.id)
        } else {
          await deleteOutputApi(item.id)
        }
        uni.showToast({ title: '删除成功', icon: 'success' })
        loadData()
      }
    }
  })
}

onLoad((options) => {
  if (options.patientId) {
    patientId.value = options.patientId
  }
})

onShow(() => {
  loadData()
})
</script>

<style>
.container {
  padding: 24rpx;
  padding-bottom: 160rpx;
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

.del-btn {
  font-size: 22rpx;
  color: #ff4d4f;
  padding: 8rpx 12rpx;
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
  padding: 16rpx 30rpx 24rpx;
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
</style>
