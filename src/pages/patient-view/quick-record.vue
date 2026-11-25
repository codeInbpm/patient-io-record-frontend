<template>
  <view class="quick-page">
    <!-- 患者身份常驻，避免家属记错人 -->
    <view class="q-patient" v-if="patientName">
      <text class="q-bed" v-if="bedNo">{{ bedNo }}</text>
      <text class="q-name">{{ patientName }}</text>
      <text class="q-tip" v-if="todayCount > 0">今天已记 {{ todayCount }} 次</text>
    </view>

    <!-- 未带模式进来：四个大按钮 -->
    <view class="tile-grid" v-if="!mode">
      <view class="tile" v-for="m in modeList" :key="m.key" @tap="selectMode(m.key)">
        <text class="tile-icon">{{ m.icon }}</text>
        <text class="tile-title">{{ m.title }}</text>
        <text class="tile-desc">{{ m.desc }}</text>
      </view>
    </view>

    <!-- 已在某个模式：顶部小切换，不再让用户重选一遍 -->
    <view class="mode-tabs" v-else>
      <view
        :class="['mtab', mode === m.key ? 'on' : '']"
        v-for="m in modeList"
        :key="m.key"
        @tap="selectMode(m.key)"
      >
        <text class="mtab-icon">{{ m.icon }}</text>
        <text class="mtab-text">{{ m.title }}</text>
      </view>
    </view>

    <view class="panel" v-if="mode">
      <view class="p-head">
        <text class="p-title" :style="{ color: cfg.color }">{{ cfg.title }}</text>
        <text class="p-sub">{{ cfg.sub }}</text>
      </view>

      <view class="rejected-hint" v-if="rejectedId">
        <text>护士说上面那条记错了，已经帮你去掉。按实际情况重新记一次就好。</text>
      </view>

      <!-- ① 喝水 / 吃饭：喝什么 + 喝多少 -->
      <template v-if="cfg.intake">
        <view class="row">
          <text class="row-label">{{ cfg.itemLabel }}</text>
          <view class="chips">
            <view
              :class="['chip', subType === i.value ? 'on' : '']"
              v-for="i in cfg.items"
              :key="i.value"
              @tap="subType = i.value"
            >{{ i.label }}</view>
          </view>
        </view>
        <view class="row">
          <text class="row-label">{{ cfg.sizeLabel }}</text>
          <view class="size-grid">
            <view
              :class="['size-chip', sizeIdx === idx ? 'on' : '']"
              v-for="(s, idx) in cfg.sizes"
              :key="s.label"
              @tap="pickSize(idx)"
            >
              <text class="sc-main">{{ s.label }}</text>
              <text class="sc-sub">约{{ s.ml }}ml</text>
            </view>
          </view>
        </view>
      </template>

      <!-- ② 排尿：尿量 + 颜色 -->
      <template v-else-if="mode === 'urine'">
        <view class="row">
          <text class="row-label">尿量大概多少</text>
          <view class="size-grid">
            <view
              :class="['size-chip', sizeIdx === idx ? 'on' : '']"
              v-for="(s, idx) in cfg.sizes"
              :key="s.label"
              @tap="pickSize(idx)"
            >
              <text class="sc-main">{{ s.label }}</text>
              <text class="sc-sub">约{{ s.ml }}ml</text>
            </view>
          </view>
        </view>
        <view class="row">
          <text class="row-label">颜色</text>
          <view class="chips">
            <view
              :class="['chip', subType === i.value ? 'on' : '']"
              v-for="i in cfg.items"
              :key="i.value"
              @tap="subType = i.value"
            >{{ i.label }}</view>
          </view>
        </view>
        <view class="tip-line warn" v-if="subType === '洗肉水色/血尿'">
          <text class="tip-text">颜色发红，保存后会同时告诉护士</text>
        </view>
        <view class="tip-line" v-else>喝水多时尿色会变淡，是正常的</view>
      </template>

      <!-- ③ 排便：几次 + 每次多少 + 什么样（没有 ml 输入） -->
      <template v-else>
        <view class="row">
          <text class="row-label">几次</text>
          <view class="count-row">
            <view
              :class="['count-chip', stoolCount === n ? 'on' : '']"
              v-for="n in [1, 2, 3]"
              :key="n"
              @tap="stoolCount = n"
            >{{ n }} 次</view>
            <view :class="['count-chip', stoolCount === 4 ? 'on' : '']" @tap="stoolCount = 4">
              4 次以上
            </view>
          </view>
        </view>
        <view class="row">
          <text class="row-label">每次大概多少</text>
          <view class="size-grid">
            <view
              :class="['size-chip', sizeIdx === idx ? 'on' : '']"
              v-for="(s, idx) in cfg.sizes"
              :key="s.label"
              @tap="pickSize(idx)"
            >
              <text class="sc-main">{{ s.label }}</text>
            </view>
          </view>
        </view>
        <view class="row">
          <text class="row-label">什么样</text>
          <view class="chips">
            <view
              :class="['chip', subType === i.value ? 'on' : '']"
              v-for="i in cfg.items"
              :key="i.value"
              @tap="subType = i.value"
            >{{ i.label }}</view>
          </view>
        </view>
        <view class="tip-line warn" v-if="subType === '柏油样黑便' || subType === '水样便'">
          <text class="tip-text">黑便或水样便，保存后会同时告诉护士</text>
        </view>
      </template>

      <!-- 兜底：量都不合适时手动输入 -->
      <view class="manual-line" v-if="!manualOpen" @tap="manualOpen = true">
        量都不对？手动输入
      </view>
      <view class="manual-box" v-else>
        <input
          class="manual-input"
          type="number"
          v-model="manualAmount"
          placeholder="输入毫升数"
          focus
        />
        <text class="manual-unit">ml</text>
      </view>

      <!-- 时间：默认现在，可改日期（补记昨天） -->
      <view class="time-line">
        <text class="time-text">{{ dateLabel }} {{ timePart }}</text>
        <view class="time-actions">
          <text class="time-btn" @tap="setNow">现在</text>
          <picker mode="date" :value="datePart" @change="onDateChange">
            <text class="time-btn">改日期</text>
          </picker>
          <picker mode="time" :value="timePart" @change="onTimeChange">
            <text class="time-btn">改时间</text>
          </picker>
        </view>
      </view>
    </view>

    <!-- 刚记的：当场能看到、能撤销，不用回首页确认 -->
    <view class="just-list" v-if="recentList.length">
      <view class="just-item" v-for="(r, idx) in recentList" :key="r.id + '-' + idx">
        <text class="ji-text">{{ r.text }}</text>
        <text class="ji-undo" @tap="undo(r)">撤销</text>
      </view>
    </view>

    <view class="hint-block" v-else-if="!mode">
      <text>请先点上面任意一个大按钮</text>
    </view>

    <!-- 底部固定保存 -->
    <view class="footer" v-if="mode">
      <button class="save-btn" :disabled="saving" @tap="handleSave">
        {{ saving ? '正在记录…' : (dangerSymptom ? '记录并告诉护士' : '记录' + confirmText) }}
      </button>
      <text class="save-tip" v-if="sessionCount > 0">本次已连续记录 {{ sessionCount }} 笔</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { recordIntakeApi, recordOutputApi, deleteIntakeApi, deleteOutputApi, getDailyBalanceApi, markCorrectionReRecordedApi, reportSymptomAlertApi } from '../../api/record'
import { getMyBoundPatientApi } from '../../api/patient'
import { formatDate, formatTimeOnly } from '../../utils/date'

const MODES = {
  water: {
    key: 'water',
    icon: '🥛',
    title: '喝水',
    desc: '水、汤、奶、果汁',
    color: '#1677ff',
    sub: '按杯子记，不用换算毫升',
    itemLabel: '喝的是什么',
    sizeLabel: '喝了多少',
    items: [
      { label: '白开水', value: 'WATER' },
      { label: '汤', value: 'SOUP' },
      { label: '牛奶/豆浆', value: 'MILK' },
      { label: '果汁', value: 'CUSTOM' }
    ],
    sizes: [
      { label: '半杯', ml: 100 },
      { label: '一杯', ml: 200 },
      { label: '一大杯', ml: 300 },
      { label: '一瓶', ml: 500 }
    ],
    intake: true
  },
  meal: {
    key: 'meal',
    icon: '🍚',
    title: '吃饭',
    desc: '粥、面、饭、藕粉',
    color: '#fa8c16',
    sub: '按碗记，不用称重量',
    itemLabel: '吃的是什么',
    sizeLabel: '吃了多少',
    items: [
      { label: '粥', value: 'CONGEE' },
      { label: '面条', value: 'NOODLES' },
      { label: '米饭', value: 'CUSTOM' },
      { label: '汤', value: 'SOUP' },
      { label: '藕粉', value: 'LOTUS_STARCH' }
    ],
    sizes: [
      { label: '半碗', ml: 100 },
      { label: '一碗', ml: 200 },
      { label: '两碗', ml: 400 }
    ],
    intake: true
  },
  urine: {
    key: 'urine',
    icon: '🚽',
    title: '排尿',
    desc: '尿量、颜色',
    color: '#13c2c2',
    sub: '选大小，再选颜色',
    itemLabel: '颜色',
    sizeLabel: '尿量大概多少',
    items: [
      { label: '清亮', value: '淡黄清亮' },
      { label: '淡黄', value: '淡黄色' },
      { label: '深黄', value: '深黄浓茶色' },
      { label: '发红', value: '洗肉水色/血尿' }
    ],
    sizes: [
      { label: '一点点', ml: 100 },
      { label: '一次', ml: 200 },
      { label: '很多', ml: 400 }
    ],
    intake: false
  },
  stool: {
    key: 'stool',
    icon: '💩',
    title: '排便',
    desc: '几次、稀稠',
    color: '#722ed1',
    sub: '记次数和稀稠，不用填毫升',
    itemLabel: '什么样',
    sizeLabel: '每次大概多少',
    items: [
      { label: '成形', value: '黄色软便' },
      { label: '稀', value: '稀便' },
      { label: '水样', value: '水样便' },
      { label: '发黑', value: '柏油样黑便' }
    ],
    sizes: [
      { label: '少', ml: 50 },
      { label: '中', ml: 100 },
      { label: '多', ml: 200 }
    ],
    intake: false
  }
}

const modeList = Object.values(MODES)

const patientId = ref(null)
const patientName = ref('')
const bedNo = ref('')
const mode = ref('')
const subType = ref('')
const sizeIdx = ref(-1)
const stoolCount = ref(1)
const manualOpen = ref(false)
const manualAmount = ref('')
const saving = ref(false)
const sessionCount = ref(0)
const todayCount = ref(0)
const recentList = ref([])
// 护士驳回的那条记录，重记完成后要回来把它销掉
const rejectedId = ref(null)

const datePart = ref(formatDate())
const timePart = ref(formatTimeOnly(new Date()))

const cfg = computed(() => (mode.value ? MODES[mode.value] : null))

const dateLabel = computed(() => {
  return datePart.value === formatDate() ? '今天' : datePart.value
})

// 当前这一笔实际会记多少
const currentAmount = computed(() => {
  if (manualOpen.value && manualAmount.value) return Number(manualAmount.value) || 0
  if (!cfg.value || sizeIdx.value < 0) return 0
  const base = cfg.value.sizes[sizeIdx.value].ml
  return mode.value === 'stool' ? base * stoolCount.value : base
})

const confirmText = computed(() => {
  if (!cfg.value) return ''
  if (mode.value === 'stool') {
    return sizeIdx.value >= 0 ? ` ${stoolCount.value} 次` : ''
  }
  if (currentAmount.value > 0) return ` ${currentAmount.value}ml`
  return ''
})

function selectMode(next) {
  if (mode.value === next) return
  mode.value = next
  // 喝水/吃饭的品名默认第一项没有风险；
  // 但尿色、便性状是红旗信号，默认成「清亮」「成形」等于把血尿和黑便藏起来，必须让患者自己选
  subType.value = (next === 'water' || next === 'meal') ? MODES[next].items[0].value : ''
  sizeIdx.value = -1
  stoolCount.value = 1
  manualOpen.value = false
  manualAmount.value = ''
}

function pickSize(idx) {
  sizeIdx.value = idx
  manualOpen.value = false
  manualAmount.value = ''
}

function setNow() {
  const now = new Date()
  datePart.value = formatDate(now)
  timePart.value = formatTimeOnly(now)
}

function onDateChange(e) {
  datePart.value = e.detail.value
}

function onTimeChange(e) {
  timePart.value = e.detail.value
}

function sizeLabelOf() {
  if (manualOpen.value && manualAmount.value) return '手动输入'
  if (!cfg.value || sizeIdx.value < 0) return ''
  return cfg.value.sizes[sizeIdx.value].label
}

function itemLabelOf() {
  const hit = cfg.value?.items.find(i => i.value === subType.value)
  return hit ? hit.label : ''
}

/**
 * 危险信号不单独做一个按钮。
 * 多一个按钮 = 多一次点击 = 多一个「点了提示却还要再点记录」的断点。
 * 血尿/黑便本来就必须让护士知道，这不是患者能选的事，合并进保存动作即可。
 */
const dangerSymptom = computed(() => {
  if (mode.value === 'urine' && subType.value === '洗肉水色/血尿') return '尿色发红'
  if (mode.value === 'stool' && subType.value === '柏油样黑便') return '柏油样黑便'
  if (mode.value === 'stool' && subType.value === '水样便') return '水样便'
  return ''
})

/**
 * 保存成功后顺手把症状交给护士。
 * 失败不能影响记录已经存下这件事，只提示患者当面说一声。
 */
async function notifySymptom(amount) {
  const symptom = dangerSymptom.value
  if (!symptom) return true
  try {
    await reportSymptomAlertApi({
      patientId: patientId.value,
      symptom,
      category: 'OUTPUT',
      amount: amount > 0 ? amount : null,
      itemName: mode.value === 'urine' ? '排尿' : '排便',
      remark: `患者自述：${symptom}`
    })
    return true
  } catch (e) {
    console.error('上报症状失败', e)
    return false
  }
}

async function handleSave() {
  if (saving.value) return
  if (!mode.value) {
    uni.showToast({ title: '请先选择记录类型', icon: 'none' })
    return
  }
  if (!subType.value) {
    uni.showToast({
      title: mode.value === 'urine' ? '请选一下尿的颜色' : '请选一下大便的样子',
      icon: 'none'
    })
    return
  }
  if (sizeIdx.value < 0 && !(manualOpen.value && manualAmount.value)) {
    uni.showToast({ title: mode.value === 'stool' ? '请选择每次大概多少' : '请先选一个量', icon: 'none' })
    return
  }
  const amount = currentAmount.value
  if (!amount || amount <= 0) {
    uni.showToast({ title: '数值不正确，请重填', icon: 'none' })
    return
  }
  if (amount > 5000) {
    uni.showToast({ title: '数值过大，请核对', icon: 'none' })
    return
  }

  const recordTime = `${datePart.value} ${timePart.value}:00`
  const sizeLabel = sizeLabelOf()
  const itemLabel = itemLabelOf()
  const isIntake = cfg.value.intake
  // 把患者原话留在备注里，护士看到「一杯 · 白开水（患者填写）」，一眼区分来源
  const remark = mode.value === 'stool'
    ? `${stoolCount.value}次 · ${sizeLabel} · ${itemLabel}（患者填写）`
    : `${sizeLabel} · ${itemLabel}（患者填写）`

  saving.value = true
  try {
    let res
    if (isIntake) {
      res = await recordIntakeApi({
        patientId: patientId.value,
        intakeType: 'ORAL',
        subType: subType.value,
        itemName: itemLabel,
        amount,
        recordTime,
        remark
      })
    } else {
      res = await recordOutputApi({
        patientId: patientId.value,
        outputType: mode.value === 'urine' ? 'URINE' : 'STOOL',
        amount,
        natureOrColor: subType.value,
        recordTime,
        remark
      })
    }

    sessionCount.value += 1
    todayCount.value += 1
    recentList.value.unshift({
      id: res,
      isIntake,
      savedAt: Date.now(),
      text: `${timePart.value} ${cfg.value.title} · ${mode.value === 'stool' ? stoolCount.value + '次 · ' : ''}${sizeLabel}${mode.value === 'stool' ? ' · ' : ' ≈ '}${amount}ml`
    })
    // 这一笔是补护士驳回的那条：存成功后把它从「待重记」里销掉
    if (rejectedId.value) {
      try {
        await markCorrectionReRecordedApi(rejectedId.value)
      } catch (e) {
        console.error('销掉退回记录失败', e)
      }
      rejectedId.value = null
    }
    // 危险信号：记录一落库就同时通知护士，患者不用再多点一次
    const notified = await notifySymptom(amount)
    if (dangerSymptom.value) {
      uni.showToast({
        title: notified ? '记好了，也告诉护士了' : '记好了，请当面跟护士说一声',
        icon: 'none',
        duration: 2500
      })
    } else {
      uni.showToast({ title: '记好了', icon: 'success' })
    }
    manualOpen.value = false
    manualAmount.value = ''
    if (datePart.value !== formatDate()) {
      // 补记历史日期时回到今天，避免下一笔默认记到昨天
      datePart.value = formatDate()
    }
    timePart.value = formatTimeOnly(new Date())
  } catch (e) {
    console.error('患者录入失败', e)
  } finally {
    saving.value = false
  }
}

function undo(item) {
  if (Date.now() - item.savedAt > 5 * 60 * 1000) {
    uni.showToast({ title: '超过 5 分钟，请联系护士', icon: 'none' })
    return
  }
  uni.showModal({
    title: '撤销这条记录？',
    content: item.text,
    confirmText: '撤销',
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (!res.confirm) return
      try {
        if (item.isIntake) {
          await deleteIntakeApi(item.id, '患者本人撤销')
        } else {
          await deleteOutputApi(item.id, '患者本人撤销')
        }
        recentList.value = recentList.value.filter(r => r !== item)
        todayCount.value = Math.max(0, todayCount.value - 1)
        uni.showToast({ title: '已撤销', icon: 'success' })
      } catch (e) {
        console.error('撤销失败', e)
        uni.showToast({ title: '撤销失败，请联系护士', icon: 'none' })
      }
    }
  })
}

async function loadTodayCount() {
  if (!patientId.value) return
  try {
    const balance = await getDailyBalanceApi(patientId.value, formatDate())
    const items = balance?.items || []
    todayCount.value = items.length
  } catch (e) {
    console.error('获取今日记录数失败', e)
  }
}

onLoad(async (options) => {
  // 患者只能给自己记录，patientId 一律以服务端绑定关系为准
  try {
    const me = await getMyBoundPatientApi()
    if (me) {
      patientId.value = me.id
      patientName.value = me.patientName || ''
      bedNo.value = me.bedNo || ''
    }
  } catch (e) {
    console.error('获取本人档案失败', e)
  }
  if (!patientId.value) {
    uni.showModal({
      title: '未绑定床位',
      content: '请先完成床位绑定后再记录。',
      showCancel: false,
      success: () => uni.navigateBack()
    })
    return
  }

  const preset = options?.mode || options?.type
  if (preset && MODES[preset]) {
    selectMode(preset)
  } else if (preset === 'intake') {
    selectMode('water')
  } else if (preset === 'output') {
    selectMode('urine')
  }

  // 护士驳回的记录：把原来的品名和量带出来，患者改一下数字就能重记，不用从头选
  if (options?.rejectedId) {
    rejectedId.value = options.rejectedId
    if (options.amount) {
      manualOpen.value = true
      manualAmount.value = String(options.amount)
    }
    if (options.itemName) {
      const name = decodeURIComponent(options.itemName)
      const hit = cfg.value?.items.find(i => i.label === name)
      if (hit) subType.value = hit.value
    }
  }

  loadTodayCount()
})
</script>

<style>
.quick-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 24rpx;
  padding-bottom: calc(220rpx + env(safe-area-inset-bottom));
}

.q-patient {
  display: flex;
  align-items: center;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 22rpx;
}

.q-bed {
  background: #1677ff;
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  margin-right: 14rpx;
}

.q-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #1f2329;
  flex: 1;
}

.q-tip {
  font-size: 28rpx;
  color: #8c8c8c;
}

.tile-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.tile {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 36rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.tile-icon {
  font-size: 76rpx;
  margin-bottom: 10rpx;
}

.tile-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #1f2329;
}

.tile-desc {
  font-size: 24rpx;
  color: #8c8c8c;
  margin-top: 6rpx;
}

.mode-tabs {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.mtab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #ffffff;
  border: 3rpx solid #ffffff;
  border-radius: 14rpx;
  padding: 16rpx 0;
}

.mtab.on {
  border-color: #1677ff;
  background: #f0f7ff;
}

.mtab-icon {
  font-size: 44rpx;
}

.mtab-text {
  font-size: 26rpx;
  color: #595959;
  margin-top: 4rpx;
}

.mtab.on .mtab-text {
  color: #1677ff;
  font-weight: bold;
}

.panel {
  background: #ffffff;
  border-radius: 18rpx;
  padding: 26rpx 24rpx 10rpx;
}

.p-head {
  display: flex;
  align-items: baseline;
  margin-bottom: 10rpx;
}

.p-title {
  font-size: 38rpx;
  font-weight: bold;
  margin-right: 14rpx;
}

.p-sub {
  font-size: 24rpx;
  color: #8c8c8c;
}

.row {
  padding: 20rpx 0;
  border-top: 1rpx solid #f2f4f7;
}

.row-label {
  font-size: 30rpx;
  color: #1f2329;
  font-weight: 500;
  display: block;
  margin-bottom: 16rpx;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  font-size: 30rpx;
  color: #1f2329;
  background: #f5f7fa;
  border: 2rpx solid #e5e9f0;
  border-radius: 40rpx;
  padding: 16rpx 34rpx;
}

.chip.on {
  background: #1677ff;
  border-color: #1677ff;
  color: #ffffff;
  font-weight: bold;
}

.size-grid {
  display: flex;
  gap: 16rpx;
}

.size-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f7f9fc;
  border: 2rpx solid #e5e9f0;
  border-radius: 14rpx;
  padding: 18rpx 0;
}

.size-chip.on {
  background: #f0f7ff;
  border-color: #1677ff;
}

.sc-main {
  font-size: 30rpx;
  font-weight: bold;
  color: #1f2329;
}

.size-chip.on .sc-main {
  color: #1677ff;
}

.sc-sub {
  font-size: 22rpx;
  color: #8c8c8c;
  margin-top: 4rpx;
}

.count-row {
  display: flex;
  gap: 14rpx;
  flex-wrap: wrap;
}

.count-chip {
  font-size: 30rpx;
  color: #1f2329;
  background: #f5f7fa;
  border: 2rpx solid #e5e9f0;
  border-radius: 12rpx;
  padding: 18rpx 30rpx;
}

.count-chip.on {
  background: #f9f0ff;
  border-color: #722ed1;
  color: #722ed1;
  font-weight: bold;
}

.tip-line {
  font-size: 24rpx;
  color: #8c8c8c;
  background: #fafbfc;
  border-radius: 10rpx;
  padding: 14rpx 18rpx;
  margin: 4rpx 0 12rpx;
}

.tip-line.warn {
  color: #cf1322;
  background: #fff1f0;
  border-left: 6rpx solid #cf1322;
  font-weight: bold;
}

.tip-text {
  font-size: 26rpx;
  line-height: 1.5;
}

.manual-line {
  font-size: 28rpx;
  color: #1677ff;
  text-align: center;
  padding: 18rpx 0;
}

.manual-box {
  display: flex;
  align-items: center;
  padding: 18rpx 0;
}

.manual-input {
  flex: 1;
  height: 92rpx;
  border: 2rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 0 22rpx;
  font-size: 38rpx;
  font-weight: bold;
  text-align: center;
  color: #1f2329;
}

.manual-unit {
  font-size: 28rpx;
  color: #8c8c8c;
  margin-left: 14rpx;
}

.time-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-top: 1rpx solid #f2f4f7;
}

.time-text {
  font-size: 26rpx;
  color: #8c8c8c;
}

.time-actions {
  display: flex;
  gap: 12rpx;
}

.time-btn {
  font-size: 28rpx;
  color: #1677ff;
  background: #f0f7ff;
  border-radius: 30rpx;
  padding: 10rpx 20rpx;
}

.just-list {
  margin-top: 20rpx;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 8rpx 24rpx;
}

.just-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f7fa;
}

.just-item:last-child {
  border-bottom: none;
}

.ji-text {
  font-size: 28rpx;
  color: #1f2329;
  flex: 1;
}

.ji-undo {
  font-size: 28rpx;
  color: #ff4d4f;
  padding: 8rpx 16rpx;
}

.hint-block {
  margin-top: 40rpx;
  text-align: center;
  font-size: 28rpx;
  color: #bfbfbf;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
  padding: 18rpx 24rpx;
  padding-bottom: calc(18rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.save-btn {
  height: 108rpx;
  line-height: 108rpx;
  background: #52c41a;
  color: #ffffff;
  font-size: 36rpx;
  font-weight: bold;
  border-radius: 54rpx;
}

.save-btn[disabled] {
  background: #95de64;
  color: #ffffff;
}

.save-tip {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #8c8c8c;
  margin-top: 10rpx;
}

.rejected-hint {
  background: #fff1f0;
  border: 1rpx solid #ffccc7;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
  font-size: 24rpx;
  color: #cf1322;
  line-height: 1.5;
  display: block;
}
</style>
