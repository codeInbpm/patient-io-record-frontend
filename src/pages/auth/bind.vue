<template>
  <view class="container">
    <view class="header">
      <view class="logo-box">🏥</view>
      <text class="title">身份绑定与核验</text>
      <text class="subtitle">出入量记录助手需严格核实真实身份后使用</text>
    </view>

    <!-- 角色类型切换选项卡 -->
    <view class="tab-card">
      <view 
        :class="['tab-item', activeTab === 'nurse' ? 'active' : '']"
        @tap="activeTab = 'nurse'"
      >
        👩‍⚕️ 医护人员绑定
      </view>
      <view 
        :class="['tab-item', activeTab === 'patient' ? 'active' : '']"
        @tap="activeTab = 'patient'"
      >
        🛏️ 患者/家属绑定
      </view>
    </view>

    <!-- 医护人员绑定表单 -->
    <view class="form-card" v-if="activeTab === 'nurse'">
      <view class="form-desc">
        请选择您所在的医疗机构与科室，并输入分配的 <text class="highlight">6位纯数字工号</text>。
      </view>

      <!-- 医院下拉筛选 -->
      <view class="input-group">
        <text class="label">所属医院 *</text>
        <picker :range="hospitalList" range-key="hospitalName" @change="onHospitalPick">
          <view class="picker-input">
            {{ selectedHospital?.hospitalName || '点击选择所在医院' }}
            <text class="arrow">▼</text>
          </view>
        </picker>
      </view>

      <!-- 科室下拉筛选 -->
      <view class="input-group">
        <text class="label">所属科室 *</text>
        <picker :range="currentDeptList" range-key="deptName" @change="onDeptPick">
          <view class="picker-input">
            {{ selectedDept?.deptName || (currentDeptList.length > 0 ? '点击选择所在科室' : '该院暂无科室') }}
            <text class="arrow">▼</text>
          </view>
        </picker>
      </view>

      <!-- 工号输入 -->
      <view class="input-group">
        <text class="label">医护工号 (6位数字) *</text>
        <input 
          class="input" 
          type="number" 
          maxlength="6" 
          v-model="nurseForm.jobNumber" 
          placeholder="请输入您的6位工号" 
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="preset-tip">
        <text class="p-title">💡 提示：系统预置演示工号</text>
        <text class="p-item" @tap="fillDemoNurse('100001')">• 护士长工号：100001 (张洁护士长，拥有全部管理权限)</text>
        <text class="p-item" @tap="fillDemoNurse('100002')">• 护士工号：100002 (李丽护士，负责01床)</text>
        <text class="p-item" @tap="fillDemoNurse('100003')">• 护士工号：100003 (王芳护士，负责02床)</text>
      </view>

      <button class="submit-btn" type="primary" :loading="loading" @tap="handleNurseBind">
        核验工号并绑定
      </button>
    </view>

    <!-- 患者/家属绑定表单 -->
    <view class="form-card" v-if="activeTab === 'patient'">
      <view class="form-desc">
        根据临床安全规范，请填写住院病患真实姓名、所属楼宇/病区、床位号及住院号，系统将进行精确核验。
      </view>

      <!-- 1. 真实姓名 -->
      <view class="input-group">
        <text class="label">真实姓名 *</text>
        <input class="input" v-model="patientForm.patientName" placeholder="如：李建国" placeholder-class="input-placeholder" />
      </view>

      <!-- 2. 所属楼宇/病区（已启用） -->
      <view class="input-group">
        <text class="label">所属楼宇/病区 (已启用) *</text>
        <picker :range="wardList" range-key="displayLabel" @change="onWardPick">
          <view class="picker-input">
            {{ selectedWardName || '点击选择住院病区' }}
            <text class="arrow">▼</text>
          </view>
        </picker>
      </view>

      <!-- 3. 床位号 (下拉选择) -->
      <view class="input-group">
        <text class="label">床位号 (下拉选择) *</text>
        <picker :range="bedList" range-key="displayLabel" @change="onBedPick">
          <view class="picker-input">
            {{ selectedBedName || (bedList.length > 0 ? '点击下拉选择床位号' : '当前病区暂无空床/床位') }}
            <text class="arrow">▼</text>
          </view>
        </picker>
      </view>

      <!-- 4. 住院号 (手动输入) -->
      <view class="input-group">
        <text class="label">住院号 (手动输入) *</text>
        <input class="input" v-model="patientForm.hospitalNo" placeholder="如：ZY202611001" placeholder-class="input-placeholder" />
      </view>

      <view class="preset-tip">
        <text class="p-title">💡 提示：点击可快速填入后台在院病患测试</text>
        <text class="p-item" @tap="fillDemoPatient('李建国', 36, '1床', 'ZY202611001')">• 李建国：7#19B消化内科三病区 - 1床 (ZY202611001)</text>
        <text class="p-item" @tap="fillDemoPatient('王秀英', 36, '5床', 'ZY202611002')">• 王秀英：7#19B消化内科三病区 - 5床 (ZY202611002)</text>
        <text class="p-item" @tap="fillDemoPatient('新患者', 36, '6床', 'ZY202611003')">• 新患者：7#19B消化内科三病区 - 6床 (ZY202611003)</text>
      </view>

      <button class="submit-btn patient-btn" type="primary" :loading="loading" @tap="handlePatientBind">
        核验病患身份并登录
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '../../stores/user'
import { bindNurseApi, bindPatientApi } from '../../api/auth'
import { getWardsApi } from '../../api/ward'
import { getHospitalsApi } from '../../api/dict'
import { getBedsByWardApi } from '../../api/bed'
import { syncRoleTabBar } from '../../utils/tabbar'

const userStore = useUserStore()
const activeTab = ref('nurse')
const loading = ref(false)

// 医院与科室字典
const hospitalList = ref([])
const currentDeptList = ref([])
const selectedHospital = ref(null)
const selectedDept = ref(null)

const nurseForm = ref({
  jobNumber: '',
  hospitalId: null,
  deptId: null
})

const patientForm = ref({
  patientName: '',
  wardId: null,
  bedNo: '',
  bedId: null,
  hospitalNo: ''
})

const wardList = ref([])
const selectedWardName = ref('')
const bedList = ref([])
const selectedBedName = ref('')

async function loadDicts() {
  try {
    const list = await getHospitalsApi()
    hospitalList.value = list || []
    if (hospitalList.value.length > 0) {
      selectedHospital.value = hospitalList.value[0]
      nurseForm.value.hospitalId = selectedHospital.value.id
      currentDeptList.value = selectedHospital.value.departments || []
      if (currentDeptList.value.length > 0) {
        selectedDept.value = currentDeptList.value[0]
        nurseForm.value.deptId = selectedDept.value.id
      }
    }
  } catch (e) {
    console.error('加载医院科室字典异常:', e)
  }
}

function onHospitalPick(e) {
  const idx = e.detail.value
  const h = hospitalList.value[idx]
  if (h) {
    selectedHospital.value = h
    nurseForm.value.hospitalId = h.id
    currentDeptList.value = h.departments || []
    if (currentDeptList.value.length > 0) {
      selectedDept.value = currentDeptList.value[0]
      nurseForm.value.deptId = selectedDept.value.id
    } else {
      selectedDept.value = null
      nurseForm.value.deptId = null
    }
  }
}

function onDeptPick(e) {
  const idx = e.detail.value
  const d = currentDeptList.value[idx]
  if (d) {
    selectedDept.value = d
    nurseForm.value.deptId = d.id
  }
}

function fillDemoNurse(jobNo) {
  nurseForm.value.jobNumber = jobNo
}

async function loadWards() {
  try {
    const list = await getWardsApi({ status: 1 })
    // 只取已启用的病区
    const activeList = (list || []).filter(w => w.status === undefined || w.status === 1)
    wardList.value = activeList.map(w => ({
      ...w,
      displayLabel: `${w.wardName}${w.building ? ' (' + w.building + ')' : ''}`
    }))
    if (wardList.value.length > 0) {
      // 优先默认选中 7#19B消化内科三病区 或 首个
      const defaultWard = wardList.value.find(w => w.wardName.includes('7#19B') || w.id === 36) || wardList.value[0]
      patientForm.value.wardId = defaultWard.id
      selectedWardName.value = defaultWard.displayLabel
      await loadBedsForWard(defaultWard.id)
    }
  } catch (e) {
    console.error(e)
  }
}

async function loadBedsForWard(wardId) {
  try {
    const beds = await getBedsByWardApi(wardId)
    bedList.value = (beds || []).map(b => ({
      ...b,
      displayLabel: b.roomNo ? `${b.roomNo} - ${b.bedNo}` : b.bedNo
    }))
    if (bedList.value.length > 0) {
      const match = bedList.value.find(b => b.bedNo === patientForm.value.bedNo || b.id === patientForm.value.bedId)
      if (match) {
        patientForm.value.bedNo = match.bedNo
        patientForm.value.bedId = match.id
        selectedBedName.value = match.displayLabel
      } else {
        patientForm.value.bedNo = bedList.value[0].bedNo
        patientForm.value.bedId = bedList.value[0].id
        selectedBedName.value = bedList.value[0].displayLabel
      }
    } else {
      patientForm.value.bedNo = ''
      patientForm.value.bedId = null
      selectedBedName.value = ''
    }
  } catch (e) {
    console.error('加载床位失败:', e)
    bedList.value = []
    patientForm.value.bedNo = ''
    patientForm.value.bedId = null
    selectedBedName.value = ''
  }
}

async function onWardPick(e) {
  const idx = e.detail.value
  const item = wardList.value[idx]
  if (item) {
    patientForm.value.wardId = item.id
    selectedWardName.value = item.displayLabel
    await loadBedsForWard(item.id)
  }
}

function onBedPick(e) {
  const idx = e.detail.value
  const b = bedList.value[idx]
  if (b) {
    patientForm.value.bedNo = b.bedNo
    patientForm.value.bedId = b.id
    selectedBedName.value = b.displayLabel
  }
}

async function fillDemoPatient(name, wardId, bedNo, hospitalNo) {
  patientForm.value.patientName = name
  patientForm.value.hospitalNo = hospitalNo

  // 1. 匹配病区
  const targetWard = wardList.value.find(w => w.id === wardId || w.wardName.includes('7#19B'))
  if (targetWard) {
    patientForm.value.wardId = targetWard.id
    selectedWardName.value = targetWard.displayLabel
    await loadBedsForWard(targetWard.id)
  }

  // 2. 匹配床位
  const targetBed = bedList.value.find(b => b.bedNo === bedNo || b.bedNo.replace('床', '') === bedNo.replace('床', ''))
  if (targetBed) {
    patientForm.value.bedNo = targetBed.bedNo
    patientForm.value.bedId = targetBed.id
    selectedBedName.value = targetBed.displayLabel
  } else {
    patientForm.value.bedNo = bedNo
    selectedBedName.value = bedNo
  }
}

async function handleNurseBind() {
  if (!nurseForm.value.jobNumber || nurseForm.value.jobNumber.length !== 6) {
    uni.showToast({ title: '请输入6位纯数字工号', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const res = await bindNurseApi({
      jobNumber: nurseForm.value.jobNumber,
      hospitalId: nurseForm.value.hospitalId,
      deptId: nurseForm.value.deptId
    })
    userStore.setLoginData(res)
    syncRoleTabBar()
    uni.showToast({ title: '身份绑定成功', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 1000)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function handlePatientBind() {
  if (!patientForm.value.patientName.trim()) {
    uni.showToast({ title: '请输入真实姓名', icon: 'none' })
    return
  }
  if (!patientForm.value.wardId) {
    uni.showToast({ title: '请选择所属楼宇/病区', icon: 'none' })
    return
  }
  if (!patientForm.value.bedNo || !patientForm.value.bedNo.trim()) {
    uni.showToast({ title: '请选择床位号', icon: 'none' })
    return
  }
  if (!patientForm.value.hospitalNo || !patientForm.value.hospitalNo.trim()) {
    uni.showToast({ title: '请输入住院号', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const res = await bindPatientApi({
      patientName: patientForm.value.patientName.trim(),
      wardId: patientForm.value.wardId,
      bedNo: patientForm.value.bedNo.trim(),
      bedId: patientForm.value.bedId,
      hospitalNo: patientForm.value.hospitalNo.trim()
    })
    userStore.setLoginData(res)
    syncRoleTabBar()
    uni.showToast({ title: '身份核验通过，登录成功', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/patient-view/home' })
    }, 1000)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  loadDicts()
  loadWards()
  if (!userStore.token) {
    try {
      await userStore.loginWithWechat()
    } catch (e) {
      console.error('绑定页静默获取微信登录凭证异常:', e)
    }
  }
})
</script>

<style>
.container {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 40rpx 30rpx;
  box-sizing: border-box;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40rpx;
}

.logo-box {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #1a1a1a;
  margin-bottom: 12rpx;
}

.subtitle {
  font-size: 24rpx;
  color: #8c8c8c;
}

.tab-card {
  display: flex;
  background-color: #e6f4ff;
  border-radius: 16rpx;
  padding: 8rpx;
  margin-bottom: 30rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  font-size: 28rpx;
  color: #595959;
  border-radius: 12rpx;
  font-weight: 500;
  transition: all 0.3s;
}

.tab-item.active {
  background-color: #1677ff;
  color: #ffffff;
  box-shadow: 0 4rpx 12rpx rgba(22, 119, 255, 0.2);
}

.form-card {
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 40rpx 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.form-desc {
  font-size: 26rpx;
  color: #595959;
  line-height: 1.6;
  margin-bottom: 36rpx;
}

.highlight {
  color: #1677ff;
  font-weight: bold;
}

.input-group {
  margin-bottom: 30rpx;
}

.label {
  display: block;
  font-size: 26rpx;
  font-weight: 500;
  color: #262626;
  margin-bottom: 12rpx;
}

.input {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background-color: #fafafa;
  border: 2rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #333333;
  box-sizing: border-box;
}

.input-placeholder {
  color: #bfbfbf;
  line-height: 88rpx;
  font-size: 28rpx;
}

.picker-input {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background-color: #fafafa;
  border: 2rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #333333;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
}

.arrow {
  color: #bfbfbf;
  font-size: 22rpx;
}

.preset-tip {
  background-color: #f6ffed;
  border: 2rpx dashed #b7eb8f;
  border-radius: 12rpx;
  padding: 20rpx;
  margin: 30rpx 0;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.p-title {
  font-size: 24rpx;
  font-weight: bold;
  color: #52c41a;
}

.p-item {
  font-size: 22rpx;
  color: #389e0d;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background-color: #1677ff;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: bold;
  margin-top: 20rpx;
}

.patient-btn {
  background-color: #52c41a;
}
</style>
