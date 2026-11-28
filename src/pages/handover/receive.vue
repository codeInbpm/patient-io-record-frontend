<template>
  <view class="page">
    <!-- ===================== 列表态：选择待接班的班次 ===================== -->
    <block v-if="!current">
      <view class="page-head">
        <view class="head-title">接班确认</view>
        <view class="head-sub">核对交班内容并手写签名，签完即完成本班交接</view>
      </view>

      <StateView
        v-if="loading || errorMsg || pending.length === 0"
        :state="loading ? 'loading' : errorMsg ? 'error' : 'empty'"
        :title="errorMsg ? '加载失败' : '暂无待接班的交班'"
        :desc="errorMsg || '仅显示近 7 天已提交或已确认的交班记录'"
        icon="🖊️"
        @retry="loadPending"
      />

      <view v-else class="list">
        <view
          v-for="item in pending"
          :key="item.id"
          class="p-card"
          :class="{ done: item.status === 'CONFIRMED' }"
          @tap="openDetail(item.id)"
        >
          <view class="p-top">
            <text class="p-title">{{ item.shiftDate }} · {{ item.shiftTypeLabel }}</text>
            <text class="p-badge" :class="item.status === 'SUBMITTED' ? 'todo' : 'done'">
              {{ item.status === 'SUBMITTED' ? '待签名' : '已确认' }}
            </text>
          </view>
          <text class="p-sub">{{ item.wardName || '病区' }}（在院 {{ item.patientCount || 0 }} 人）</text>
          <text class="p-sub">
            {{ item.submitByName || '—' }} 提交于 {{ fmtTime(item.submitTime) }}
          </text>
          <view class="p-foot" v-if="item.status === 'CONFIRMED'">
            <text class="p-signed">✓ {{ item.receiverName || '接班护士' }} {{ fmtTime(item.receiveTime) }} 已签名接班</text>
          </view>
          <view class="p-foot" v-else>
            <text class="p-todo">点击核对并签名 ›</text>
          </view>
        </view>
      </view>
    </block>

    <!-- ===================== 详情态：核对 + 签名 ===================== -->
    <block v-else>
      <!-- 班次摘要 -->
      <view class="summary-card">
        <view class="s-row">
          <view>
            <text class="s-title">{{ current.shiftDate }} · {{ current.shiftTypeLabel }}</text>
            <text class="s-ward">{{ current.wardName || '病区' }}</text>
          </view>
          <text class="s-status" :class="current.status === 'CONFIRMED' ? 'ok' : 'wait'">
            {{ current.statusLabel }}
          </text>
        </view>
        <view class="s-meta">
          <text>交班人 {{ current.submitByName || '—' }}</text>
          <text>提交时间 {{ fmtTime(current.submitTime) }}</text>
        </view>

        <view class="s-stats" v-if="statItems.length">
          <view class="stat" v-for="s in statItems" :key="s.label">
            <text class="stat-num">{{ s.value }}</text>
            <text class="stat-label">{{ s.label }}</text>
          </view>
        </view>
      </view>

      <!-- 叮嘱 -->
      <view class="card memo-card" v-if="current.memo">
        <view class="card-title">
          <text class="dot amber"></text>
          <text>护士长叮嘱</text>
        </view>
        <text class="pre-text memo-text">{{ current.memo }}</text>
      </view>

      <!-- 交班报告 -->
      <view class="card" v-if="current.reportText">
        <view class="card-title">
          <text class="dot blue"></text>
          <text>交班报告</text>
        </view>
        <text class="pre-text">{{ current.reportText }}</text>
      </view>

      <!-- 已确认：展示签名留痕 -->
      <view class="card" v-if="current.status === 'CONFIRMED'">
        <view class="card-title">
          <text class="dot green"></text>
          <text>接班留痕</text>
        </view>
        <view class="signed-row">
          <text class="signed-label">接班护士</text>
          <text class="signed-value">{{ current.receiverName || '—' }}</text>
        </view>
        <view class="signed-row">
          <text class="signed-label">确认时间</text>
          <text class="signed-value">{{ fmtTime(current.receiveTime) }}</text>
        </view>
        <view class="sign-img-wrap" v-if="current.signatureUrl" @tap="previewSignature">
          <image class="sign-img" :src="current.signatureUrl" mode="aspectFit" />
          <text class="sign-img-tip">电子签名 · 点击查看大图</text>
        </view>
        <view class="sign-missing" v-else>该记录由旧版本确认，未采集电子签名</view>
      </view>

      <!-- 待签名：画板 -->
      <view class="card" v-else>
        <view class="card-title">
          <text class="dot blue"></text>
          <text>接班护士签名</text>
        </view>
        <text class="hint">请先核对上方叮嘱与交班报告，确认无误后在框内手写签名。</text>

        <view class="sign-board">
          <canvas
            class="sign-canvas"
            canvas-id="signPad"
            id="signPad"
            disable-scroll="true"
            @touchstart="onSignStart"
            @touchmove="onSignMove"
            @touchend="onSignEnd"
            @touchcancel="onSignEnd"
          ></canvas>
          <view class="sign-placeholder" v-if="!hasInk">请在此处手写签名</view>
          <view class="sign-clear" v-if="hasInk" @tap.stop="clearSign">重签</view>
        </view>

        <view class="receiver-row">
          <text class="receiver-label">接班护士</text>
          <input
            class="receiver-input"
            v-model="receiverName"
            placeholder="请填写姓名"
            maxlength="20"
            confirm-type="done"
          />
        </view>

        <view class="agree-row" @tap="agreed = !agreed">
          <view class="checkbox" :class="{ on: agreed }">
            <text v-if="agreed">✓</text>
          </view>
          <text class="agree-text">我已逐项核对交班内容，确认接班并承担本班护理责任</text>
        </view>

        <button class="submit-btn" :disabled="submitting" @tap="submitReceive">
          {{ submitting ? '提交中…' : '确认接班' }}
        </button>
        <text class="submit-tip">签名将随交班记录一并归档，确认后不可撤销</text>
      </view>

      <view class="back-row" v-if="pending.length > 0">
        <text class="back-link" @tap="closeDetail">‹ 返回待接班列表</text>
      </view>
    </block>
  </view>
</template>

<script setup>
import { ref, computed, getCurrentInstance, nextTick } from 'vue'
import { onLoad, onReady } from '@dcloudio/uni-app'
import StateView from '../../components/StateView.vue'
import { useUserStore } from '../../stores/user'
import {
  getShiftHandoverPendingApi,
  getShiftHandoverDetailApi,
  receiveShiftHandoverApi,
  uploadSignatureApi
} from '../../api/handover'

const userStore = useUserStore()
const instance = getCurrentInstance()

const loading = ref(true)
const errorMsg = ref('')
const pending = ref([])
const current = ref(null)

const receiverName = ref('')
const agreed = ref(false)
const submitting = ref(false)

/* ---------------- 画板 ---------------- */
let ctx = null
let canvasSize = { width: 0, height: 0, left: 0, top: 0 }
let lastPoint = null
let drawing = false
const hasInk = ref(false)
const canvasInited = ref(false)

function initCanvas() {
  const query = uni.createSelectorQuery().in(instance.proxy)
  query
    .select('#signPad')
    .boundingClientRect((rect) => {
      if (!rect || !rect.width) return
      canvasSize = { width: rect.width, height: rect.height, left: rect.left, top: rect.top }
      ctx = uni.createCanvasContext('signPad', instance.proxy)
      ctx.setStrokeStyle('#111827')
      ctx.setLineWidth(3.5)
      ctx.setLineCap('round')
      ctx.setLineJoin('round')
      canvasInited.value = true
    })
    .exec()
}

function pointOf(e) {
  const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
  if (!touch) return null
  // 小程序端直接给相对画布的 x/y；H5 端要用 clientX 减去画布左上角
  const x = touch.x !== undefined ? touch.x : touch.clientX - canvasSize.left
  const y = touch.y !== undefined ? touch.y : touch.clientY - canvasSize.top
  return { x, y }
}

function onSignStart(e) {
  if (!ctx) initCanvas()
  const p = pointOf(e)
  if (!p || !ctx) return
  drawing = true
  lastPoint = p
  hasInk.value = true
  // 轻点也要留下笔迹，否则「点一下」会被判成没签
  ctx.beginPath()
  ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.draw(true)
}

function onSignMove(e) {
  if (!drawing || !ctx) return
  const p = pointOf(e)
  if (!p) return
  if (!lastPoint) {
    lastPoint = p
    return
  }
  ctx.beginPath()
  ctx.moveTo(lastPoint.x, lastPoint.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  ctx.draw(true)
  lastPoint = p
}

function onSignEnd() {
  drawing = false
  lastPoint = null
}

function clearSign() {
  if (!ctx) return
  ctx.clearRect(0, 0, canvasSize.width || 9999, canvasSize.height || 9999)
  ctx.draw()
  hasInk.value = false
  lastPoint = null
}

function exportSignature() {
  // 画布是普通 canvas，导出尺寸按实际测量值给，避免不同机型导出被拉伸或裁切
  const w = Math.max(1, Math.round(canvasSize.width || 300))
  const h = Math.max(1, Math.round(canvasSize.height || 150))
  return new Promise((resolve, reject) => {
    uni.canvasToTempFilePath(
      {
        canvasId: 'signPad',
        fileType: 'png',
        width: w,
        height: h,
        destWidth: w * 2,
        destHeight: h * 2,
        success: (res) => resolve(res.tempFilePath),
        fail: () => reject(new Error('签名生成失败，请重签后再试'))
      },
      instance.proxy
    )
  })
}

/* ---------------- 数据 ---------------- */
const fmtTime = (s) => (s ? String(s).replace('T', ' ').slice(0, 16) : '—')

const statItems = computed(() => {
  const s = current.value && current.value.stats
  if (!s) return []
  return [
    { label: '在院', value: s.patientCount != null ? s.patientCount : current.value.patientCount || 0 },
    { label: '待处理反馈', value: s.pendingFeedback || 0 },
    { label: '失衡异常', value: s.abnormalBalance || 0 },
    { label: '在滴补液', value: s.infusing || 0 }
  ]
})

async function loadPending() {
  loading.value = true
  errorMsg.value = ''
  try {
    const wardId = userStore.userInfo?.wardId || uni.getStorageSync('selected_ward_id') || ''
    const res = await getShiftHandoverPendingApi(wardId)
    pending.value = (res && res.items) || []
  } catch (e) {
    errorMsg.value = e?.message || '网络不稳定，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function openDetail(id) {
  uni.showLoading({ title: '加载中', mask: true })
  try {
    const data = await getShiftHandoverDetailApi(id)
    current.value = data
    if (!receiverName.value) {
      receiverName.value = userStore.userInfo?.realName || ''
    }
    hasInk.value = false
    agreed.value = false
    await nextTick()
    // 画布是原生组件，要等渲染完成后再取尺寸
    setTimeout(initCanvas, 80)
  } catch (e) {
    uni.showToast({ title: e?.message || '交班详情加载失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

function closeDetail() {
  current.value = null
  hasInk.value = false
  agreed.value = false
  ctx = null
  canvasInited.value = false
  loadPending()
}

function previewSignature() {
  if (!current.value?.signatureUrl) return
  uni.previewImage({ urls: [current.value.signatureUrl], current: current.value.signatureUrl })
}

function toast(title) {
  uni.showToast({ title, icon: 'none' })
}

async function submitReceive() {
  if (submitting.value) return
  if (!agreed.value) return toast('请先勾选「已核对交班内容」')
  if (!hasInk.value) return toast('请先在框内手写签名')
  if (!receiverName.value.trim()) return toast('请填写接班护士姓名')

  submitting.value = true
  uni.showLoading({ title: '提交中', mask: true })
  try {
    const tempPath = await exportSignature()
    const signatureUrl = await uploadSignatureApi(tempPath)
    const data = await receiveShiftHandoverApi(current.value.id, {
      receiverName: receiverName.value.trim(),
      signatureUrl
    })
    current.value = data
    uni.hideLoading()
    uni.showToast({ title: '接班确认完成', icon: 'success' })
    loadPending()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e?.message || '确认失败，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

onLoad((options) => {
  receiverName.value = userStore.userInfo?.realName || ''
  const id = Number(options?.id || 0)
  loadPending().then(() => {
    if (id) {
      openDetail(id)
      return
    }
    // 只有一个待签名的班次时直接进入签名页，少一次点击
    const todos = pending.value.filter((i) => i.status === 'SUBMITTED')
    if (todos.length === 1) {
      openDetail(todos[0].id)
    }
  })
})

onReady(() => {
  if (current.value && current.value.status === 'SUBMITTED') {
    initCanvas()
  }
})
</script>

<style>
.page {
  min-height: 100vh;
  background: #f4f6fa;
  padding: 24rpx 24rpx calc(40rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

/* ---------- 列表 ---------- */
.page-head {
  padding: 8rpx 8rpx 24rpx;
}
.head-title {
  font-size: 38rpx;
  font-weight: 700;
  color: #111827;
}
.head-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.6;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.p-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 6rpx 20rpx rgba(15, 23, 42, 0.06);
  border-left: 8rpx solid #1677ff;
}
.p-card.done {
  border-left-color: #d1d5db;
}
.p-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.p-title {
  font-size: 31rpx;
  font-weight: 700;
  color: #111827;
}
.p-badge {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
}
.p-badge.todo {
  background: #fff1f0;
  color: #cf1322;
}
.p-badge.done {
  background: #f0f5ff;
  color: #1d39c4;
}
.p-sub {
  display: block;
  margin-top: 10rpx;
  font-size: 25rpx;
  color: #6b7280;
}
.p-foot {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f1f5f9;
}
.p-todo {
  font-size: 25rpx;
  color: #1677ff;
  font-weight: 600;
}
.p-signed {
  font-size: 24rpx;
  color: #15803d;
}

/* ---------- 摘要卡 ---------- */
.summary-card {
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  border-radius: 22rpx;
  padding: 30rpx;
  color: #ffffff;
  box-shadow: 0 10rpx 26rpx rgba(22, 119, 255, 0.25);
}
.s-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.s-title {
  font-size: 34rpx;
  font-weight: 700;
}
.s-ward {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.82);
}
.s-status {
  font-size: 23rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}
.s-status.ok {
  background: #ffffff;
  color: #15803d;
  font-weight: 600;
}
.s-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx 28rpx;
  margin-top: 20rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.9);
}
.s-stats {
  display: flex;
  margin-top: 24rpx;
  padding-top: 22rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.25);
}
.stat {
  flex: 1;
  text-align: center;
}
.stat-num {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
}
.stat-label {
  display: block;
  margin-top: 4rpx;
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.8);
}

/* ---------- 内容卡 ---------- */
.card {
  margin-top: 20rpx;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 6rpx 20rpx rgba(15, 23, 42, 0.05);
}
.card-title {
  display: flex;
  align-items: center;
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 16rpx;
}
.dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  margin-right: 12rpx;
}
.dot.amber {
  background: #fa8c16;
}
.dot.blue {
  background: #1677ff;
}
.dot.green {
  background: #16a34a;
}
.pre-text {
  font-size: 27rpx;
  line-height: 1.75;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-all;
}
.memo-card {
  border-left: 8rpx solid #fa8c16;
}
.memo-text {
  color: #7c2d12;
}

/* ---------- 签名 ---------- */
.hint {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 18rpx;
}
.sign-board {
  position: relative;
  height: 380rpx;
  border-radius: 16rpx;
  border: 2rpx dashed #cbd5e1;
  background: #fbfdff;
  overflow: hidden;
}
.sign-canvas {
  width: 100%;
  height: 380rpx;
}
.sign-placeholder {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  text-align: center;
  font-size: 26rpx;
  color: #cbd5e1;
  pointer-events: none;
}
.sign-clear {
  position: absolute;
  right: 16rpx;
  top: 14rpx;
  padding: 6rpx 18rpx;
  font-size: 23rpx;
  color: #1677ff;
  background: #e6f4ff;
  border-radius: 24rpx;
}
.receiver-row {
  display: flex;
  align-items: center;
  margin-top: 24rpx;
  padding: 18rpx 20rpx;
  background: #f8fafc;
  border-radius: 14rpx;
}
.receiver-label {
  font-size: 26rpx;
  color: #4b5563;
  margin-right: 20rpx;
}
.receiver-input {
  flex: 1;
  font-size: 28rpx;
  color: #111827;
  text-align: right;
}
.agree-row {
  display: flex;
  align-items: flex-start;
  margin-top: 24rpx;
}
.checkbox {
  width: 36rpx;
  height: 36rpx;
  border-radius: 8rpx;
  border: 2rpx solid #cbd5e1;
  margin-right: 14rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 24rpx;
}
.checkbox.on {
  background: #1677ff;
  border-color: #1677ff;
}
.agree-text {
  font-size: 24rpx;
  color: #4b5563;
  line-height: 1.6;
}
.submit-btn {
  margin-top: 30rpx;
  background: #1677ff;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 44rpx;
  height: 88rpx;
  line-height: 88rpx;
}
.submit-btn[disabled] {
  background: #93c5fd;
  color: #ffffff;
}
.submit-tip {
  display: block;
  margin-top: 16rpx;
  text-align: center;
  font-size: 22rpx;
  color: #9ca3af;
}

/* ---------- 已签名 ---------- */
.signed-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  font-size: 26rpx;
}
.signed-label {
  color: #6b7280;
}
.signed-value {
  color: #111827;
  font-weight: 600;
}
.sign-img-wrap {
  margin-top: 16rpx;
  padding: 16rpx;
  background: #f8fafc;
  border-radius: 14rpx;
}
.sign-img {
  width: 100%;
  height: 240rpx;
  background: #ffffff;
  border-radius: 8rpx;
}
.sign-img-tip {
  display: block;
  margin-top: 10rpx;
  text-align: center;
  font-size: 22rpx;
  color: #9ca3af;
}
.sign-missing {
  margin-top: 16rpx;
  padding: 20rpx;
  background: #fffbe6;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #ad6800;
}

.back-row {
  margin-top: 28rpx;
  text-align: center;
}
.back-link {
  font-size: 26rpx;
  color: #1677ff;
}
</style>
