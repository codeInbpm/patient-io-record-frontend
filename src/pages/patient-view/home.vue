<template>
  <view class="container">
    <!-- 未登录提示卡片 -->
    <view class="unbind-card" v-if="!userStore.token">
      <view class="icon-wrap">🔒</view>
      <text class="unbind-title">您尚未登录微信账号</text>
      <text class="unbind-desc">登录后就能看到自己每天喝了多少、排了多少，随时补记。</text>
      <button class="bind-nav-btn" type="primary" @tap="goToLogin">前往微信登录</button>
    </view>

    <!-- 未绑定状态提示 -->
    <view class="unbind-card" v-else-if="!userStore.isBound || !patient">
      <view class="icon-wrap">🏥</view>
      <text class="unbind-title">您尚未绑定住院病床</text>
      <text class="unbind-desc">填一下住院时的姓名和床位号，核对无误就能开始记录。</text>
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
          <text class="h-title">今天喝了多少、排了多少</text>
        </view>
        <view class="io-three-col">
          <view class="col-item in">
            <text class="val">{{ todayBalance.totalIntake || 0 }}</text>
            <text class="lbl">喝了(ml)</text>
          </view>
          <view class="col-item out">
            <text class="val">{{ todayBalance.totalOutput || 0 }}</text>
            <text class="lbl">排了(ml)</text>
          </view>
          <view class="col-item net">
            <text :class="['val', (todayBalance.netBalance || 0) >= 0 ? 'pos' : 'neg']">
              {{ (todayBalance.netBalance || 0) > 0 ? '+' : '' }}{{ todayBalance.netBalance || 0 }}
            </text>
            <text class="lbl">差(ml)</text>
          </view>
        </view>
        <!-- 正负数对家属是黑话，用一句话讲清楚 -->
        <view class="net-explain">
          <text v-if="(todayBalance.netBalance || 0) > 0">
            今天喝进去的比排出来的多 {{ todayBalance.netBalance }}ml（相当于多留了约 {{ Math.round(todayBalance.netBalance / 200) }} 杯水）
          </text>
          <text v-else-if="(todayBalance.netBalance || 0) < 0">
            今天排出来的比喝进去的多 {{ Math.abs(todayBalance.netBalance) }}ml，记得提醒多喝水
          </text>
          <text v-else>今天喝的和排的刚好一样多</text>
        </view>
      </view>

      <!-- 极简一键快捷填报入口 -->
      <view class="quick-submit-section">
        <text class="sec-title">记一笔</text>
        <view class="btn-grid">
          <view class="btn-box water" @tap="quickRecord('water')">
            <text class="emoji">🥛</text>
            <text class="b-title">喝水</text>
            <text class="b-desc">水、汤、奶</text>
            <view class="quick-plus" @tap.stop="quickSave('water')">
              {{ quickSaving === 'water' ? '正在记…' : '+ 一杯 (200ml)' }}
            </view>
          </view>
          <view class="btn-box meal" @tap="quickRecord('meal')">
            <text class="emoji">🍚</text>
            <text class="b-title">吃饭</text>
            <text class="b-desc">粥、面、饭</text>
            <view class="quick-plus" @tap.stop="quickSave('meal')">
              {{ quickSaving === 'meal' ? '正在记…' : '+ 一碗 (200ml)' }}
            </view>
          </view>
          <view class="btn-box urine" @tap="quickRecord('urine')">
            <text class="emoji">🚽</text>
            <text class="b-title">排尿</text>
            <text class="b-desc">尿量、颜色</text>
            <view class="quick-plus" @tap.stop="quickSave('urine')">
              {{ quickSaving === 'urine' ? '正在记…' : '+ 一次 (200ml)' }}
            </view>
          </view>
          <view class="btn-box stool" @tap="quickRecord('stool')">
            <text class="emoji">💩</text>
            <text class="b-title">排便</text>
            <text class="b-desc">几次、稀稠</text>
            <view class="quick-plus" @tap.stop="quickSave('stool')">
              {{ quickSaving === 'stool' ? '正在记…' : '+ 一次 (中量)' }}
            </view>
          </view>
        </view>
        <text class="quick-hint">点「+」直接记默认量，记错了在下面记录里点撤销</text>
      </view>

      <!-- 我今天填报的流水记录 -->
      <view class="my-timeline">
        <text class="sec-title">今天的记录 (共 {{ myItems.length }} 笔)</text>
        <view class="record-item" v-for="item in myItems" :key="item.id + item.category">
          <text :class="['r-type', item.category === 'INTAKE' ? 'in' : 'out']">
            {{ item.category === 'INTAKE' ? '喝的' : '排的' }}
          </text>
          <view class="r-info">
            <text class="r-name">{{ item.itemName }}</text>
            <text class="r-time">{{ item.recordTime ? item.recordTime.substring(11, 16) : '' }} • {{ (item.recorderRole === 'PATIENT' || item.recorderText === '本人录入' || item.recorderName === '本人') ? '本人录入' : '护士录入' }}</text>
          </view>
          <text :class="['r-amt', item.category === 'INTAKE' ? 'in' : 'out']">
            {{ item.category === 'INTAKE' ? '+' : '-' }}{{ item.amount }} ml
          </text>
          <!-- 5 分钟内自己撤销；超过 5 分钟给一个「记错了」，让护士知道 -->
          <text class="undo-btn" v-if="canUndo(item)" @tap.stop="undoRecord(item)">撤销</text>
          <text class="fix-btn" v-else-if="item.reported" @tap.stop="noop">已反馈</text>
          <text class="fix-btn" v-else @tap.stop="reportWrong(item)">记错了</text>
        </view>
        <view class="empty-text" v-if="myItems.length === 0">
          今天还没记，点上面的按钮记一笔
        </view>
        <view class="undo-tip" v-if="myItems.length > 0">
          填错可在 5 分钟内点「撤销」，超过 5 分钟请联系护士
        </view>
      </view>

      <!-- 近 7 天趋势：让家属看到整体走向 -->
      <view class="week-card">
        <text class="sec-title">近 7 天记录</text>
        <view class="week-row" v-for="d in weekList" :key="d.date">
          <text class="wk-date">{{ d.label }}</text>
          <text class="wk-val in">喝 {{ d.intake }}</text>
          <text class="wk-val out">排 {{ d.output }}</text>
          <text :class="['wk-net', d.balance >= 0 ? 'pos' : 'neg']">
            {{ d.balance > 0 ? '+' : '' }}{{ d.balance }}
          </text>
        </view>
        <view class="empty-text" v-if="weekList.length === 0">暂无历史记录</view>
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
import {
  getDailyBalanceApi,
  getHistorySummariesApi,
  deleteIntakeApi,
  deleteOutputApi,
  recordIntakeApi,
  recordOutputApi,
  submitCorrectionRequestApi
} from '../../api/record'
import { formatDate, formatTimeOnly } from '../../utils/date'
import { syncRoleTabBar } from '../../utils/tabbar'
import CustomTabBar from '../../components/CustomTabBar.vue'

const userStore = useUserStore()
const patient = ref(null)
const todayBalance = ref(null)
const todayStr = ref(formatDate())

const myItems = computed(() => {
  return todayBalance.value?.items || []
})

const weekList = ref([])

function parseRecordTime(value) {
  if (!value) return null
  const m = String(value).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0))
}

// 只允许撤销「本人填写 + 5 分钟内」的记录
function canUndo(item) {
  const isMine = item.recorderRole === 'PATIENT' || item.recorderText === '本人录入' || item.recorderName === '本人'
  if (!isMine) return false
  const t = parseRecordTime(item.recordTime)
  if (!t) return false
  return Date.now() - t.getTime() <= 5 * 60 * 1000
}

function undoRecord(item) {
  uni.showModal({
    title: '撤销这条记录？',
    content: `将删除【${item.itemName} ${item.amount}ml】，撤销后不可恢复。`,
    confirmText: '撤销',
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (!res.confirm) return
      try {
        if (item.category === 'INTAKE') {
          await deleteIntakeApi(item.id, '患者本人 5 分钟内撤销')
        } else {
          await deleteOutputApi(item.id, '患者本人 5 分钟内撤销')
        }
        uni.showToast({ title: '已撤销', icon: 'success' })
        checkPatient()
        loadWeek()
      } catch (e) {
        console.error('撤销失败', e)
      }
    }
  })
}

// 患者不能自己改历史记录（一改数据就不可信了），但必须有个说话的地方
const FIX_REASONS = [
  '记错人了（不是这张床）',
  '数量记错了',
  '时间记错了',
  '重复记了一次'
]

function noop() {}

function reportWrong(item) {
  if (item.reported) return
  uni.showActionSheet({
    itemList: FIX_REASONS,
    success: async (sheetRes) => {
      const reason = FIX_REASONS[sheetRes.tapIndex]
      try {
        uni.showLoading({ title: '正在告诉护士…', mask: true })
        await submitCorrectionRequestApi({
          recordId: item.id,
          category: item.category,
          reason
        })
        uni.hideLoading()
        item.reported = true
        uni.showModal({
          title: '已告诉护士',
          content: `护士看到后会核对这条记录。\n\n反馈内容：${reason}`,
          showCancel: false,
          confirmText: '知道了'
        })
      } catch (e) {
        uni.hideLoading()
        console.error('提交反馈失败', e)
      }
    }
  })
}

async function loadWeek() {
  if (!patient.value) return
  try {
    const list = await getHistorySummariesApi(patient.value.id, 7)
    weekList.value = (list || []).map(d => {
      const parts = String(d.recordDate || '').split('-')
      return {
        date: d.recordDate,
        label: parts.length >= 3 ? `${Number(parts[1])}/${Number(parts[2])}` : d.recordDate,
        intake: Number(d.totalIntake || 0),
        output: Number(d.totalOutput || 0),
        balance: Number(d.netBalance || 0)
      }
    })
  } catch (e) {
    console.error('加载 7 天记录失败', e)
    weekList.value = []
  }
}

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
      loadWeek()
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

// 首页一键记录：一天喝 6 杯水、上 4 次厕所，不该每次都走一遍表单
const QUICK_PRESETS = {
  water: { label: '一杯水', amount: 200 },
  meal: { label: '一碗粥', amount: 200 },
  urine: { label: '排尿一次', amount: 200 },
  stool: { label: '排便一次', amount: 100 }
}

const quickSaving = ref('')

async function quickSave(type) {
  if (!patient.value || quickSaving.value) return
  const preset = QUICK_PRESETS[type]
  if (!preset) return

  const now = new Date()
  const recordTime = `${formatDate(now)} ${formatTimeOnly(now)}:00`
  quickSaving.value = type
  try {
    if (type === 'water') {
      await recordIntakeApi({
        patientId: patient.value.id,
        intakeType: 'ORAL',
        subType: 'WATER',
        itemName: '白开水',
        amount: preset.amount,
        recordTime,
        remark: '一杯（患者快捷记录）'
      })
    } else if (type === 'meal') {
      await recordIntakeApi({
        patientId: patient.value.id,
        intakeType: 'ORAL',
        subType: 'CONGEE',
        itemName: '粥',
        amount: preset.amount,
        recordTime,
        remark: '一碗（患者快捷记录）'
      })
    } else if (type === 'urine') {
      await recordOutputApi({
        patientId: patient.value.id,
        outputType: 'URINE',
        amount: preset.amount,
        natureOrColor: '淡黄清亮',
        recordTime,
        remark: '一次（患者快捷记录）'
      })
    } else {
      await recordOutputApi({
        patientId: patient.value.id,
        outputType: 'STOOL',
        amount: preset.amount,
        natureOrColor: '黄色软便',
        recordTime,
        remark: '1次 · 中量（患者快捷记录）'
      })
    }
    uni.showToast({ title: `记好了：${preset.label}`, icon: 'none' })
    await checkPatient()
  } catch (e) {
    console.error('快捷记录失败', e)
  } finally {
    quickSaving.value = ''
  }
}

function quickRecord(type) {
  if (!patient.value) return
  // 点哪个入口就直接进对应面板，不再进去再选一次
  uni.navigateTo({
    url: `/pages/patient-view/quick-record?mode=${type}`
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

.net-explain {
  margin-top: 18rpx;
  background: #f7f9fc;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  color: #595959;
  line-height: 1.5;
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
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
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

.quick-plus {
  margin-top: 16rpx;
  border-radius: 34rpx;
  padding: 14rpx 0;
  font-size: 28rpx;
  font-weight: bold;
  text-align: center;
  border: 1rpx solid transparent;
}

.btn-box.water .quick-plus {
  color: #1677ff;
  background: #f0f7ff;
  border-color: #91caff;
}

.btn-box.meal .quick-plus {
  color: #d46b08;
  background: #fffbe6;
  border-color: #ffd591;
}

.btn-box.urine .quick-plus {
  color: #08979c;
  background: #e6fffb;
  border-color: #87e8de;
}

.btn-box.stool .quick-plus {
  color: #722ed1;
  background: #f9f0ff;
  border-color: #d3adf7;
}

.quick-hint {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #8c8c8c;
  text-align: center;
}

.btn-box.water { border-top: 6rpx solid #1677ff; }
.btn-box.meal { border-top: 6rpx solid #fa8c16; }
.btn-box.urine { border-top: 6rpx solid #13c2c2; }
.btn-box.stool { border-top: 6rpx solid #722ed1; }

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

.fix-btn {
  font-size: 26rpx;
  color: #bfbfbf;
  padding: 8rpx 14rpx;
  margin-left: 8rpx;
}

.undo-btn {
  font-size: 26rpx;
  color: #ff4d4f;
  padding: 8rpx 14rpx;
  margin-left: 8rpx;
}

.undo-tip {
  font-size: 24rpx;
  color: #bfbfbf;
  padding: 14rpx 0 0;
  text-align: center;
}

.week-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-top: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.week-row {
  display: flex;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f2f4f7;
}

.week-row:last-child {
  border-bottom: none;
}

.wk-date {
  width: 110rpx;
  font-size: 28rpx;
  color: #595959;
}

.wk-val {
  flex: 1;
  font-size: 28rpx;
}

.wk-val.in { color: #389e0d; }
.wk-val.out { color: #d46b08; }

.wk-net {
  font-size: 30rpx;
  font-weight: bold;
}

.wk-net.pos { color: #1677ff; }
.wk-net.neg { color: #eb2f96; }

.empty-text {
  text-align: center;
  font-size: 24rpx;
  color: #8c8c8c;
  padding: 40rpx 0;
}
</style>
