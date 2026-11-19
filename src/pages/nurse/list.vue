<template>
  <view class="container">
    <!-- 顶部概览卡片 -->
    <view class="overview-card">
      <view class="ov-left">
        <view class="ov-title">科室护士名册</view>
        <view class="ov-sub">共 {{ nurseList.length }} 名医护 • 已绑微信 {{ boundCount }} 人</view>
      </view>
      <button class="add-btn" type="primary" size="mini" @tap="openAddModal">+ 新增护士</button>
    </view>

    <!-- 护士列表 -->
    <view class="nurse-list">
      <view class="nurse-card" v-for="nurse in nurseList" :key="nurse.id">
        <view class="nc-header">
          <view class="nc-main-info">
            <text class="nurse-name">{{ nurse.realName }}</text>
            <text :class="['role-tag', nurse.role === 'HEAD_NURSE' ? 'head' : 'nurse']">
              {{ nurse.role === 'HEAD_NURSE' ? '护士长' : '护士' }}
            </text>
            <text :class="['bind-tag', nurse.isBound ? 'bound' : 'unbound']">
              {{ nurse.isBound ? '已绑微信' : '未绑微信' }}
            </text>
            <text class="status-tag" v-if="nurse.status === 0">已停用</text>
          </view>
          <view class="job-no">工号: {{ nurse.jobNumber }}</view>
        </view>

        <view class="nc-meta-line">
          <text class="meta-item">🏥 {{ nurse.hospitalName || '上海市第一人民医院' }}</text>
          <text class="meta-item">🩺 {{ nurse.department || '心血管内科' }}</text>
          <text class="meta-item" v-if="nurse.phone">📞 {{ nurse.phone }}</text>
        </view>

        <!-- 负责床位统计区 -->
        <view class="nc-assign-box">
          <view class="assign-stat">
            <text class="stat-label">负责床位：</text>
            <text class="stat-val highlight">{{ nurse.assignedBedCount || 0 }} 张床位</text>
          </view>
          <view class="assign-stat">
            <text class="stat-label">在管病患：</text>
            <text class="stat-val">{{ nurse.assignedPatientCount || 0 }} 人</text>
          </view>
        </view>

        <!-- 操作按钮栏 -->
        <view class="nc-actions">
          <!-- 只有普通护士需要分配床位，护士长管全科室 -->
          <button 
            v-if="nurse.role !== 'HEAD_NURSE'" 
            class="act-btn primary" 
            size="mini" 
            @tap="goToAssign(nurse)"
          >
            📋 分配床位
          </button>
          <button class="act-btn outline" size="mini" @tap="openEditModal(nurse)">编辑</button>
          <button 
            v-if="nurse.isBound" 
            class="act-btn warn" 
            size="mini" 
            @tap="handleUnbindWechat(nurse)"
          >
            解绑微信
          </button>
          <button 
            v-if="nurse.role !== 'HEAD_NURSE'" 
            :class="['act-btn', nurse.status === 1 ? 'danger' : 'green']" 
            size="mini" 
            @tap="handleToggleStatus(nurse)"
          >
            {{ nurse.status === 1 ? '停用' : '启用' }}
          </button>
        </view>
      </view>
    </view>

    <!-- 新增 / 编辑护士弹窗 -->
    <view class="modal-mask" v-if="showModal" @tap.self="showModal = false">
      <view class="modal-box">
        <view class="modal-title">{{ isEdit ? '编辑护士信息' : '新增护士档案' }}</view>

        <view class="form-group">
          <text class="form-label">所属医院 *</text>
          <picker :range="hospitalList" range-key="hospitalName" @change="onModalHospitalPick">
            <view class="form-picker">
              {{ formHospital?.hospitalName || '请选择医院' }}
              <text class="arrow">▼</text>
            </view>
          </picker>
        </view>

        <view class="form-group">
          <text class="form-label">所属科室 *</text>
          <picker :range="modalDeptList" range-key="deptName" @change="onModalDeptPick">
            <view class="form-picker">
              {{ formDept?.deptName || '请选择科室' }}
              <text class="arrow">▼</text>
            </view>
          </picker>
        </view>

        <view class="form-group">
          <text class="form-label">护士姓名 *</text>
          <input class="form-input" v-model="formNurse.realName" placeholder="如：李丽" placeholder-class="input-placeholder" />
        </view>

        <view class="form-group">
          <text class="form-label">6位纯数字工号 *</text>
          <input 
            class="form-input" 
            type="number" 
            maxlength="6" 
            :disabled="isEdit"
            v-model="formNurse.jobNumber" 
            placeholder="必须为6位纯数字" 
            placeholder-class="input-placeholder" 
          />
        </view>

        <view class="form-group">
          <text class="form-label">联系手机</text>
          <input class="form-input" type="number" maxlength="11" v-model="formNurse.phone" placeholder="选填，护士手机号" placeholder-class="input-placeholder" />
        </view>

        <view class="modal-btns">
          <button class="m-btn cancel" @tap="showModal = false">取消</button>
          <button class="m-btn confirm" type="primary" :loading="submitLoading" @tap="handleSubmitNurse">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onPullDownRefresh } from '@dcloudio/uni-app'
import { getManageNursesApi, saveNurseApi, toggleNurseStatusApi, unbindNurseWechatApi } from '../../api/nurse'
import { getHospitalsApi } from '../../api/dict'

const nurseList = ref([])
const hospitalList = ref([])
const showModal = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)

const formHospital = ref(null)
const formDept = ref(null)
const modalDeptList = ref([])

const formNurse = ref({
  id: null,
  jobNumber: '',
  realName: '',
  phone: '',
  hospitalId: null,
  deptId: null
})

const boundCount = computed(() => {
  return nurseList.value.filter(n => n.isBound).length
})

async function loadDicts() {
  try {
    const list = await getHospitalsApi()
    hospitalList.value = list || []
    if (hospitalList.value.length > 0) {
      formHospital.value = hospitalList.value[0]
      modalDeptList.value = formHospital.value.departments || []
      if (modalDeptList.value.length > 0) {
        formDept.value = modalDeptList.value[0]
      }
    }
  } catch (e) {
    console.error(e)
  }
}

async function loadNurses() {
  try {
    const data = await getManageNursesApi()
    nurseList.value = data || []
  } catch (e) {
    console.error(e)
  }
}

function openAddModal() {
  isEdit.value = false
  if (hospitalList.value.length > 0) {
    formHospital.value = hospitalList.value[0]
    modalDeptList.value = formHospital.value.departments || []
    formDept.value = modalDeptList.value.length > 0 ? modalDeptList.value[0] : null
  }
  formNurse.value = {
    id: null,
    jobNumber: '',
    realName: '',
    phone: '',
    hospitalId: formHospital.value?.id,
    deptId: formDept.value?.id
  }
  showModal.value = true
}

function openEditModal(nurse) {
  isEdit.value = true
  const h = hospitalList.value.find(item => item.id === nurse.hospitalId) || hospitalList.value[0]
  formHospital.value = h
  modalDeptList.value = h?.departments || []
  const d = modalDeptList.value.find(item => item.id === nurse.deptId) || modalDeptList.value[0]
  formDept.value = d

  formNurse.value = {
    id: nurse.id,
    jobNumber: nurse.jobNumber,
    realName: nurse.realName,
    phone: nurse.phone || '',
    hospitalId: h?.id,
    deptId: d?.id
  }
  showModal.value = true
}

function onModalHospitalPick(e) {
  const idx = e.detail.value
  const h = hospitalList.value[idx]
  if (h) {
    formHospital.value = h
    modalDeptList.value = h.departments || []
    formDept.value = modalDeptList.value.length > 0 ? modalDeptList.value[0] : null
    formNurse.value.hospitalId = h.id
    formNurse.value.deptId = formDept.value?.id
  }
}

function onModalDeptPick(e) {
  const idx = e.detail.value
  const d = modalDeptList.value[idx]
  if (d) {
    formDept.value = d
    formNurse.value.deptId = d.id
  }
}

async function handleSubmitNurse() {
  if (!formNurse.value.realName.trim()) {
    uni.showToast({ title: '请输入护士姓名', icon: 'none' })
    return
  }
  if (!formNurse.value.jobNumber || formNurse.value.jobNumber.length !== 6) {
    uni.showToast({ title: '工号必须为6位纯数字', icon: 'none' })
    return
  }

  submitLoading.value = true
  try {
    await saveNurseApi({
      ...formNurse.value,
      hospitalId: formHospital.value?.id,
      deptId: formDept.value?.id
    })
    uni.showToast({ title: isEdit.value ? '修改成功' : '新增护士成功', icon: 'success' })
    showModal.value = false
    loadNurses()
  } catch (e) {
    console.error(e)
  } finally {
    submitLoading.value = false
  }
}

function goToAssign(nurse) {
  uni.navigateTo({
    url: `/pages/nurse/assign?nurseId=${nurse.id}&nurseName=${encodeURIComponent(nurse.realName)}&jobNumber=${nurse.jobNumber}`
  })
}

function handleUnbindWechat(nurse) {
  uni.showModal({
    title: '确认解绑微信',
    content: `确定要为 ${nurse.realName}（工号: ${nurse.jobNumber}）解除绑定的微信吗？解除后该工号可由护士重新扫码绑定。`,
    confirmText: '确认解绑',
    confirmColor: '#fa8c16',
    success: async (res) => {
      if (res.confirm) {
        await unbindNurseWechatApi(nurse.id)
        uni.showToast({ title: '已成功解绑微信', icon: 'success' })
        loadNurses()
      }
    }
  })
}

function handleToggleStatus(nurse) {
  const actionText = nurse.status === 1 ? '停用' : '启用'
  uni.showModal({
    title: `确认${actionText}护士`,
    content: `确定要${actionText}【${nurse.realName}】账号吗？`,
    success: async (res) => {
      if (res.confirm) {
        await toggleNurseStatusApi(nurse.id)
        uni.showToast({ title: `已${actionText}`, icon: 'success' })
        loadNurses()
      }
    }
  })
}

onMounted(() => {
  loadDicts()
  loadNurses()
})

onPullDownRefresh(async () => {
  await loadNurses()
  uni.stopPullDownRefresh()
})
</script>

<style>
.container {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 24rpx;
  box-sizing: border-box;
}

.overview-card {
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  border-radius: 20rpx;
  padding: 32rpx;
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(22, 119, 255, 0.25);
}

.ov-title {
  font-size: 34rpx;
  font-weight: bold;
  margin-bottom: 8rpx;
}

.ov-sub {
  font-size: 24rpx;
  opacity: 0.85;
}

.add-btn {
  background-color: #ffffff !important;
  color: #1677ff !important;
  font-weight: bold;
  border-radius: 30rpx;
  font-size: 26rpx;
  padding: 0 24rpx;
}

.nurse-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.nurse-card {
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.nc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.nc-main-info {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.nurse-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #1a1a1a;
}

.role-tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.role-tag.head {
  background-color: #fff7e6;
  color: #fa8c16;
}

.role-tag.nurse {
  background-color: #e6f4ff;
  color: #1677ff;
}

.bind-tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.bind-tag.bound {
  background-color: #f6ffed;
  color: #52c41a;
}

.bind-tag.unbound {
  background-color: #f5f5f5;
  color: #8c8c8c;
}

.status-tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  background-color: #fff1f0;
  color: #ff4d4f;
  border-radius: 6rpx;
}

.job-no {
  font-size: 26rpx;
  color: #595959;
  font-weight: 500;
}

.nc-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  font-size: 24rpx;
  color: #8c8c8c;
  margin-bottom: 20rpx;
}

.nc-assign-box {
  background-color: #fafafa;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  display: flex;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.assign-stat {
  display: flex;
  align-items: center;
}

.stat-label {
  font-size: 24rpx;
  color: #8c8c8c;
}

.stat-val {
  font-size: 26rpx;
  font-weight: bold;
  color: #262626;
}

.stat-val.highlight {
  color: #1677ff;
}

.nc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
}

.act-btn {
  margin: 0 !important;
  font-size: 24rpx;
  border-radius: 24rpx;
}

.act-btn.primary {
  background-color: #1677ff;
  color: #ffffff;
}

.act-btn.outline {
  background-color: #f0f0f0;
  color: #333333;
}

.act-btn.warn {
  background-color: #fff7e6;
  color: #d46b08;
  border: 1rpx solid #ffd591;
}

.act-btn.danger {
  background-color: #fff1f0;
  color: #cf1322;
}

.act-btn.green {
  background-color: #f6ffed;
  color: #389e0d;
}

/* 弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-box {
  width: 650rpx;
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 40rpx 32rpx;
  box-sizing: border-box;
}

.modal-title {
  font-size: 34rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 32rpx;
  color: #1a1a1a;
}

.form-group {
  margin-bottom: 24rpx;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: #262626;
  font-weight: 500;
  margin-bottom: 10rpx;
}

.form-input, .form-picker {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  background-color: #fafafa;
  border: 2rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: #333333;
  box-sizing: border-box;
}

.form-picker {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-placeholder {
  color: #bfbfbf;
  line-height: 84rpx;
  font-size: 28rpx;
}

.arrow {
  color: #bfbfbf;
  font-size: 20rpx;
}

.modal-btns {
  display: flex;
  gap: 20rpx;
  margin-top: 36rpx;
}

.m-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
  border-radius: 40rpx;
}

.m-btn.cancel {
  background-color: #f5f5f5;
  color: #595959;
}

.m-btn.confirm {
  background-color: #1677ff;
  color: #ffffff;
}
</style>
