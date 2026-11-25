<template>
  <view class="page">
    <view class="toolbar">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          v-model="keyword"
          placeholder="药名 / 拼音首字母"
          placeholder-class="ph"
          confirm-type="search"
          @input="onInput"
        />
        <text class="clear-btn" v-if="keyword" @tap="clearKw">清空</text>
      </view>
      <text class="add-btn" @tap="openAdd">＋ 新增</text>
    </view>

    <view class="summary">
      <text>共 {{ total }} 条 · 每页 {{ size }} 条</text>
      <text class="summary-hint">待确认的药品选用时会提示核对规格</text>
    </view>

    <scroll-view scroll-y class="list">
      <view class="item" v-for="d in list" :key="d.id">
        <view class="item-main" @tap="openEdit(d)">
          <view class="line1">
            <text :class="['name', d.status === 2 ? 'name-off' : '']">{{ d.genericName }}</text>
            <text class="tag danger" v-if="d.highAlert === 1">高警示</text>
            <text class="tag warn" v-if="d.pending">待确认</text>
            <text class="tag mute" v-if="d.status === 2">已停用</text>
          </view>
          <text class="spec">{{ d.spec || '未填规格' }}</text>
          <text class="alias" v-if="d.aliasNames">别名：{{ d.aliasNames }}</text>
          <text class="alias" v-if="d.tradeName">商品名：{{ d.tradeName }}</text>
        </view>
        <view class="item-ops">
          <text class="op" @tap.stop="toggle(d)">{{ d.status === 2 ? '启用' : '停用' }}</text>
          <text class="op op-danger" @tap.stop="remove(d)">删除</text>
        </view>
      </view>

      <view class="empty" v-if="!loading && !list.length">
        <text>{{ keyword ? '没有匹配的药品' : '药品库还是空的，点右上角新增' }}</text>
      </view>
      <view class="loading" v-if="loading"><text>加载中…</text></view>
    </scroll-view>

    <!-- 分页条：页码直翻，避免滚到底才知道还有下一页 -->
    <view class="pager">
      <text :class="['pager-btn', page <= 1 ? 'pager-btn-off' : '']" @tap="goPage(page - 1)">‹ 上一页</text>
      <text class="pager-info">{{ page }} / {{ pageCount }}</text>
      <text :class="['pager-btn', page >= pageCount ? 'pager-btn-off' : '']" @tap="goPage(page + 1)">下一页 ›</text>
    </view>

    <!-- 新增 / 编辑 -->
    <view class="mask" v-if="sheetVisible" @tap="sheetVisible = false"></view>
    <view class="sheet" v-if="sheetVisible">
      <view class="sheet-title">{{ form.id ? '编辑药品' : '新增药品' }}</view>
      <view class="sheet-row">
        <text class="label">名称</text>
        <input class="input" v-model="form.genericName" placeholder="通用名，如 氯化钠注射液" />
      </view>
      <view class="sheet-row">
        <text class="label">规格</text>
        <input class="input" v-model="form.spec" placeholder="如 0.9% 250ml:2.25g / 1g" />
      </view>
      <view class="sheet-row">
        <text class="label">别名</text>
        <input class="input" v-model="form.aliasNames" placeholder="选填，逗号分隔，如 生理盐水,NS" />
      </view>
      <view class="sheet-row">
        <text class="label">商品名</text>
        <input class="input" v-model="form.tradeName" placeholder="选填，如 罗氏芬" />
      </view>
      <view class="sheet-row">
        <text class="label">高警示</text>
        <view class="switch-row">
          <switch :checked="form.isHighAlert === 1" color="#cf1322" @change="onAlertChange" />
          <text class="switch-hint">选用时强制二次确认</text>
        </view>
      </view>
      <view class="sheet-actions">
        <text class="btn-cancel" @tap="sheetVisible = false">取消</text>
        <text class="btn-save" @tap="submit">{{ saving ? '保存中…' : '保存' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getDrugLibraryApi, saveDrugApi, updateDrugStatusApi, deleteDrugApi } from '../../api/dict'

const keyword = ref('')
const list = ref([])
const total = ref(0)
const page = ref(1)
const size = 20
const loading = ref(false)
const sheetVisible = ref(false)
const saving = ref(false)

const pageCount = computed(() => {
  const n = Math.ceil(total.value / size)
  return n > 0 ? n : 1
})

const form = reactive({
  id: null,
  genericName: '',
  spec: '',
  aliasNames: '',
  tradeName: '',
  isHighAlert: 0
})

let timer = null

onShow(() => {
  reload()
})

function onInput() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => reload(), 300)
}

function clearKw() {
  keyword.value = ''
  reload()
}

async function fetchPage(p) {
  if (loading.value) return
  const target = Math.min(Math.max(1, p), pageCount.value)
  loading.value = true
  try {
    const data = await getDrugLibraryApi({ kw: keyword.value.trim(), page: target, size })
    const rows = (data && data.list) || []
    total.value = (data && data.total) || 0
    list.value = rows
    page.value = target
    // 删到本页空了就往前退一页，别让用户停在空白页
    if (!rows.length && target > 1 && total.value > 0) {
      loading.value = false
      return fetchPage(target - 1)
    }
  } catch (e) {
    if (target === 1) list.value = []
  } finally {
    loading.value = false
  }
}

function reload() {
  fetchPage(1)
}

function goPage(p) {
  if (loading.value) return
  if (p < 1 || p > pageCount.value || p === page.value) return
  fetchPage(p)
}

function openAdd() {
  form.id = null
  form.genericName = keyword.value.trim()
  form.spec = ''
  form.aliasNames = ''
  form.tradeName = ''
  form.isHighAlert = 0
  sheetVisible.value = true
}

function openEdit(d) {
  form.id = d.id
  form.genericName = d.genericName || ''
  form.spec = d.spec || ''
  form.aliasNames = d.aliasNames || ''
  form.tradeName = d.tradeName || ''
  form.isHighAlert = d.highAlert === 1 ? 1 : 0
  sheetVisible.value = true
}

function onAlertChange(e) {
  form.isHighAlert = e.detail.value ? 1 : 0
}

async function submit() {
  if (saving.value) return
  if (!form.genericName.trim()) {
    uni.showToast({ title: '请填写药品名称', icon: 'none' })
    return
  }
  saving.value = true
  try {
    await saveDrugApi({
      id: form.id,
      genericName: form.genericName.trim(),
      spec: form.spec.trim(),
      aliasNames: form.aliasNames.trim(),
      tradeName: form.tradeName.trim(),
      isHighAlert: form.isHighAlert
    })
    sheetVisible.value = false
    uni.showToast({ title: '已保存', icon: 'none' })
    // 拼音与排序在服务端已更新，重新拉当前页保证顺序正确
    fetchPage(page.value)
  } catch (e) {
    // request 层已给出提示
  } finally {
    saving.value = false
  }
}

async function toggle(d) {
  const next = d.status === 2 ? 1 : 2
  try {
    await updateDrugStatusApi(d.id, next)
    d.status = next
    d.pending = false
    uni.showToast({ title: next === 2 ? '已停用' : '已启用', icon: 'none' })
  } catch (e) {
    // ignore
  }
}

function remove(d) {
  uni.showModal({
    title: '删除药品',
    content: `确定删除「${d.genericName} ${d.spec || ''}」？历史补液记录不受影响。`,
    confirmText: '删除',
    confirmColor: '#cf1322',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await deleteDrugApi(d.id)
        uni.showToast({ title: '已删除', icon: 'none' })
        // 删完重拉当前页，总数与分页同步
        fetchPage(page.value)
      } catch (e) {
        // ignore
      }
    }
  })
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f7fa;
}

.toolbar {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx 12rpx;
}

.search-box {
  display: flex;
  align-items: center;
  flex: 1;
  height: 76rpx;
  background: #ffffff;
  border-radius: 10rpx;
  padding: 0 16rpx;
}

.search-icon {
  font-size: 26rpx;
  opacity: 0.5;
  margin-right: 8rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
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

.add-btn {
  margin-left: 16rpx;
  font-size: 26rpx;
  color: #ffffff;
  background: #1677ff;
  border-radius: 10rpx;
  padding: 18rpx 24rpx;
}

.summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4rpx 28rpx 12rpx;
  font-size: 22rpx;
  color: #8c8c8c;
}

.summary-hint {
  color: #bfbfbf;
}

.list {
  flex: 1;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.item {
  display: flex;
  align-items: center;
  background: #ffffff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 14rpx;
}

.item-main {
  flex: 1;
  min-width: 0;
}

.line1 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
}

.name {
  font-size: 28rpx;
  color: #262626;
  font-weight: 500;
}

.name-off {
  color: #bfbfbf;
  text-decoration: line-through;
}

.tag {
  font-size: 20rpx;
  border-radius: 6rpx;
  padding: 3rpx 8rpx;
}

.tag.danger {
  color: #cf1322;
  background: #fff1f0;
}

.tag.warn {
  color: #ad6800;
  background: #fffbe6;
}

.tag.mute {
  color: #8c8c8c;
  background: #f5f5f5;
}

.spec {
  display: block;
  font-size: 24rpx;
  color: #595959;
  margin-top: 8rpx;
}

.alias {
  display: block;
  font-size: 22rpx;
  color: #a6a6a6;
  margin-top: 4rpx;
}

.item-ops {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10rpx;
  margin-left: 16rpx;
}

.op {
  font-size: 24rpx;
  color: #1677ff;
  padding: 6rpx 4rpx;
}

.op-danger {
  color: #cf1322;
}

.empty,
.loading {
  padding: 40rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #bfbfbf;
}

/* 底部页码条 */
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 28rpx calc(16rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: 1rpx solid #ededed;
}

.pager-btn {
  font-size: 26rpx;
  color: #1677ff;
  padding: 10rpx 20rpx;
  border: 1rpx solid #d6e4ff;
  border-radius: 8rpx;
  background: #f5f8ff;
}

.pager-btn-off {
  color: #c8c8c8;
  border-color: #ededed;
  background: #fafafa;
}

.pager-info {
  font-size: 26rpx;
  color: #595959;
  font-variant-numeric: tabular-nums;
}

.mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 10;
}

.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 11;
  background: #ffffff;
  border-radius: 20rpx 20rpx 0 0;
  padding: 28rpx 28rpx 40rpx;
}

.sheet-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #262626;
  margin-bottom: 20rpx;
}

.sheet-row {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
}

.label {
  width: 110rpx;
  font-size: 26rpx;
  color: #595959;
}

.input {
  flex: 1;
  height: 68rpx;
  background: #fafafa;
  border: 1rpx solid #eee;
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
  font-size: 22rpx;
  color: #8c8c8c;
  margin-left: 10rpx;
}

.sheet-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 20rpx;
}

.btn-cancel {
  font-size: 28rpx;
  color: #8c8c8c;
  padding: 16rpx 28rpx;
}

.btn-save {
  font-size: 28rpx;
  color: #ffffff;
  background: #1677ff;
  border-radius: 10rpx;
  padding: 16rpx 36rpx;
}
</style>
