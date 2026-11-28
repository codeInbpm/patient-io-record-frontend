<template>
  <view class="drug-picker">
    <!-- 已选药品 -->
    <view class="selected-list" v-if="drugs.length">
      <view
        v-for="(d, i) in drugs"
        :key="i"
        :class="['drug-chip', d.highAlert === 1 ? 'chip-danger' : '', d.manual ? 'chip-manual' : '']"
      >
        <view class="chip-body">
          <text class="chip-name">{{ d.name }}</text>
          <text class="chip-spec" v-if="d.spec">规格 {{ d.spec }}</text>
          <view class="chip-dose-row">
            <input
              class="chip-dose-input"
              type="digit"
              :value="d.dose || ''"
              :placeholder="d.highAlert === 1 ? '用量必填' : '用量'"
              placeholder-class="chip-dose-ph"
              @input="onDoseInput(i, $event)"
            />
            <text class="chip-dose-unit" v-if="d.unit">{{ d.unit }}</text>
          </view>
          <text class="chip-flag" v-if="d.highAlert === 1">高警示</text>
          <text class="chip-flag manual" v-if="d.manual">未入库·仅本次</text>
        </view>
        <text class="chip-del" @tap.stop="removeAt(i)">×</text>
      </view>
    </view>

    <!-- 搜索框 -->
    <view class="search-box">
      <text class="search-icon">🔍</text>
      <input
        class="search-input"
        v-model="keyword"
        :placeholder="placeholder"
        placeholder-class="ph"
        confirm-type="search"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @confirm="onConfirm"
      />
      <text class="clear-btn" v-if="keyword" @tap="resetKeyword">清空</text>
    </view>

    <!-- 联想面板 -->
    <view class="result-panel" v-if="panelVisible">
      <scroll-view scroll-y class="result-scroll">
        <view
          v-for="(r, i) in results"
          :key="r.id || 'r' + i"
          class="result-item"
          @tap="choose(r)"
        >
          <view class="r-main">
            <text class="r-name">{{ r.genericName }}</text>
            <text class="r-spec" v-if="r.spec">{{ r.spec }}</text>
          </view>
          <text class="r-tag pending" v-if="r.pending">待确认</text>
          <text class="r-tag" v-if="r.highAlert === 1">高警示</text>
        </view>

        <view class="result-empty" v-if="!results.length && !loading">
          <text>库里没有「{{ keyword }}」，点下面新增一条</text>
        </view>
        <view class="result-loading" v-if="loading">
          <text>检索中…</text>
        </view>
      </scroll-view>

      <!-- 新增到药品库：录一次，以后都能搜到 -->
      <view class="manual-row" v-if="keyword && !loading && !adding" @tap="startAdd">
        <text class="manual-text">＋ 新增药品「{{ keyword }}」</text>
        <text class="manual-hint">存入药品库，下次可直接选</text>
      </view>

      <!-- 新增表单 -->
      <view class="add-form" v-if="adding">
        <view class="add-row">
          <text class="add-label">名称</text>
          <input class="add-input" v-model="newForm.genericName" placeholder="通用名，如 注射用头孢曲松钠" />
        </view>
        <view class="add-row">
          <text class="add-label">规格</text>
          <input class="add-input" v-model="newForm.spec" placeholder="如 0.9% 250ml:2.25g / 1g" />
        </view>
        <view class="add-row">
          <text class="add-label">别名</text>
          <input class="add-input" v-model="newForm.aliasNames" placeholder="选填，如 罗氏芬、头孢曲松" />
        </view>
        <view class="add-row">
          <text class="add-label">高警示</text>
          <view class="switch-row">
            <switch :checked="newForm.isHighAlert === 1" color="#cf1322" @change="onAlertChange" />
            <text class="switch-hint">氯化钾、胰岛素等需双人核对的药品</text>
          </view>
        </view>
        <view class="add-actions">
          <text class="btn-cancel" @tap="cancelAdd">取消</text>
          <text class="btn-save" @tap="submitAdd">{{ saving ? '保存中…' : '保存并选用' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { searchDrugsApi, saveDrugApi, updateDrugStatusApi } from '../api/dict'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: '输入药名或拼音首字母，如 tbgqs' },
  route: { type: String, default: '' },
  max: { type: Number, default: 5 }
})

const emit = defineEmits(['update:modelValue'])

const drugs = ref(Array.isArray(props.modelValue) ? props.modelValue : [])
const keyword = ref('')
const results = ref([])
const loading = ref(false)
const panelVisible = ref(false)
const focused = ref(false)
const adding = ref(false)
const saving = ref(false)
const newForm = reactive({ genericName: '', spec: '', aliasNames: '', isHighAlert: 0 })
let timer = null
let blurTimer = null
let seq = 0
// 正在点结果 / 正在填新增表单时，输入框失焦不能把面板收掉
let picking = false

// 父页面提交后会清空 form.drugs，这里必须跟随，否则 chip 会残留
watch(
  () => props.modelValue,
  (val) => {
    drugs.value = Array.isArray(val) ? val : []
  },
  { deep: true }
)

function sync(list) {
  drugs.value = list
  emit('update:modelValue', list)
}

function onInput() {
  adding.value = false
  if (timer) clearTimeout(timer)
  const kw = keyword.value.trim()
  // 删空了就收起来，别留一块空面板
  if (!kw) {
    results.value = []
    loading.value = false
    panelVisible.value = false
    return
  }
  panelVisible.value = true
  loading.value = true
  // 输入防抖，避免每个字符都打后端
  timer = setTimeout(() => doSearch(kw), 280)
}

function onFocus() {
  focused.value = true
  if (blurTimer) {
    clearTimeout(blurTimer)
    blurTimer = null
  }
  // 空输入不弹面板：一进来就糊一屏列表，反而挡住下面的表单
  const kw = keyword.value.trim()
  if (!kw) {
    panelVisible.value = false
    return
  }
  panelVisible.value = true
  // 结果还在就不用重复打后端，直接复用
  if (!results.value.length) doSearch(kw)
}

function onBlur() {
  focused.value = false
  if (blurTimer) clearTimeout(blurTimer)
  // 点结果项时 blur 会先于 tap 触发，延后一点再收，给 tap 留出时间
  blurTimer = setTimeout(() => {
    blurTimer = null
    if (picking || adding.value) return
    panelVisible.value = false
  }, 220)
}

function onConfirm() {
  if (results.value.length) {
    choose(results.value[0])
  } else if (keyword.value.trim()) {
    startAdd()
  }
}

async function doSearch(kw) {
  const current = ++seq
  loading.value = true
  try {
    const data = await searchDrugsApi(kw, { limit: 10, route: props.route })
    // 只接受最后一次请求的结果，防止旧响应覆盖新输入
    if (current !== seq) return
    results.value = Array.isArray(data) ? data : []
  } catch (e) {
    if (current === seq) results.value = []
  } finally {
    if (current === seq) loading.value = false
  }
}

async function choose(item, viaAdd = false) {
  if (!item) return
  picking = true
  try {
    if (drugs.value.length >= props.max) {
      uni.showToast({ title: `最多添加 ${props.max} 种药品`, icon: 'none' })
      return
    }
    const spec = item.spec || ''
    if (drugs.value.some((d) => d.name === item.genericName && d.spec === spec)) {
      uni.showToast({ title: '该药品已添加', icon: 'none' })
      return
    }
    if (item.highAlert === 1) {
      const ok = await confirmDialog('高警示药品',
        `「${item.genericName}」属于高警示药品，请核对剂量与给药途径后再登记。`, '已核对')
      if (!ok) return
    }
    if (item.pending) {
      const ok = await confirmDialog('规格待确认',
        `「${item.genericName} ${spec}」的规格来自候选数据，尚未核对。请确认与药瓶一致。`, '确认无误')
      if (!ok) return
      // 用过一次就当作核对过，之后不再反复提示
      if (item.id) updateDrugStatusApi(item.id, 1).catch(() => {})
    }
    sync([
      ...drugs.value,
      {
        id: item.id || null,
        name: item.genericName,
        spec,
        // 用量默认带出字典默认剂量，护士可改；没有就留空
        dose: item.defaultDose ? String(item.defaultDose) : '',
        unit: item.unit || '',
        route: item.route || props.route || '',
        highAlert: item.highAlert || 0,
        manual: false
      }
    ])
    resetKeyword()
    if (!viaAdd) adding.value = false
  } finally {
    picking = false
    // 选完（或点了取消）就收起面板，不要再挂在那儿
    if (!focused.value && !adding.value) panelVisible.value = false
  }
}

function startAdd() {
  const name = keyword.value.trim()
  if (!name) return
  if (drugs.value.length >= props.max) {
    uni.showToast({ title: `最多添加 ${props.max} 种药品`, icon: 'none' })
    return
  }
  newForm.genericName = name
  newForm.spec = ''
  newForm.aliasNames = ''
  newForm.isHighAlert = 0
  adding.value = true
  panelVisible.value = true
}

function cancelAdd() {
  adding.value = false
  // 取消新增时输入框已经失焦了，面板一起收掉，回到干净的搜索框
  if (!focused.value) panelVisible.value = false
}

function onAlertChange(e) {
  newForm.isHighAlert = e.detail.value ? 1 : 0
}

async function submitAdd() {
  if (saving.value) return
  if (!newForm.genericName.trim()) {
    uni.showToast({ title: '请填写药品名称', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const vo = await saveDrugApi({
      genericName: newForm.genericName.trim(),
      spec: newForm.spec.trim(),
      aliasNames: newForm.aliasNames.trim(),
      isHighAlert: newForm.isHighAlert
    })
    if (!vo) {
      uni.showToast({ title: '保存失败，请重试', icon: 'none' })
      return
    }
    uni.showToast({ title: '已存入药品库', icon: 'none' })
    adding.value = false
    await choose(vo, true)
  } catch (e) {
    // request 层已提示，这里只兜住不中断
  } finally {
    saving.value = false
  }
}

function removeAt(index) {
  const list = drugs.value.slice()
  list.splice(index, 1)
  sync(list)
}

// 用量逐条录入：不改原对象，复制后替换，避免直接改父级 props
function onDoseInput(index, e) {
  const val = e && e.detail ? e.detail.value : ''
  const list = drugs.value.slice()
  if (!list[index]) return
  list[index] = { ...list[index], dose: val }
  sync(list)
}

function resetKeyword() {
  keyword.value = ''
  results.value = []
  panelVisible.value = false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  // 选完就把键盘收了，别让它继续挡着下面的表单
  try {
    uni.hideKeyboard()
  } catch (e) {
    // H5 下可能不支持，忽略
  }
}

function confirmDialog(title, content, confirmText) {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      content,
      confirmText,
      cancelText: '返回',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
}
</script>

<style scoped>
.drug-picker {
  width: 100%;
}

.selected-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.drug-chip {
  display: flex;
  align-items: center;
  background: #e6f4ff;
  border: 1rpx solid #91caff;
  border-radius: 10rpx;
  padding: 12rpx 16rpx;
  max-width: 100%;
}

.chip-danger {
  background: #fff1f0;
  border-color: #ffa39e;
}

.chip-manual {
  background: #fffbe6;
  border-color: #ffe58f;
}

.chip-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.chip-name {
  font-size: 26rpx;
  color: #0958d9;
  font-weight: 500;
}

.chip-danger .chip-name {
  color: #cf1322;
}

.chip-manual .chip-name {
  color: #ad6800;
}

.chip-spec {
  font-size: 22rpx;
  color: #595959;
  margin-top: 2rpx;
}

.chip-dose-row {
  display: flex;
  align-items: center;
  margin-top: 8rpx;
}

.chip-dose-input {
  width: 150rpx;
  height: 42rpx;
  min-height: 42rpx;
  line-height: 42rpx;
  font-size: 22rpx;
  color: #262626;
  background: #ffffff;
  border: 1rpx solid #d9d9d9;
  border-radius: 6rpx;
  padding: 0 8rpx;
  box-sizing: border-box;
}

.chip-danger .chip-dose-input {
  border-color: #ffa39e;
}

.chip-dose-unit {
  font-size: 20rpx;
  color: #8c8c8c;
  margin-left: 6rpx;
}

.chip-dose-ph {
  color: #bfbfbf;
  font-size: 20rpx;
}

.chip-flag {
  font-size: 20rpx;
  color: #cf1322;
  margin-top: 2rpx;
}

.chip-flag.manual {
  color: #ad6800;
}

.chip-del {
  font-size: 34rpx;
  color: #8c8c8c;
  padding: 0 4rpx 0 16rpx;
  line-height: 1;
}

.search-box {
  display: flex;
  align-items: center;
  background: #f5f7fa;
  border: 1rpx solid #e8e8e8;
  border-radius: 10rpx;
  padding: 0 16rpx;
  height: 80rpx;
}

.search-icon {
  font-size: 26rpx;
  margin-right: 10rpx;
  opacity: 0.6;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  height: 80rpx;
}

.ph {
  color: #bfbfbf;
  font-size: 26rpx;
}

.clear-btn {
  font-size: 24rpx;
  color: #8c8c8c;
  padding-left: 12rpx;
}

.result-panel {
  margin-top: 12rpx;
  background: #ffffff;
  border: 1rpx solid #e8e8e8;
  border-radius: 10rpx;
  overflow: hidden;
}

.result-scroll {
  max-height: 520rpx;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.result-item:last-child {
  border-bottom: none;
}

.r-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.r-name {
  font-size: 28rpx;
  color: #262626;
}

.r-spec {
  font-size: 22rpx;
  color: #8c8c8c;
  margin-top: 4rpx;
}

.r-tag {
  font-size: 20rpx;
  color: #cf1322;
  background: #fff1f0;
  border-radius: 6rpx;
  padding: 4rpx 10rpx;
  margin-left: 12rpx;
}

.r-tag.pending {
  color: #ad6800;
  background: #fffbe6;
}

.result-empty,
.result-loading {
  padding: 28rpx 20rpx;
  text-align: center;
  font-size: 24rpx;
  color: #bfbfbf;
}

.manual-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx;
  background: #f6ffed;
  border-top: 1rpx solid #b7eb8f;
}

.manual-text {
  font-size: 26rpx;
  color: #237804;
}

.manual-hint {
  font-size: 20rpx;
  color: #52c41a;
}

.add-form {
  padding: 20rpx;
  background: #fafafa;
  border-top: 1rpx solid #e8e8e8;
}

.add-row {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
}

.add-label {
  width: 100rpx;
  font-size: 26rpx;
  color: #595959;
}

.add-input {
  flex: 1;
  height: 64rpx;
  background: #ffffff;
  border: 1rpx solid #e8e8e8;
  border-radius: 8rpx;
  padding: 0 14rpx;
  font-size: 26rpx;
}

.switch-row {
  display: flex;
  align-items: center;
  flex: 1;
}

.switch-hint {
  font-size: 20rpx;
  color: #8c8c8c;
  margin-left: 8rpx;
  flex: 1;
}

.add-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 12rpx;
}

.btn-cancel {
  font-size: 26rpx;
  color: #8c8c8c;
  padding: 12rpx 24rpx;
}

.btn-save {
  font-size: 26rpx;
  color: #ffffff;
  background: #1677ff;
  border-radius: 8rpx;
  padding: 12rpx 28rpx;
}
</style>
