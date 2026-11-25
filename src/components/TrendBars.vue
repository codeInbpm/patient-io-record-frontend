<template>
  <view class="trend-card">
    <view class="trend-head">
      <text class="trend-title">近 7 天出入量趋势</text>
      <view class="trend-legend">
        <text class="lg-dot in"></text><text class="lg-text">入量</text>
        <text class="lg-dot out"></text><text class="lg-text">出量</text>
      </view>
    </view>

    <view class="trend-body" v-if="normalized.length > 0">
      <view class="trend-col" v-for="(d, idx) in normalized" :key="d.date">
        <view class="bar-area">
          <view class="bar in" :style="{ height: barHeight(d.intake) }"></view>
          <view class="bar out" :style="{ height: barHeight(d.output) }"></view>
        </view>
        <text class="bar-val">{{ shortNum(d.intake) }}/{{ shortNum(d.output) }}</text>
        <text :class="['bar-label', idx === normalized.length - 1 ? 'today' : '']">{{ d.label }}</text>
      </view>
    </view>

    <view class="trend-empty" v-else>
      <text>暂无历史数据</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const list = computed(() => (props.data || []).slice(-7))

const maxValue = computed(() => {
  let max = 0
  list.value.forEach(d => {
    max = Math.max(max, Number(d.intake) || 0, Number(d.output) || 0)
  })
  return max || 1
})

// 柱高范围 8 ~ 140rpx，避免全 0 时看不见
function barHeight(value) {
  const v = Number(value) || 0
  if (v <= 0) return '8rpx'
  const h = Math.round((v / maxValue.value) * 120) + 16
  return h + 'rpx'
}

function shortNum(v) {
  const n = Number(v) || 0
  if (n >= 1000) return (n / 1000).toFixed(1) + 'L'
  return String(n)
}

function shortDate(dateStr) {
  if (!dateStr) return ''
  const parts = String(dateStr).split('-')
  return parts.length >= 3 ? `${Number(parts[1])}/${Number(parts[2])}` : dateStr
}

// 给每项补上短标签
const normalized = computed(() => list.value.map(d => ({ ...d, label: d.label || shortDate(d.date) })))
</script>

<style>
.trend-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
}

.trend-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.trend-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #262626;
}

.trend-legend {
  display: flex;
  align-items: center;
}

.lg-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 4rpx;
  margin-right: 6rpx;
}

.lg-dot.in { background: #52c41a; }
.lg-dot.out { background: #fa8c16; margin-left: 16rpx; }

.lg-text {
  font-size: 22rpx;
  color: #8c8c8c;
}

.trend-body {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bar-area {
  display: flex;
  align-items: flex-end;
  gap: 4rpx;
  height: 150rpx;
}

.bar {
  width: 16rpx;
  border-radius: 6rpx 6rpx 0 0;
  min-height: 8rpx;
}

.bar.in { background: #52c41a; }
.bar.out { background: #fa8c16; }

.bar-val {
  font-size: 18rpx;
  color: #bfbfbf;
  margin-top: 8rpx;
  transform: scale(0.9);
  white-space: nowrap;
}

.bar-label {
  font-size: 22rpx;
  color: #8c8c8c;
  margin-top: 2rpx;
}

.bar-label.today {
  color: #1677ff;
  font-weight: bold;
}

.trend-empty {
  padding: 40rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #bfbfbf;
}
</style>
