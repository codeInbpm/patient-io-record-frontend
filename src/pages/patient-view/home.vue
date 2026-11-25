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

      <!-- 护士驳回的记录：那条已经从今天的出入量里去掉，请患者按实际重记 -->
      <view class="rejected-card" v-if="rejectedList.length > 0">
        <view class="rc-head">
          <text class="rc-icon">↩️</text>
          <text class="rc-title">护士退回了 {{ rejectedList.length }} 条记录</text>
        </view>
        <view class="rc-item" v-for="r in rejectedList" :key="r.id">
          <view class="rc-info">
            <text class="rc-desc">
              {{ (r.recordTime || '').slice(11, 16) }}
              {{ r.category === 'INTAKE' ? '喝的' : '排的' }} {{ r.amount }}ml · {{ r.itemName }}
            </text>
            <text class="rc-sub">护士核对后认为这条不对，已经帮你去掉了，请按实际情况重记一次</text>
          </view>
          <text class="rc-btn" @tap="goReRecord(r)">重新记</text>
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
            <!-- 尿量差 4 倍、颜色可能是血尿，不能替患者猜一个默认值 -->
            <view class="quick-plus pick" @tap.stop="quickRecord('urine')">选量后记 ›</view>
          </view>
          <view class="btn-box stool" @tap="quickRecord('stool')">
            <text class="emoji">💩</text>
            <text class="b-title">排便</text>
            <text class="b-desc">几次、稀稠</text>
            <view class="quick-plus pick" @tap.stop="quickRecord('stool')">选量后记 ›</view>
          </view>
        </view>
        <text class="quick-hint">喝水和吃饭可点「+」直接记一杯/一碗；排尿排便要先选量，避免记成假数</text>
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
          <!-- 5 分钟内自己撤销；超过 5 分钟给一个「记错了」，让护士知道。
               状态由后端随流水返回，刷新后不会复原成可重复点击 -->
          <text class="undo-btn" v-if="canUndo(item)" @tap.stop="undoRecord(item)">撤销</text>
          <view class="fix-state pending" v-else-if="item.correctionStatus === 'PENDING'" @tap.stop="hintState('PENDING')">
            <text>已反馈</text>
            <text class="fs-sub">核对中</text>
          </view>
          <view class="fix-state done" v-else-if="item.correctionStatus === 'HANDLED'" @tap.stop="hintState('HANDLED')">
            <text>✓ 已核对</text>
          </view>
          <text class="fix-btn" v-else @tap.stop="reportWrong(item)">记错了</text>
        </view>
        <view class="empty-text" v-if="myItems.length === 0">
          今天还没记，点上面的按钮记一笔
        </view>
        <view class="undo-tip" v-if="myItems.length > 0">
          记错了就先点「记错了」告诉护士，护士核对后会改正；5 分钟内的可以自己撤销
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
  submitCorrectionRequestApi,
  getMyRejectedCorrectionsApi
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
// 被护士驳回、还没重记的记录
const rejectedList = ref([])

async function loadRejected() {
  if (!userStore.token || !userStore.isBound) {
    rejectedList.value = []
    return
  }
  try {
    rejectedList.value = (await getMyRejectedCorrectionsApi()) || []
  } catch (e) {
    // 拉不到不打扰患者，下次刷新再试
    console.error('加载退回记录失败', e)
    rejectedList.value = []
  }
}

// 驳回的那条已经被护士去掉了，患者要按实际重记一次
const REJECT_MODE = {
  INTAKE: 'water',
  OUTPUT: 'urine'
}

function goReRecord(item) {
  let mode = REJECT_MODE[item.category] || 'water'
  const name = item.itemName || ''
  if (item.category === 'INTAKE' && /粥|面|饭|藕粉/.test(name)) {
    mode = 'meal'
  } else if (item.category === 'OUTPUT' && /便/.test(name)) {
    mode = 'stool'
  }
  const query = [
    `mode=${mode}`,
    `rejectedId=${item.id}`,
    `amount=${item.amount || ''}`,
    `itemName=${encodeURIComponent(name)}`
  ].join('&')
  uni.navigateTo({ url: `/pages/patient-view/quick-record?${query}` })
}

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

// 状态标签也要能点：点了至少得给出一个说法，不然就是块死牌子
function hintState(state) {
  uni.showModal({
    title: state === 'PENDING' ? '护士正在核对' : '护士已核对',
    content: state === 'PENDING'
      ? '这条已经告诉护士了，护士看过会处理。\n\n如果情况有变化，当面跟护士说一声。'
      : '护士已经看过这条，认为没有问题。\n\n如果还是觉得不对，当面跟护士说一声。',
    showCancel: false,
    confirmText: '知道了'
  })
}

function reportWrong(item) {
  // 已反馈过就不再重复提交，但要告诉患者为什么点不动，不能是死按钮
  if (item.correctionStatus === 'PENDING') {
    uni.showToast({ title: '护士正在核对这条，不用再报一次', icon: 'none' })
    return
  }
  if (item.correctionStatus === 'HANDLED') {
    uni.showToast({ title: '护士已经核对过这条了', icon: 'none' })
    return
  }
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
        // 状态写回本地这一条，下次刷新由后端返回同一个 PENDING，不会又变成可点的「记错了」
        item.correctionStatus = 'PENDING'
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
    rejectedList.value = []
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
  loadRejected()
}

function goToLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}

function goToBind() {
  uni.navigateTo({ url: '/pages/auth/bind' })
}

// 首页一键记录：一天喝 6 杯水、上 4 次厕所，不该每次都走一遍表单
// 只保留无临床风险的项：一杯水/一碗粥的估值稳定，猜错也不影响判断。
// 排尿排便不再给默认量——尿 100 和 400 差 4 倍，猜一个数会让净平衡系统性偏移。
const QUICK_PRESETS = {
  water: { label: '一杯水', amount: 200 },
  meal: { label: '一碗粥', amount: 200 }
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
    } else {
      // 排尿/排便不在这里兜默认值，一律走面板先选量
      return
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

/* 护士驳回：这条数据已经不可信，患者必须看到并重记 */
.rejected-card {
  background: #fff1f0;
  border: 2rpx solid #ffccc7;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.rc-head {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.rc-icon {
  font-size: 32rpx;
  margin-right: 10rpx;
}

.rc-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #cf1322;
}

.rc-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0 4rpx;
  border-top: 1rpx solid #ffd8d6;
  margin-top: 14rpx;
}

.rc-info {
  flex: 1;
  padding-right: 16rpx;
}

.rc-desc {
  font-size: 28rpx;
  color: #262626;
  display: block;
}

.rc-sub {
  font-size: 22rpx;
  color: #a8071a;
  opacity: 0.85;
  display: block;
  margin-top: 6rpx;
  line-height: 1.4;
}

.rc-btn {
  min-width: 132rpx;
  min-height: 76rpx;
  line-height: 76rpx;
  text-align: center;
  background: #cf1322;
  color: #ffffff;
  border-radius: 38rpx;
  font-size: 26rpx;
  font-weight: bold;
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

/* 虚线 = 还要进去选一下；实线 = 点一下直接记 */
.quick-plus.pick {
  border-style: dashed;
  font-weight: normal;
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
  color: #1677ff;
  /* 灰色小字老人根本点不到，点击区必须到 88rpx */
  min-width: 104rpx;
  min-height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  padding: 0 12rpx;
  margin-left: 4rpx;
  box-sizing: border-box;
}

.undo-btn {
  font-size: 28rpx;
  color: #ff4d4f;
  min-width: 96rpx;
  min-height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  padding: 0 12rpx;
  margin-left: 4rpx;
  box-sizing: border-box;
}

/* 已反馈 / 已核对：只做状态展示，不再可点，避免重复提交 */
.fix-state {
  min-width: 104rpx;
  min-height: 88rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-left: 4rpx;
  padding: 0 10rpx;
  font-size: 22rpx;
  border-radius: 10rpx;
  box-sizing: border-box;
}

.fix-state .fs-sub {
  font-size: 20rpx;
  opacity: 0.85;
  margin-top: 2rpx;
}

.fix-state.pending {
  color: #d46b08;
  background: #fffbe6;
}

.fix-state.done {
  color: #389e0d;
  background: #f6ffed;
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
