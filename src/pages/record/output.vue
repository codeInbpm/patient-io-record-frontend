<template>
  <view class="container">
    <view class="form-card">
      <!-- 出量类型切换 -->
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
          大便量
        </view>
        <view 
          :class="['tab-item', form.outputType === 'GASTRO_DRAINAGE' ? 'active' : '']"
          @tap="switchType('GASTRO_DRAINAGE')"
        >
          胃肠减压引流
        </view>
      </view>

      <!-- 排出量输入与快捷芯片 -->
      <view class="form-group">
        <text class="label">排出量 (ml) *</text>
        <input class="input amount-input" type="digit" v-model="form.amount" placeholder="输入或选择快捷量" />
        <view class="amount-chips">
          <view 
            class="amount-chip" 
            v-for="amt in [100, 150, 200, 300, 400, 500]" 
            :key="amt"
            @tap="form.amount = amt"
          >
            {{ amt }} ml
          </view>
        </view>
      </view>

      <!-- 颜色/性状快速标签 -->
      <view class="form-group">
        <text class="label">性状 / 颜色</text>
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
        <input class="input" style="margin-top: 14rpx;" v-model="form.natureOrColor" placeholder="自定义输入颜色性状" />
      </view>

      <!-- 记录时间 -->
      <view class="form-group">
        <text class="label">排出时间 (精确到分钟) *</text>
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
        <input class="input" v-model="form.remark" placeholder="如：留置导尿管引流、患者自主排尿" />
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="submit-section">
      <button class="submit-btn" type="primary" :loading="loading" @tap="handleSubmit">保存出量记录</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { recordOutputApi } from '../../api/record'
import { formatDate, formatTimeOnly } from '../../utils/date'

const patientId = ref(null)
const loading = ref(false)

const recordDatePart = ref(formatDate())
const recordTimePart = ref(formatTimeOnly(new Date()))

const form = ref({
  patientId: null,
  outputType: 'URINE',
  amount: '200',
  natureOrColor: '淡黄色清亮',
  remark: ''
})

const natureOptions = {
  URINE: ['淡黄色清亮', '深黄浓茶色', '洗肉水色/血尿', '混浊含有沉淀'],
  STOOL: ['黄色软便', '成形硬便', '稀水便', '柏油样黑便', '淘米水样'],
  GASTRO_DRAINAGE: ['黄绿草绿色', '墨绿色', '咖啡色胃液', '鲜红带血']
}

const currentNatureTags = computed(() => {
  return natureOptions[form.value.outputType] || []
})

function switchType(type) {
  form.value.outputType = type
  if (type === 'URINE') {
    form.value.natureOrColor = '淡黄色清亮'
    form.value.amount = '200'
  } else if (type === 'STOOL') {
    form.value.natureOrColor = '黄色软便'
    form.value.amount = '150'
  } else if (type === 'GASTRO_DRAINAGE') {
    form.value.natureOrColor = '黄绿草绿色'
    form.value.amount = '100'
  }
}

function onDateChange(e) {
  recordDatePart.value = e.detail.value
}

function onTimeChange(e) {
  recordTimePart.value = e.detail.value
}

async function handleSubmit() {
  if (!form.value.amount || Number(form.value.amount) <= 0) {
    uni.showToast({ title: '排出量必须大于0', icon: 'none' })
    return
  }

  const recordTime = `${recordDatePart.value} ${recordTimePart.value}:00`

  loading.value = true
  try {
    await recordOutputApi({
      patientId: patientId.value,
      outputType: form.value.outputType,
      amount: Number(form.value.amount),
      natureOrColor: form.value.natureOrColor,
      recordTime: recordTime,
      remark: form.value.remark
    })
    uni.showToast({ title: '出量录入成功', icon: 'success' })
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
  font-size: 26rpx;
  color: #595959;
  border-radius: 10rpx;
  font-weight: 500;
}

.tab-item.active {
  background: #fa8c16;
  color: #ffffff;
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
  color: #fa8c16;
}

.amount-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 16rpx;
}

.amount-chip {
  background: #fff7e6;
  color: #fa8c16;
  border: 1px solid #ffd591;
  border-radius: 24rpx;
  padding: 6rpx 20rpx;
  font-size: 24rpx;
}

.nature-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.nature-chip {
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 24rpx;
  padding: 6rpx 20rpx;
  font-size: 24rpx;
  color: #595959;
}

.nature-chip.selected {
  background: #fff7e6;
  border-color: #fa8c16;
  color: #fa8c16;
  font-weight: bold;
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
  background: #fa8c16;
  border-radius: 40rpx;
  font-size: 32rpx;
  font-weight: bold;
}
</style>
