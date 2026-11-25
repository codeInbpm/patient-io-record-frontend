<template>
  <view class="patient-header">
    <view class="ph-main">
      <view class="ph-bed" v-if="bedNo">{{ bedNo }}</view>
      <view class="ph-identity">
        <text class="ph-name">{{ patientName || '未获取到患者' }}</text>
        <text class="ph-no" v-if="hospitalNo">住院号 {{ hospitalNo }}</text>
      </view>
      <view class="ph-switch" @tap="$emit('switch')">
        <text>换人</text>
      </view>
    </view>

    <view class="ph-stats" v-if="showStats">
      <view class="ph-stat">
        <text class="ph-stat-label">今日入</text>
        <text class="ph-stat-val in">{{ intake || 0 }}</text>
      </view>
      <view class="ph-stat">
        <text class="ph-stat-label">今日出</text>
        <text class="ph-stat-val out">{{ output || 0 }}</text>
      </view>
      <view class="ph-stat">
        <text class="ph-stat-label">净平衡</text>
        <text :class="['ph-stat-val', (balance || 0) >= 0 ? 'pos' : 'neg']">
          {{ (balance || 0) > 0 ? '+' : '' }}{{ balance || 0 }}
        </text>
      </view>
      <view class="ph-stat" v-if="count !== null && count !== undefined">
        <text class="ph-stat-label">今日记录</text>
        <text class="ph-stat-val">{{ count }} 笔</text>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  bedNo: { type: String, default: '' },
  patientName: { type: String, default: '' },
  hospitalNo: { type: String, default: '' },
  intake: { type: [Number, String], default: 0 },
  output: { type: [Number, String], default: 0 },
  balance: { type: [Number, String], default: 0 },
  count: { type: [Number, String], default: null },
  showStats: { type: Boolean, default: true }
})

defineEmits(['switch'])
</script>

<style>
.patient-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #ffffff;
  border-bottom: 1px solid #eef0f4;
  padding: 20rpx 24rpx 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
}

.ph-main {
  display: flex;
  align-items: center;
}

.ph-bed {
  background: #1677ff;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: bold;
  padding: 8rpx 18rpx;
  border-radius: 10rpx;
  margin-right: 18rpx;
  flex-shrink: 0;
}

.ph-identity {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ph-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #1f2329;
  line-height: 1.2;
}

.ph-no {
  font-size: 24rpx;
  color: #8c8c8c;
  margin-top: 4rpx;
}

.ph-switch {
  flex-shrink: 0;
  font-size: 26rpx;
  color: #1677ff;
  border: 1px solid #91caff;
  background: #f0f7ff;
  border-radius: 28rpx;
  padding: 8rpx 24rpx;
}

.ph-stats {
  display: flex;
  margin-top: 16rpx;
  background: #f7f9fc;
  border-radius: 12rpx;
  padding: 12rpx 8rpx;
}

.ph-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ph-stat-label {
  font-size: 22rpx;
  color: #8c8c8c;
}

.ph-stat-val {
  font-size: 30rpx;
  font-weight: bold;
  color: #262626;
  margin-top: 2rpx;
}

.ph-stat-val.in { color: #389e0d; }
.ph-stat-val.out { color: #d46b08; }
.ph-stat-val.pos { color: #1677ff; }
.ph-stat-val.neg { color: #eb2f96; }
</style>
