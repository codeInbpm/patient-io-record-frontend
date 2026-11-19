<template>
  <view class="container">
    <view class="form-card">
      <!-- 入量大类切换 -->
      <view class="category-tabs">
        <view 
          :class="['tab-item', form.intakeType === 'ORAL' ? 'active' : '']"
          @tap="switchType('ORAL')"
        >
          口服摄入
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
          鼻饲管注
        </view>
      </view>

      <!-- 口服快捷模版选择 -->
      <view class="item-selector" v-if="form.intakeType === 'ORAL'">
        <text class="field-label">常用口服品类：</text>
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
        <text class="label">入量名称 / 品名 *</text>
        <input class="input" v-model="form.itemName" placeholder="如：温开水、米汤、生理盐水500ml" />
      </view>

      <!-- 快捷容量模版 -->
      <view class="form-group">
        <text class="label">摄入量 (ml) *</text>
        <input class="input amount-input" type="digit" v-model="form.amount" placeholder="输入或点击下方快捷选择" />
        <view class="amount-chips">
          <view 
            class="amount-chip" 
            v-for="amt in [50, 100, 150, 200, 250, 500]" 
            :key="amt"
            @tap="form.amount = amt"
          >
            {{ amt }} ml
          </view>
        </view>
      </view>

      <!-- 摄入时间（精确到分钟） -->
      <view class="form-group">
        <text class="label">摄入时间 (精确到分钟) *</text>
        <view class="time-picker-row">
          <picker mode="date" :value="recordDatePart" @change="onDateChange">
            <view class="picker-box">{{ recordDatePart }}</view>
          </picker>
          <picker mode="time" :value="recordTimePart" @change="onTimeChange">
            <view class="picker-box">{{ recordTimePart }}</view>
          </picker>
        </view>
      </view>

      <!-- 备注说明 -->
      <view class="form-group">
        <text class="label">备注（可选）</text>
        <input class="input" v-model="form.remark" placeholder="如：患者自行饮用、遵医嘱输注等" />
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="submit-section">
      <button class="submit-btn" type="primary" :loading="loading" @tap="handleSubmit">保存入量记录</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { recordIntakeApi } from '../../api/record'
import { formatDate, formatTimeOnly } from '../../utils/date'

const patientId = ref(null)
const loading = ref(false)

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
  amount: '150',
  remark: ''
})

function switchType(type) {
  form.value.intakeType = type
  if (type === 'ORAL') {
    form.value.itemName = '水'
    form.value.subType = 'WATER'
  } else if (type === 'IV') {
    form.value.itemName = '静脉输液'
    form.value.subType = 'IV_FLUID'
    form.value.amount = '250'
  } else if (type === 'NASOGASTRIC') {
    form.value.itemName = '鼻饲营养液'
    form.value.subType = 'TUBE_FEED'
    form.value.amount = '200'
  }
}

function selectOralPreset(item) {
  form.value.itemName = item.name
  form.value.subType = item.subType
}

function onDateChange(e) {
  recordDatePart.value = e.detail.value
}

function onTimeChange(e) {
  recordTimePart.value = e.detail.value
}

async function handleSubmit() {
  if (!form.value.itemName.trim()) {
    uni.showToast({ title: '请输入品名', icon: 'none' })
    return
  }
  if (!form.value.amount || Number(form.value.amount) <= 0) {
    uni.showToast({ title: '摄入量必须大于0', icon: 'none' })
    return
  }

  const recordTime = `${recordDatePart.value} ${recordTimePart.value}:00`

  loading.value = true
  try {
    await recordIntakeApi({
      patientId: patientId.value,
      intakeType: form.value.intakeType,
      subType: form.value.subType,
      itemName: form.value.itemName.trim(),
      amount: Number(form.value.amount),
      recordTime: recordTime,
      remark: form.value.remark
    })
    uni.showToast({ title: '入量录入成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 800)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onLoad((options) => {
  if (options.patientId) {
    patientId.value = options.patientId
    form.value.patientId = options.patientId
  }
})
</script>

<style>
.container {
  padding: 24rpx;
}

.form-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.category-tabs {
  display: flex;
  background: #f0f0f0;
  border-radius: 12rpx;
  padding: 6rpx;
  margin-bottom: 30rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 28rpx;
  color: #595959;
  border-radius: 10rpx;
  font-weight: 500;
}

.tab-item.active {
  background: #52c41a;
  color: #ffffff;
  font-weight: bold;
}

.item-selector {
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
  gap: 16rpx;
}

.chip-item {
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 30rpx;
  padding: 8rpx 24rpx;
  font-size: 26rpx;
  color: #262626;
}

.chip-item.selected {
  background: #f6ffed;
  border-color: #52c41a;
  color: #52c41a;
  font-weight: bold;
}

.form-group {
  margin-bottom: 30rpx;
}

.label {
  font-size: 26rpx;
  color: #595959;
  display: block;
  margin-bottom: 10rpx;
}

.input {
  height: 80rpx;
  min-height: 80rpx;
  line-height: 80rpx;
  padding: 0 20rpx;
  border: 1px solid #d9d9d9;
  border-radius: 10rpx;
  font-size: 28rpx;
  background: #fafafa;
  box-sizing: border-box;
}

.amount-input {
  height: 88rpx;
  min-height: 88rpx;
  line-height: 88rpx;
  font-size: 36rpx;
  font-weight: bold;
  color: #52c41a;
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
  padding: 6rpx 20rpx;
  font-size: 24rpx;
}

.time-picker-row {
  display: flex;
  gap: 20rpx;
}

.picker-box {
  border: 1px solid #d9d9d9;
  border-radius: 10rpx;
  padding: 16rpx 24rpx;
  font-size: 28rpx;
  background: #fafafa;
}

.submit-section {
  margin-top: 50rpx;
}

.submit-btn {
  background: #52c41a;
  border-radius: 40rpx;
  font-size: 32rpx;
  font-weight: bold;
}
</style>
