<template>
  <view class="container">
    <!-- 1. 用户信息卡片（已登录 / 未登录两种状态） -->
    <view class="user-card" v-if="userStore.token">
      <view class="avatar-wrap" :class="roleClass">
        <text class="avatar-text">
          {{ userStore.userInfo?.realName ? userStore.userInfo.realName.substring(0, 1) : (userStore.userInfo?.nickname?.substring(0, 1) || '用') }}
        </text>
      </view>
      <view class="user-info">
        <view class="name-row">
          <text class="nickname">{{ userStore.userInfo?.realName || userStore.userInfo?.nickname || '微信用户' }}</text>
          <text :class="['role-badge', roleClass]">
            {{ roleText }}
          </text>
        </view>
        <view class="sub-info" v-if="userStore.isBound">
          <text v-if="userStore.isHeadNurse || userStore.isNurse">
            工号: {{ userStore.userInfo?.jobNumber }} • {{ userStore.userInfo?.wardName || userStore.userInfo?.department }}
          </text>
          <text v-else-if="userStore.isPatient">
            病床: {{ userStore.userInfo?.department }} {{ userStore.userInfo?.boundBedNo }}
          </text>
        </view>
        <view class="sub-info warn" v-else>
          已连接微信，未绑定临床身份
        </view>
      </view>
    </view>

    <!-- 未登录状态卡片 -->
    <view class="user-card unlogin-card" v-else @tap="goToLogin">
      <view class="avatar-wrap none">
        <text class="avatar-text">👤</text>
      </view>
      <view class="user-info">
        <text class="nickname">未登录微信账号</text>
        <text class="unlogin-sub">点击前往微信一键授权登录 ›</text>
      </view>
    </view>

    <!-- 2. 微信登录按钮区（未登录时展示） -->
    <view class="login-action-card" v-if="!userStore.token">
      <button class="wechat-login-btn" type="primary" @tap="goToLogin">
        <text class="wx-icon">💬</text> 前往微信一键授权登录
      </button>
      <text class="login-tip">登录后会同步你的记录，不用重复填写</text>
    </view>

    <!-- 3. 身份核验与绑定状态（已登录时展示） -->
    <view class="menu-group" v-if="userStore.token">
      <view class="menu-title">临床身份管理</view>
      <view class="menu-item" v-if="!userStore.isBound" @tap="goToBind">
        <text class="m-icon">🔑</text>
        <text class="m-text highlight-text">前往身份核验与绑定（工号/床位）</text>
        <text class="m-arrow">›</text>
      </view>
      <view class="menu-item" v-else @tap="handleUnbind">
        <text class="m-icon">🔄</text>
        <text class="m-text">解除当前临床身份绑定</text>
        <text class="m-sub">换绑其他工号/病床</text>
      </view>
    </view>

    <!-- 4. 角色专属快捷入口（已登录且已绑定时展示） -->
    <view class="menu-group" v-if="userStore.token && userStore.isBound">
      <view class="menu-title">业务工作台快捷入口</view>
      
      <!-- 录入住院病患档案快捷入口（责任护士 / 护士长） -->
      <view class="menu-item" v-if="userStore.isHeadNurse || userStore.isNurse" @tap="openAddPatientModal">
        <text class="m-icon">📝</text>
        <text class="m-text highlight-blue">录入住院病患档案（新建档案）</text>
        <text class="m-arrow">›</text>
      </view>

      <view class="menu-item" v-if="userStore.isHeadNurse" @tap="goToNurseManage">
        <text class="m-icon">👩‍⚕️</text>
        <text class="m-text">科室护士名册与排班管理（护士长）</text>
        <text class="m-arrow">›</text>
      </view>

      <view class="menu-item" v-if="userStore.isHeadNurse" @tap="goToIndex">
        <text class="m-icon">🏥</text>
        <text class="m-text">全病房床位与病患管理（护士长）</text>
        <text class="m-arrow">›</text>
      </view>

      <view class="menu-item" v-if="userStore.isNurse" @tap="goToIndex">
        <text class="m-icon">🩺</text>
        <text class="m-text">我负责的床位与病患列表（责任护士）</text>
        <text class="m-arrow">›</text>
      </view>

      <!-- 每日特殊交接班登记簿（责任护士 / 护士长） -->
      <view class="menu-item" v-if="userStore.isHeadNurse || userStore.isNurse" @tap="goToSpecialHandover">
        <text class="m-icon">📋</text>
        <text class="m-text">每日特殊交接班簿</text>
        <text class="m-sub">当班填报 / 今日数据</text>
        <text class="m-arrow">›</text>
      </view>

      <!-- 特殊交接班历史清册（责任护士 / 护士长） -->
      <view class="menu-item" v-if="userStore.isHeadNurse || userStore.isNurse" @tap="goToHandoverHistory">
        <text class="m-icon">🗂️</text>
        <text class="m-text">特殊交接班历史清册</text>
        <text class="m-sub">按病区/个人查阅与接班</text>
        <text class="m-arrow">›</text>
      </view>

      <!-- 患者补液监护管理（责任护士 / 护士长） -->
      <view class="menu-item" v-if="userStore.isHeadNurse || userStore.isNurse" @tap="goToInfusion">
        <text class="m-icon">💧</text>
        <text class="m-text">患者补液监护管理</text>
        <text class="m-sub">补液登记 / 拔针确认</text>
        <text class="m-arrow">›</text>
      </view>

      <view class="menu-item" v-if="userStore.isHeadNurse" @tap="goToStats">
        <text class="m-icon">📊</text>
        <text class="m-text">全科室每日出入平衡分析</text>
        <text class="m-arrow">›</text>
      </view>

      <view class="menu-item" v-if="userStore.isPatient" @tap="goToPatientHome">
        <text class="m-icon">📋</text>
        <text class="m-text">我的记录（补记喝水、排尿）</text>
        <text class="m-arrow">›</text>
      </view>
    </view>

    <!-- 5. 规范指南与系统信息 -->
    <view class="menu-group">
      <view class="menu-title">系统与说明</view>
      <view class="menu-item" @tap="showHelpModal">
        <text class="m-icon">📖</text>
        <text class="m-text">临床液体平衡出入量监测规范</text>
        <text class="m-arrow">›</text>
      </view>
      <view class="menu-item">
        <text class="m-icon">ℹ️</text>
        <text class="m-text">系统版本</text>
        <text class="m-val">v{{ appVersion }}</text>
      </view>
      <view class="menu-item" @tap="openServerSetting">
        <text class="m-icon">🌐</text>
        <text class="m-text">服务器地址</text>
        <text class="m-val">{{ serverHost }}</text>
      </view>
      <view class="menu-item" v-if="pendingCount > 0" @tap="retrySync">
        <text class="m-icon">📶</text>
        <text class="m-text">待同步记录</text>
        <text class="m-val warn-val">{{ pendingCount }} 条 · 点击重试</text>
      </view>
    </view>

    <!-- 6. 退出登录入口（已登录时展示） -->
    <view class="logout-section" v-if="userStore.token">
      <button class="logout-btn" @tap="handleLogout">
        🚪 退出当前微信登录
      </button>
    </view>

    <!-- 服务器地址设置（现场临时切内网用，不影响正式配置） -->
    <view class="modal-mask" v-if="showServerModal" @tap="showServerModal = false">
      <view class="server-modal" @tap.stop>
        <text class="sm-title">服务器地址</text>
        <text class="sm-desc">例如 http://192.168.1.20:8080/api，留空恢复默认</text>
        <input class="sm-input" v-model="serverInput" placeholder="http://IP:8080/api" />
        <view class="sm-actions">
          <button class="sm-btn" @tap="showServerModal = false">取消</button>
          <button class="sm-btn primary" @tap="saveServer">保存</button>
        </view>
      </view>
    </view>

    <!-- 底部角色定制导航栏 -->
    <CustomTabBar current="mine" />

    <!-- 录入住院病患档案弹窗（防遮挡设计，超高层级+视口自适应） -->
    <view class="modal-mask" v-if="showAddPatientModal" @tap="showAddPatientModal = false">
      <view class="patient-modal-box" @tap.stop>
        <view class="patient-modal-header">
          <text class="patient-modal-title">📝 录入住院病患档案</text>
          <text class="patient-modal-close" @tap="showAddPatientModal = false">✕</text>
        </view>

        <scroll-view scroll-y class="patient-modal-scroll">
          <!-- 1. 住院号与病患姓名 -->
          <view class="form-row-2">
            <view class="form-group flex-1">
              <text class="form-label required">住院号 *</text>
              <input class="form-input" v-model="formPatient.hospitalNo" placeholder="如：ZY202611003" />
            </view>
            <view class="form-group flex-1 ml-16">
              <text class="form-label required">病患姓名 *</text>
              <input class="form-input" v-model="formPatient.patientName" placeholder="如：张三" />
            </view>
          </view>

          <!-- 2. 性别与年龄 -->
          <view class="form-row-2 mt-16">
            <view class="form-group flex-1">
              <text class="form-label">性别</text>
              <view class="gender-radio-group">
                <view 
                  :class="['gender-btn', formPatient.gender === 1 ? 'active' : '']"
                  @tap="formPatient.gender = 1"
                >
                  <text class="radio-dot"></text>
                  <text>男</text>
                </view>
                <view 
                  :class="['gender-btn', formPatient.gender === 2 ? 'active' : '']"
                  @tap="formPatient.gender = 2"
                >
                  <text class="radio-dot"></text>
                  <text>女</text>
                </view>
              </view>
            </view>
            <view class="form-group flex-1 ml-16">
              <text class="form-label">年龄</text>
              <view class="age-stepper">
                <view class="step-btn" @tap="formPatient.age = Math.max(0, Number(formPatient.age || 0) - 1)">-</view>
                <input class="age-input" type="number" v-model="formPatient.age" />
                <view class="step-btn" @tap="formPatient.age = Math.min(120, Number(formPatient.age || 0) + 1)">+</view>
              </view>
            </view>
          </view>

          <!-- 3. 群体类别与入院方式 -->
          <view class="form-row-2 mt-16">
            <view class="form-group flex-1">
              <text class="form-label">群体类别</text>
              <picker 
                :range="patientTypeOptions" 
                range-key="label" 
                :value="patientTypeIndex" 
                @change="onPatientTypePick"
              >
                <view class="form-picker-box">
                  <text>{{ currentPatientTypeLabel }}</text>
                  <text class="picker-arrow">▼</text>
                </view>
              </picker>
            </view>
            <view class="form-group flex-1 ml-16">
              <text class="form-label">入院方式</text>
              <picker 
                :range="admissionTypeOptions" 
                range-key="label" 
                :value="admissionTypeIndex" 
                @change="onAdmissionTypePick"
              >
                <view class="form-picker-box">
                  <text>{{ currentAdmissionTypeLabel }}</text>
                  <text class="picker-arrow">▼</text>
                </view>
              </picker>
            </view>
          </view>

          <!-- 4. 所属病区与所在床位 -->
          <view class="form-row-2 mt-16">
            <view class="form-group flex-1">
              <text class="form-label required">所属病区 *</text>
              <picker 
                :range="wardList" 
                range-key="wardName" 
                :value="currentWardPickerIndex" 
                @change="onFormWardPick"
              >
                <view class="form-picker-box">
                  <text class="ellipsis-text">{{ currentWardPickerLabel }}</text>
                  <text class="picker-arrow">▼</text>
                </view>
              </picker>
            </view>
            <view class="form-group flex-1 ml-16">
              <text class="form-label required">所在床位 *</text>
              <picker 
                :range="availableBeds" 
                range-key="bedNo" 
                :value="currentBedPickerIndex" 
                @change="onBedPick"
              >
                <view class="form-picker-box">
                  <text class="ellipsis-text" :class="!selectedBed ? 'placeholder-color' : ''">
                    {{ selectedBed ? selectedBed.bedNo : (availableBeds.length > 0 ? '选择空床' : '无可用空床') }}
                  </text>
                  <text class="picker-arrow">▼</text>
                </view>
              </picker>
            </view>
          </view>

          <!-- 5. 护理级别与测出入量医嘱 -->
          <view class="form-row-2 mt-16">
            <view class="form-group flex-1">
              <text class="form-label">护理级别</text>
              <picker 
                :range="nursingLevelOptions" 
                range-key="label" 
                :value="nursingLevelIndex" 
                @change="onNursingLevelPick"
              >
                <view class="form-picker-box">
                  <text>{{ currentNursingLevelLabel }}</text>
                  <text class="picker-arrow">▼</text>
                </view>
              </picker>
            </view>
            <view class="form-group flex-1 ml-16">
              <text class="form-label">测出入量医嘱</text>
              <view class="switch-row">
                <text :class="['switch-label-text', !formPatient.needIoRecordBool ? 'active' : '']">不测</text>
                <switch 
                  :checked="formPatient.needIoRecordBool" 
                  color="#1677ff" 
                  @change="formPatient.needIoRecordBool = $event.detail.value" 
                />
                <text :class="['switch-label-text', formPatient.needIoRecordBool ? 'active' : '']">开启监测</text>
              </view>
            </view>
          </view>

          <!-- 6. 留置管路 -->
          <view class="form-group mt-16">
            <text class="form-label">留置管路</text>
            <view class="tubes-checkbox-row">
              <view 
                v-for="t in drainageTubeOptions" 
                :key="t.value"
                :class="['tube-chip', selectedTubes.includes(t.value) ? 'active' : '']"
                @tap="toggleTube(t.value)"
              >
                <text class="chip-checkbox">{{ selectedTubes.includes(t.value) ? '✓' : '' }}</text>
                <text class="chip-text">{{ t.label }}</text>
              </view>
            </view>
          </view>

          <!-- 7. 入院日期 -->
          <view class="form-group mt-16">
            <text class="form-label required">入院日期 *</text>
            <picker mode="date" :value="formPatient.admissionDate" @change="formPatient.admissionDate = $event.detail.value">
              <view class="form-picker-box">
                <text>📅 {{ formPatient.admissionDate }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>

          <!-- 8. 临床诊断 -->
          <view class="form-group mt-16">
            <text class="form-label">临床诊断</text>
            <textarea 
              class="form-textarea" 
              v-model="formPatient.diagnosis" 
              placeholder="如：胃癌术后、胆囊结石伴急性胆囊炎" 
            />
          </view>
        </scroll-view>

        <!-- 底部确定操作栏：居中固定，杜绝任何遮盖 -->
        <view class="patient-modal-footer">
          <button class="p-btn cancel" @tap="showAddPatientModal = false">取消</button>
          <button class="p-btn confirm" :loading="isPatientSaving" @tap="handleAddPatient">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user'
import { syncRoleTabBar } from '../../utils/tabbar'
import { getWardsApi } from '../../api/ward'
import { getBedsByWardApi } from '../../api/bed'
import { createPatientApi } from '../../api/patient'
import { formatDate } from '../../utils/date'
import { APP_VERSION, getBaseUrl, setBaseUrl } from '../../config'
import { queueCount, flushQueue } from '../../utils/offline'
import CustomTabBar from '../../components/CustomTabBar.vue'

const userStore = useUserStore()

const appVersion = APP_VERSION
const showServerModal = ref(false)
const serverInput = ref(getBaseUrl())
const pendingCount = ref(queueCount())

const serverHost = computed(() => {
  return getBaseUrl().replace(/^https?:\/\//, '')
})

function openServerSetting() {
  serverInput.value = getBaseUrl()
  showServerModal.value = true
}

function saveServer() {
  const value = serverInput.value.trim()
  setBaseUrl(value)
  showServerModal.value = false
  uni.showToast({ title: value ? '已切换服务器' : '已恢复默认', icon: 'none' })
}

async function retrySync() {
  uni.showLoading({ title: '正在补传…' })
  await flushQueue()
  uni.hideLoading()
  pendingCount.value = queueCount()
}
const loginLoading = ref(false)

// 录入住院病患档案弹窗状态与字典（与后台及工作台标准保持严格一致）
const wardList = ref([])
const showAddPatientModal = ref(false)
const availableBeds = ref([])
const selectedBed = ref(null)
const selectedTubes = ref([])
const isPatientSaving = ref(false)

const patientTypeOptions = [
  { label: '成人', value: 'ADULT' },
  { label: '👶 婴儿', value: 'INFANT' }
]
const admissionTypeOptions = [
  { label: '平诊', value: 'ROUTINE' },
  { label: '急诊', value: 'EMERGENCY' }
]
const nursingLevelOptions = [
  { label: '特级护理', value: 'SPECIAL' },
  { label: '一级护理', value: 'LEVEL_1' },
  { label: '二级护理', value: 'LEVEL_2' },
  { label: '三级护理', value: 'LEVEL_3' }
]
const drainageTubeOptions = [
  { label: '留置导尿管', value: 'CATHER' },
  { label: '胃肠减压管', value: 'GASTRIC' },
  { label: '引流管(胸/腹腔)', value: 'DRAINAGE' }
]

const formPatient = ref({
  hospitalNo: '',
  patientName: '',
  gender: 1,
  age: 50,
  patientType: 'ADULT',
  admissionType: 'ROUTINE',
  wardId: null,
  bedId: null,
  nursingLevel: 'LEVEL_2',
  needIoRecordBool: true,
  admissionDate: formatDate(),
  diagnosis: ''
})

const patientTypeIndex = computed(() => {
  const idx = patientTypeOptions.findIndex(o => o.value === formPatient.value.patientType)
  return idx >= 0 ? idx : 0
})
const currentPatientTypeLabel = computed(() => {
  const match = patientTypeOptions.find(o => o.value === formPatient.value.patientType)
  return match ? match.label : '成人'
})

const admissionTypeIndex = computed(() => {
  const idx = admissionTypeOptions.findIndex(o => o.value === formPatient.value.admissionType)
  return idx >= 0 ? idx : 0
})
const currentAdmissionTypeLabel = computed(() => {
  const match = admissionTypeOptions.find(o => o.value === formPatient.value.admissionType)
  return match ? match.label : '平诊'
})

const currentWardPickerIndex = computed(() => {
  const idx = wardList.value.findIndex(w => w.id === formPatient.value.wardId)
  return idx >= 0 ? idx : 0
})
const currentWardPickerLabel = computed(() => {
  const match = wardList.value.find(w => w.id === formPatient.value.wardId)
  return match ? match.wardName : '选择病区'
})

const currentBedPickerIndex = computed(() => {
  const idx = availableBeds.value.findIndex(b => b.id === formPatient.value.bedId)
  return idx >= 0 ? idx : 0
})

const nursingLevelIndex = computed(() => {
  const idx = nursingLevelOptions.findIndex(o => o.value === formPatient.value.nursingLevel)
  return idx >= 0 ? idx : 2
})
const currentNursingLevelLabel = computed(() => {
  const match = nursingLevelOptions.find(o => o.value === formPatient.value.nursingLevel)
  return match ? match.label : '二级护理'
})

// 开启录入病患档案弹窗
async function openAddPatientModal() {
  uni.showLoading({ title: '加载中...' })
  try {
    if (wardList.value.length === 0) {
      const wards = await getWardsApi()
      wardList.value = wards || []
    }
  } catch (e) {
    console.error('加载病区失败', e)
  } finally {
    uni.hideLoading()
  }

  const initialWardId = wardList.value[0]?.id || null
  formPatient.value = {
    hospitalNo: '',
    patientName: '',
    gender: 1,
    age: 50,
    patientType: 'ADULT',
    admissionType: 'ROUTINE',
    wardId: initialWardId,
    bedId: null,
    nursingLevel: 'LEVEL_2',
    needIoRecordBool: true,
    admissionDate: formatDate(),
    diagnosis: ''
  }
  selectedTubes.value = []
  if (initialWardId) {
    await loadAvailableBeds(initialWardId)
  }
  showAddPatientModal.value = true
}

async function loadAvailableBeds(wardId) {
  try {
    const beds = await getBedsByWardApi(wardId)
    // 筛选当前病区的空床
    availableBeds.value = (beds || []).filter(b => b.status === 0)
    selectedBed.value = availableBeds.value.length > 0 ? availableBeds.value[0] : null
    formPatient.value.bedId = selectedBed.value ? selectedBed.value.id : null
  } catch (e) {
    console.error('加载空床异常', e)
    availableBeds.value = []
    selectedBed.value = null
    formPatient.value.bedId = null
  }
}

function onPatientTypePick(e) {
  const idx = e.detail.value
  formPatient.value.patientType = patientTypeOptions[idx].value
}

function onAdmissionTypePick(e) {
  const idx = e.detail.value
  formPatient.value.admissionType = admissionTypeOptions[idx].value
}

function onNursingLevelPick(e) {
  const idx = e.detail.value
  formPatient.value.nursingLevel = nursingLevelOptions[idx].value
}

async function onFormWardPick(e) {
  const idx = e.detail.value
  const targetW = wardList.value[idx]
  if (targetW) {
    formPatient.value.wardId = targetW.id
    await loadAvailableBeds(targetW.id)
  }
}

function onBedPick(e) {
  const idx = e.detail.value
  selectedBed.value = availableBeds.value[idx]
  formPatient.value.bedId = selectedBed.value ? selectedBed.value.id : null
}

function toggleTube(tubeVal) {
  const idx = selectedTubes.value.indexOf(tubeVal)
  if (idx >= 0) {
    selectedTubes.value.splice(idx, 1)
  } else {
    selectedTubes.value.push(tubeVal)
  }
}

async function handleAddPatient() {
  if (!formPatient.value.hospitalNo.trim()) {
    uni.showToast({ title: '请填写住院号', icon: 'none' })
    return
  }
  if (!formPatient.value.patientName.trim()) {
    uni.showToast({ title: '请填写病患姓名', icon: 'none' })
    return
  }
  if (!formPatient.value.wardId) {
    uni.showToast({ title: '请选择所属病房', icon: 'none' })
    return
  }
  if (!formPatient.value.bedId) {
    uni.showToast({ title: '请选择所在空闲床位', icon: 'none' })
    return
  }

  isPatientSaving.value = true
  try {
    const payload = {
      hospitalNo: formPatient.value.hospitalNo.trim(),
      patientName: formPatient.value.patientName.trim(),
      gender: formPatient.value.gender,
      age: Number(formPatient.value.age) || 50,
      patientType: formPatient.value.patientType,
      admissionType: formPatient.value.admissionType,
      wardId: formPatient.value.wardId,
      bedId: formPatient.value.bedId,
      bedNo: selectedBed.value?.bedNo || '',
      nursingLevel: formPatient.value.nursingLevel,
      needIoRecord: formPatient.value.needIoRecordBool ? 1 : 0,
      drainageTubes: selectedTubes.value.join(','),
      admissionDate: formPatient.value.admissionDate,
      diagnosis: formPatient.value.diagnosis.trim()
    }
    await createPatientApi(payload)
    showAddPatientModal.value = false
    uni.showModal({
      title: '录入成功',
      content: `已成功为【${payload.bedNo} - ${payload.patientName}】建立住院病患档案！是否立即前往病房工作台查看？`,
      confirmText: '去工作台',
      cancelText: '留在本页',
      success: (res) => {
        if (res.confirm) {
          uni.switchTab({ url: '/pages/index/index' })
        }
      }
    })
  } catch (e) {
    console.error('建档异常', e)
  } finally {
    isPatientSaving.value = false
  }
}

const roleClass = computed(() => {
  if (userStore.isHeadNurse) return 'head'
  if (userStore.isNurse) return 'nurse'
  if (userStore.isPatient) return 'patient'
  return 'none'
})

const roleText = computed(() => {
  if (userStore.isHeadNurse) return '护士长'
  if (userStore.isNurse) return '责任护士'
  if (userStore.isPatient) return '在院患者'
  return '未绑定临床身份'
})

function formatOpenid(openid) {
  if (!openid) return '未获取'
  if (openid.length <= 12) return openid
  return openid.substring(0, 6) + '...' + openid.substring(openid.length - 4)
}

/**
 * 显式微信授权登录
 */
async function handleWechatLogin() {
  loginLoading.value = true
  try {
    const data = await userStore.loginWithWechat()
    uni.showToast({ title: '微信登录成功', icon: 'success' })
    if (!data.isBound) {
      uni.showModal({
        title: '提示',
        content: '微信账号已连接！您尚未绑定临床身份，是否立即前往绑定工号或床位？',
        confirmText: '立即绑定',
        success: (res) => {
          if (res.confirm) {
            uni.navigateTo({ url: '/pages/auth/bind' })
          }
        }
      })
    }
  } catch (e) {
    uni.showToast({ title: e.message || '微信登录失败', icon: 'none' })
  } finally {
    loginLoading.value = false
  }
}

function goToLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}

/**
 * 退出当前微信登录
 */
function handleLogout() {
  uni.showModal({
    title: '退出登录确认',
    content: '确定要退出当前微信账号登录吗？退出后将清除本地会话缓存。',
    confirmText: '确认退出',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
        uni.showToast({ title: '已安全退出登录', icon: 'success' })
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/auth/login' })
        }, 500)
      }
    }
  })
}

function goToNurseManage() {
  uni.navigateTo({ url: '/pages/nurse/list' })
}

function goToBind() {
  uni.navigateTo({ url: '/pages/auth/bind' })
}

function goToIndex() {
  uni.switchTab({ url: '/pages/index/index' })
}

function goToStats() {
  uni.switchTab({ url: '/pages/stats/daily' })
}

function goToSpecialHandover() {
  uni.navigateTo({ url: '/pages/handover/special-record' })
}

function goToHandoverHistory() {
  uni.navigateTo({ url: '/pages/handover/history' })
}

function goToInfusion() {
  uni.navigateTo({ url: '/pages/infusion/list' })
}

function goToPatientHome() {
  uni.switchTab({ url: '/pages/patient-view/home' })
}

function handleUnbind() {
  uni.showModal({
    title: '确认解除绑定',
    content: '解除后需要重新输入工号或床位核验绑定，确定要解绑吗？',
    success: async (res) => {
      if (res.confirm) {
        await userStore.unbind()
        uni.showToast({ title: '已解绑', icon: 'success' })
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/auth/bind' })
        }, 800)
      }
    }
  })
}

function showHelpModal() {
  uni.showModal({
    title: '临床出入量规范说明',
    content: '1. 护士长：统一管理科室病房与床位，为病患分配责任护士。\n2. 责任护士：严格监测被分配床位患者的每日摄入量与排出量。\n3. 在院患者：可随时补充报送饮水、饮食及排泄量。\n4. 统计周期严格遵循自然日（00:00:00 - 23:59:59）。',
    showCancel: false
  })
}

onShow(() => {
  syncRoleTabBar()
  pendingCount.value = queueCount()
  if (userStore.token) {
    userStore.refreshUserInfo()
  }
})
</script>

<style>
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.server-modal {
  width: 84%;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 36rpx 32rpx;
}

.sm-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #1f2329;
  display: block;
  text-align: center;
}

.sm-desc {
  font-size: 24rpx;
  color: #8c8c8c;
  display: block;
  text-align: center;
  margin: 12rpx 0 22rpx;
}

.sm-input {
  height: 88rpx;
  border: 2rpx solid #d9d9d9;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
}

.sm-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 26rpx;
}

.sm-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
  border-radius: 40rpx;
  background: #f5f7fa;
  color: #595959;
  margin: 0;
}

.sm-btn.primary {
  background: #1677ff;
  color: #ffffff;
}

.warn-val {
  color: #fa8c16 !important;
}

.container {
  padding: 24rpx;
  padding-bottom: 80rpx;
}

.user-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 36rpx 30rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 24rpx;
}

.unlogin-card {
  border: 1px dashed #d9d9d9;
}

.avatar-wrap {
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}

.avatar-wrap.head { background: #fa8c16; }
.avatar-wrap.nurse { background: #1677ff; }
.avatar-wrap.patient { background: #52c41a; }
.avatar-wrap.none { background: #d9d9d9; }

.avatar-text {
  color: #ffffff;
  font-size: 42rpx;
  font-weight: bold;
}

.user-info {
  flex: 1;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 8rpx;
}

.nickname {
  font-size: 34rpx;
  font-weight: bold;
  color: #262626;
}

.unlogin-sub {
  font-size: 24rpx;
  color: #8c8c8c;
  margin-top: 6rpx;
}

.role-badge {
  font-size: 20rpx;
  padding: 2rpx 14rpx;
  border-radius: 6rpx;
  font-weight: 500;
}

.role-badge.head { background: #fff7e6; color: #fa8c16; border: 1px solid #ffd591; }
.role-badge.nurse { background: #e6f4ff; color: #1677ff; border: 1px solid #91caff; }
.role-badge.patient { background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }
.role-badge.none { background: #fff1f0; color: #ff4d4f; border: 1px solid #ffa39e; }

.sub-info {
  font-size: 24rpx;
  color: #595959;
}

.sub-info.warn {
  color: #fa8c16;
  font-weight: 500;
}

.openid-tip {
  font-size: 20rpx;
  color: #bfbfbf;
  margin-top: 6rpx;
}

/* 微信登录卡片 */
.login-action-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 24rpx;
  text-align: center;
}

.wechat-login-btn {
  background: #07c160;
  color: #ffffff;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: bold;
  height: 88rpx;
  line-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wx-icon {
  font-size: 36rpx;
  margin-right: 12rpx;
}

.login-tip {
  font-size: 22rpx;
  color: #8c8c8c;
  display: block;
  margin-top: 14rpx;
}

.menu-group {
  background: #ffffff;
  border-radius: 16rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
}

.menu-title {
  padding: 20rpx 30rpx 10rpx 30rpx;
  font-size: 24rpx;
  color: #8c8c8c;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 26rpx 30rpx;
  border-bottom: 1px solid #f8f8f8;
}

.menu-item:last-child {
  border-bottom: none;
}

.m-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.m-text {
  font-size: 28rpx;
  color: #262626;
  flex: 1;
}

.highlight-text {
  color: #1677ff;
  font-weight: bold;
}

.m-arrow {
  font-size: 32rpx;
  color: #bfbfbf;
}

.m-sub {
  font-size: 24rpx;
  color: #ff4d4f;
}

.m-val {
  font-size: 24rpx;
  color: #8c8c8c;
}

.logout-section {
  margin-top: 40rpx;
}

.logout-btn {
  background: #ffffff;
  color: #ff4d4f;
  border: 1px solid #ffa39e;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: bold;
  height: 88rpx;
  line-height: 88rpx;
}

.highlight-blue {
  color: #1677ff;
  font-weight: 500;
}

/* 录入住院病患档案弹窗（防遮挡设计，超高层级+视口自适应） */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  box-sizing: border-box;
  padding: 30rpx 24rpx;
}

.patient-modal-box {
  width: 100%;
  max-width: 680rpx;
  max-height: 80vh;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 30rpx 30rpx 20rpx 30rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.25);
  position: relative;
}

.patient-modal-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20rpx;
  border-bottom: 1px solid #f0f0f0;
}

.patient-modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #1f2937;
}

.patient-modal-close {
  font-size: 36rpx;
  color: #9ca3af;
  padding: 0 10rpx;
}

.patient-modal-scroll {
  flex: 1;
  max-height: 52vh;
  min-height: 200rpx;
  margin-top: 16rpx;
  padding-right: 6rpx;
  box-sizing: border-box;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.form-row-2 {
  display: flex;
  align-items: flex-start;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.flex-1 {
  flex: 1;
}

.ml-16 {
  margin-left: 16rpx;
}

.mt-16 {
  margin-top: 20rpx;
}

.form-label {
  font-size: 26rpx;
  color: #374151;
  font-weight: 500;
  margin-bottom: 10rpx;
}

.form-label.required {
  color: #1f2937;
}

.form-input {
  height: 72rpx;
  padding: 0 20rpx;
  border: 1px solid #d9d9d9;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #1f2937;
  background: #ffffff;
  box-sizing: border-box;
}

.gender-radio-group {
  display: flex;
  gap: 16rpx;
}

.gender-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 72rpx;
  border: 1px solid #d9d9d9;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #4b5563;
  background: #f9fafb;
}

.gender-btn.active {
  border-color: #1677ff;
  color: #1677ff;
  background: #e6f4ff;
  font-weight: bold;
}

.radio-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #d1d5db;
}

.gender-btn.active .radio-dot {
  background: #1677ff;
}

.age-stepper {
  display: flex;
  align-items: center;
  height: 72rpx;
  border: 1px solid #d9d9d9;
  border-radius: 12rpx;
  overflow: hidden;
}

.step-btn {
  width: 60rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  font-size: 32rpx;
  color: #4b5563;
  font-weight: bold;
}

.age-input {
  flex: 1;
  height: 72rpx;
  text-align: center;
  font-size: 28rpx;
  color: #1f2937;
}

.form-picker-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72rpx;
  padding: 0 18rpx;
  border: 1px solid #d9d9d9;
  border-radius: 12rpx;
  background: #ffffff;
  font-size: 26rpx;
  color: #1f2937;
}

.picker-arrow {
  font-size: 20rpx;
  color: #9ca3af;
  margin-left: 8rpx;
}

.placeholder-color {
  color: #9ca3af;
}

.ellipsis-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  height: 72rpx;
}

.switch-label-text {
  font-size: 24rpx;
  color: #9ca3af;
}

.switch-label-text.active {
  color: #1677ff;
  font-weight: bold;
}

.tubes-checkbox-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.tube-chip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 18rpx;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10rpx;
}

.tube-chip.active {
  background: #e6f4ff;
  border-color: #91caff;
}

.chip-checkbox {
  width: 24rpx;
  height: 24rpx;
  line-height: 24rpx;
  border-radius: 4rpx;
  font-size: 20rpx;
  text-align: center;
  color: #1677ff;
  font-weight: bold;
}

.chip-text {
  font-size: 24rpx;
  color: #4b5563;
}

.tube-chip.active .chip-text {
  color: #1677ff;
  font-weight: 500;
}

.form-textarea {
  width: 100%;
  height: 120rpx;
  padding: 16rpx;
  box-sizing: border-box;
  border: 1px solid #d9d9d9;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #1f2937;
}

.patient-modal-footer {
  flex-shrink: 0;
  display: flex;
  gap: 20rpx;
  margin-top: 20rpx;
  padding-top: 18rpx;
  padding-bottom: 10rpx;
  border-top: 1px solid #f0f0f0;
}

.p-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 14rpx;
  font-size: 30rpx;
  font-weight: 500;
}

.p-btn.cancel {
  background: #f3f4f6;
  color: #4b5563;
}

.p-btn.confirm {
  background: #1677ff;
  color: #ffffff;
}
</style>
