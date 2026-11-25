<template>
  <view class="state-view">
    <!-- 加载：骨架屏，避免白屏闪烁 -->
    <view v-if="state === 'loading'" class="skeleton-wrap">
      <view class="skeleton-card" v-for="i in skeletonRows" :key="i">
        <view class="sk-line sk-line-lg"></view>
        <view class="sk-line sk-line-md"></view>
        <view class="sk-line sk-line-sm"></view>
      </view>
      <text class="state-tip">正在加载…</text>
    </view>

    <!-- 失败：明确告知是网络问题，并给出重试 -->
    <view v-else-if="state === 'error'" class="state-box">
      <text class="state-icon">⚠️</text>
      <text class="state-title">{{ title || '加载失败' }}</text>
      <text class="state-desc">{{ desc || '网络不稳定，请检查后重试' }}</text>
      <button class="state-btn" @tap="$emit('retry')">重新加载</button>
    </view>

    <!-- 空：区分「真的没有数据」和「筛选后没有」 -->
    <view v-else class="state-box">
      <text class="state-icon">{{ icon || '📋' }}</text>
      <text class="state-title">{{ title || '暂无数据' }}</text>
      <text class="state-desc" v-if="desc">{{ desc }}</text>
      <slot></slot>
    </view>
  </view>
</template>

<script setup>
defineProps({
  state: { type: String, default: 'empty' }, // loading | error | empty
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  icon: { type: String, default: '' },
  skeletonRows: { type: Number, default: 3 }
})

defineEmits(['retry'])
</script>

<style>
.state-view {
  padding: 60rpx 20rpx;
}

.skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.skeleton-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
}

.sk-line {
  height: 24rpx;
  border-radius: 12rpx;
  background: linear-gradient(90deg, #f0f2f5 25%, #e6e9ef 37%, #f0f2f5 63%);
  background-size: 400% 100%;
  animation: sk-shimmer 1.4s ease infinite;
  margin-bottom: 16rpx;
}

.sk-line:last-child {
  margin-bottom: 0;
}

.sk-line-lg { width: 55%; height: 32rpx; }
.sk-line-md { width: 85%; }
.sk-line-sm { width: 40%; }

@keyframes sk-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 24rpx;
}

.state-icon {
  font-size: 72rpx;
  margin-bottom: 20rpx;
  line-height: 1;
}

.state-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #262626;
  margin-bottom: 12rpx;
  text-align: center;
}

.state-desc {
  font-size: 28rpx;
  color: #8c8c8c;
  line-height: 1.5;
  text-align: center;
  margin-bottom: 28rpx;
  max-width: 520rpx;
}

.state-btn {
  background: #1677ff;
  color: #ffffff;
  font-size: 28rpx;
  border-radius: 40rpx;
  padding: 0 56rpx;
  height: 76rpx;
  line-height: 76rpx;
  margin: 0;
}

.state-tip {
  text-align: center;
  font-size: 24rpx;
  color: #bfbfbf;
}
</style>
