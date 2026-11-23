<template>
  <view class="special-record-container">
    <!-- 顶部状态与日期卡片 -->
    <view class="top-meta-card">
      <view class="date-ward-row">
        <picker mode="date" :value="currentDate" @change="onDateChange">
          <view class="date-picker-wrap">
            <text class="date-text">{{ currentDate }}</text>
            <text class="picker-arrow">▾</text>
          </view>
        </picker>
        <view class="status-badge" :class="statusBadgeClass">
          {{ statusBadgeText }}
        </view>
      </view>

      <view class="ward-desc-row">
        <text class="ward-desc">当前病区：{{ currentWardName }} (共 {{ inBedPatients.length }} 位在床患者)</text>
        <view class="history-entry-btn" @tap="goToHistoryPage">
          <text>🗂️ 历史清册</text>
        </view>
      </view>

      <!-- 历史只读模式提示横幅（限制只能填写当天的） -->
      <view class="history-mode-banner" v-if="!isToday">
        <text class="banner-text">⚠️ 历史记录查阅模式 (只读)，交班填报仅限当天！</text>
        <button class="back-today-btn" size="mini" @tap="backToToday">返回今日</button>
      </view>

      <!-- 交接双方留痕信息条 -->
      <view class="handover-flow-info" v-if="handoverNurseName || successorNurseName">
        <view class="flow-col">
          <text class="f-label">交班护士:</text>
          <text class="f-val">{{ handoverNurseName || '当班护士' }}</text>
          <text class="f-time" v-if="handoverTimeStr">{{ handoverTimeStr }}</text>
        </view>
        <text class="flow-arrow">→</text>
        <view class="flow-col">
          <text class="f-label">接班护士:</text>
          <text class="f-val">{{ successorNurseName || '待指定' }}</text>
          <text class="f-status" :class="successorConfirmTime ? 'confirmed' : 'pending'">
            {{ successorConfirmTime ? `已接班 (${successorConfirmTime.substring(11, 16)})` : '待接班确认' }}
          </text>
        </view>
      </view>

      <!-- 特别备忘预览 -->
      <view class="handover-notes-box" v-if="handoverNotes">
        <text class="notes-tag">交班备忘:</text>
        <text class="notes-content">{{ handoverNotes }}</text>
      </view>
    </view>

    <!-- 分段导航 -->
    <view class="tab-segment">
      <view
        :class="['tab-btn', currentSegment === 'focus' ? 'active' : '']"
        @tap="currentSegment = 'focus'"
      >
        特殊关注项 (7项)
      </view>
      <view
        :class="['tab-btn', currentSegment === 'pipes' ? 'active' : '']"
        @tap="currentSegment = 'pipes'"
      >
        巡视与导管留置 (12项)
      </view>
    </view>

    <!-- 1. 特殊关注项 (7项) -->
    <view class="section-content" v-if="currentSegment === 'focus'">
      <!-- 请假 -->
      <view class="group-box">
        <view class="group-header">
          <text class="group-title">请假病患</text>
          <text class="add-text" v-if="canEdit" @tap="openQuickPicker('leave')">+ 选床登记</text>
        </view>
        <view class="tags-wrap" v-if="leaveList.length > 0">
          <view class="chip" v-for="(item, idx) in leaveList" :key="idx">
            {{ item.bedNo }} {{ item.patientName }}
            <text class="close-x" v-if="canEdit" @tap="leaveList.splice(idx, 1)">×</text>
          </view>
        </view>
        <view class="empty-hint" v-else>无请假离院病患</view>
      </view>

      <!-- 泻药 -->
      <view class="group-box">
        <view class="group-header">
          <text class="group-title">泻药服用</text>
          <text class="add-text" v-if="canEdit" @tap="openQuickPicker('laxative')">+ 选床登记</text>
        </view>
        <view class="items-list" v-if="laxativeList.length > 0">
          <view class="item-card" v-for="(item, idx) in laxativeList" :key="idx">
            <text class="item-bed">{{ item.bedNo }} {{ item.patientName }}</text>
            <text class="item-detail">{{ item.time }} {{ item.name }}</text>
            <text class="close-x" v-if="canEdit" @tap="laxativeList.splice(idx, 1)">×</text>
          </view>
        </view>
        <view class="empty-hint" v-else>无服用泻药记录</view>
      </view>

      <!-- 体温异常 -->
      <view class="group-box">
        <view class="group-header">
          <text class="group-title">体温异常 (≥37.5℃)</text>
          <text class="add-text" v-if="canEdit" @tap="openQuickPicker('temp')">+ 选床登记</text>
        </view>
        <view class="tags-wrap" v-if="tempList.length > 0">
          <view class="chip warn" v-for="(item, idx) in tempList" :key="idx">
            {{ item.bedNo }} {{ item.patientName }}: {{ item.val }}℃
            <text class="close-x" v-if="canEdit" @tap="tempList.splice(idx, 1)">×</text>
          </view>
        </view>
        <view class="empty-hint" v-else>病区体温均正常</view>
      </view>

      <!-- 血糖 -->
      <view class="group-box">
        <view class="group-header">
          <text class="group-title">血糖监测</text>
          <text class="add-text" v-if="canEdit" @tap="openQuickPicker('sugar')">+ 选床登记</text>
        </view>
        <view class="tags-wrap" v-if="sugarList.length > 0">
          <view class="chip" v-for="(item, idx) in sugarList" :key="idx">
            {{ item.bedNo }} {{ item.patientName }}: {{ item.type }} {{ item.val }}
            <text class="close-x" v-if="canEdit" @tap="sugarList.splice(idx, 1)">×</text>
          </view>
        </view>
        <view class="empty-hint" v-else>无特殊血糖记录</view>
      </view>

      <!-- 血压 -->
      <view class="group-box">
        <view class="group-header">
          <text class="group-title">异常血压</text>
          <text class="add-text" v-if="canEdit" @tap="openQuickPicker('bp')">+ 选床登记</text>
        </view>
        <view class="tags-wrap" v-if="bpList.length > 0">
          <view class="chip" v-for="(item, idx) in bpList" :key="idx">
            {{ item.bedNo }} {{ item.patientName }}: {{ item.val }} mmHg
            <text class="close-x" v-if="canEdit" @tap="bpList.splice(idx, 1)">×</text>
          </view>
        </view>
        <view class="empty-hint" v-else>无异常血压记录</view>
      </view>

      <!-- 尿量关注 -->
      <view class="group-box">
        <view class="group-header">
          <text class="group-title">尿量关注 / 少尿</text>
          <text class="add-text" v-if="canEdit" @tap="openQuickPicker('urine')">+ 选床登记</text>
        </view>
        <view class="tags-wrap" v-if="urineList.length > 0">
          <view class="chip warn" v-for="(item, idx) in urineList" :key="idx">
            {{ item.bedNo }} {{ item.patientName }}: {{ item.val }} ml
            <text class="close-x" v-if="canEdit" @tap="urineList.splice(idx, 1)">×</text>
          </view>
        </view>
        <view class="empty-hint" v-else>尿量监测正常</view>
      </view>

      <!-- 特殊情况 -->
      <view class="group-box">
        <view class="group-header">
          <text class="group-title">特殊情况自由记录</text>
        </view>
        <textarea
          v-if="canEdit"
          class="special-textarea"
          v-model="specialCasesText"
          placeholder="在此输入交班特别交待、跌倒防范、抢救记录、夜间特殊处置等..."
        />
        <text class="locked-text" v-else>{{ specialCasesText || '无特殊情况记录' }}</text>
      </view>
    </view>

    <!-- 2. 巡视与导管留置 (12项，带加号选床登记) -->
    <view class="section-content" v-else>
      <view class="pipe-hint-banner">
        💡 系统已智能预填，亦可轻点「+ 选床登记」添加或移除病患
      </view>

      <view class="group-box" v-for="p in pipeConfigs" :key="p.key">
        <view class="group-header">
          <text class="group-title">{{ p.name }}</text>
          <text class="add-text" v-if="canEdit" @tap="openQuickPicker('pipe', p.key, p.name)">+ 选床登记</text>
        </view>
        <view class="tags-wrap" v-if="pipes[p.key] && pipes[p.key].length > 0">
          <view class="chip" v-for="(item, idx) in pipes[p.key]" :key="idx">
            {{ item.bedNo }} {{ item.patientName }}<text v-if="item.drug || item.time" style="font-size: 22rpx; margin-left: 6rpx; color: #0958d9;">({{ [item.time, item.drug].filter(Boolean).join(' ') }})</text>
            <text class="close-x" v-if="canEdit" @tap="pipes[p.key].splice(idx, 1)">×</text>
          </view>
        </view>
        <view class="empty-hint" v-else>暂无留置患者</view>
      </view>
    </view>

    <!-- 快速选床与录入弹窗 -->
    <view class="modal-mask" v-if="showPickerModal" @tap="showPickerModal = false">
      <view class="picker-panel" @tap.stop>
        <view class="picker-header">
          <text class="picker-title">{{ currentPickerTitle }}</text>
          <text class="picker-close" @tap="showPickerModal = false">✕</text>
        </view>

        <!-- 在床患者快捷点选矩阵 -->
        <view class="picker-sub">第一步：轻点选择床位</view>
        <view class="bed-matrix">
          <view
            v-for="p in inBedPatients"
            :key="p.id"
            :class="['matrix-btn', selectedPatient?.id === p.id ? 'active' : '']"
            @tap="selectedPatient = p"
          >
            <text class="b-no">{{ p.bedNo }}</text>
            <text class="b-name">{{ p.patientName }}</text>
          </view>
        </view>

        <!-- 第二步：数值录入 -->
        <view class="picker-sub" style="margin-top: 24rpx;" v-if="pickerType !== 'pipe' && pickerType !== 'leave'">第二步：输入数值</view>
        <view class="picker-sub selected-tip" style="margin-top: 24rpx;" v-else-if="currentPipeKey === 'maint'">第二步：录入用药信息 (已选中 {{ selectedPatient?.bedNo }} {{ selectedPatient?.patientName }})</view>
        <view class="picker-sub selected-tip" style="margin-top: 24rpx;" v-else>第二步：已选中 {{ selectedPatient?.bedNo }} {{ selectedPatient?.patientName }}</view>

        <!-- 维持液用药信息 -->
        <view v-if="pickerType === 'pipe' && currentPipeKey === 'maint'" class="input-row-col">
          <picker mode="time" :value="maintFluidTime" @change="(e) => maintFluidTime = e.detail.value">
            <view class="picker-trigger-box">
              <text class="picker-t-label">用药时间 (几点用药):</text>
              <text class="picker-t-val">{{ maintFluidTime }} ▾</text>
            </view>
          </picker>
          <input class="val-input" v-model="maintFluidDrug" placeholder="具体用的什么药 (如: 0.9%氯化钠250ml+氯化钾)" style="margin-top: 14rpx;" />
        </view>

        <!-- 体温快捷 (33-45°C) -->
        <view v-if="pickerType === 'temp'" class="input-row">
          <input type="digit" class="val-input" v-model="tempInput" placeholder="输入温度 33-45℃" />
          <view class="quick-chips">
            <view class="q-chip" @tap="tempInput = '36.5'">36.5℃</view>
            <view class="q-chip" @tap="tempInput = '37.8'">37.8℃</view>
            <view class="q-chip" @tap="tempInput = '38.5'">38.5℃</view>
          </view>
        </view>

        <!-- 血压 (000-999) -->
        <view v-if="pickerType === 'bp'" class="input-row">
          <input class="val-input" v-model="bpHigh" placeholder="收缩压 000-999" maxlength="3" style="width: 220rpx;" />
          <text style="margin: 0 10rpx;">/</text>
          <input class="val-input" v-model="bpLow" placeholder="舒张压 000-999" maxlength="3" style="width: 220rpx;" />
        </view>

        <!-- 血糖 -->
        <view v-if="pickerType === 'sugar'" class="input-row">
          <input class="val-input" v-model="sugarType" placeholder="空腹/餐后2h" style="width: 200rpx;" />
          <input type="digit" class="val-input" v-model="sugarVal" placeholder="mmol/L" style="width: 200rpx; margin-left: 16rpx;" />
        </view>

        <!-- 尿量 -->
        <view v-if="pickerType === 'urine'" class="input-row">
          <input type="number" class="val-input" v-model="urineVal" placeholder="尿量(ml)" />
        </view>

        <!-- 泻药 -->
        <view v-if="pickerType === 'laxative'" class="input-row-col">
          <input class="val-input" v-model="laxativeTime" placeholder="服药时间 (如 14:00)" />
          <input class="val-input" v-model="laxativeName" placeholder="药名 (如 复方聚乙二醇)" style="margin-top: 14rpx;" />
        </view>

        <view class="picker-actions">
          <button class="confirm-btn" @tap="confirmQuickAdd">加入记录</button>
        </view>
      </view>
    </view>

    <!-- 弹窗：交班提交 - 必须选择接班护士与备忘 -->
    <view class="modal-mask" v-if="showSubmitModal" @tap="showSubmitModal = false">
      <view class="modal-box submit-modal-panel" @tap.stop>
        <view class="submit-modal-header">
          <text class="submit-modal-title">交班提交确认</text>
          <text class="modal-close" @tap="showSubmitModal = false">✕</text>
        </view>

        <view class="submit-info-row">
          <text class="s-label">当班交班护士:</text>
          <text class="s-val">{{ currentNurseRealName }}</text>
        </view>

        <view class="submit-form-item">
          <text class="s-label required">第一步：指定接班护士 *</text>
          <view class="nurse-select-matrix">
            <view
              v-for="nurse in nurseList"
              :key="nurse.id"
              :class="['nurse-chip', selectedSuccessorNurse?.id === nurse.id ? 'active' : '']"
              @tap="selectedSuccessorNurse = nurse"
            >
              <text class="n-name">{{ nurse.realName }}</text>
              <text class="n-job">{{ nurse.jobNumber || '护士' }}</text>
            </view>
          </view>
        </view>

        <view class="submit-form-item">
          <text class="s-label">第二步：交班特别备忘 / 嘱咐事项</text>
          <textarea
            class="submit-notes-input"
            v-model="handoverNotesInput"
            placeholder="可输入给接班护士的重点交班嘱咐、夜间注意事项等..."
          />
        </view>

        <view class="modal-btns">
          <button class="m-btn cancel" @tap="showSubmitModal = false">取消</button>
          <button class="m-btn confirm-submit" :loading="saving" @tap="confirmSubmitHandover">
            确认提交交班
          </button>
        </view>
      </view>
    </view>

    <!-- 底部常驻操作栏 -->
    <view class="bottom-action-bar">
      <!-- 模式一：当前是今日且未归档，显示保存和交班提交 -->
      <block v-if="canEdit">
        <button class="action-btn draft" :loading="saving" @tap="handleSaveDraft">保存草稿</button>
        <button class="action-btn submit" @tap="openSubmitHandoverModal">交班提交</button>
      </block>

      <!-- 模式二：已提交交班，但待接班确认 -->
      <block v-if="recordStatus === 'SUBMITTED' && !successorConfirmTime">
        <button class="action-btn confirm-duty" @tap="handleConfirmDuty">
          ✓ 确认接班
        </button>
      </block>

      <!-- 模式三：护士长核签按钮 -->
      <button class="action-btn sign" v-if="userStore.isHeadNurse && recordStatus === 'SUBMITTED'" @tap="handleSign">
        护士长核签
      </button>

      <!-- 模式四：历史查看模式，提供一键回到今日 -->
      <button class="action-btn back-today-action" v-if="!isToday" @tap="backToToday">
        📅 返回今日填报
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getSpecialHandoverApi, saveSpecialHandoverApi, signSpecialHandoverApi, confirmSpecialHandoverApi } from '../../api/handover'
import { getPatientsApi } from '../../api/patient'
import { getNurseOptionsApi } from '../../api/nurse'
import { useUserStore } from '../../stores/user'

const userStore = useUserStore()
const currentWardId = ref(36)
const currentDate = ref('')
const todayDateStr = ref('')
const recordStatus = ref('DRAFT')
const recordId = ref(null)
const currentSegment = ref('focus')
const saving = ref(false)

// 交接信息
const handoverNurseId = ref(null)
const handoverNurseName = ref('')
const handoverTimeStr = ref('')
const successorNurseId = ref(null)
const successorNurseName = ref('')
const successorConfirmTime = ref('')
const handoverNotes = ref('')
const currentNurseRealName = computed(() => userStore.userInfo?.realName || '当班护士')

const inBedPatients = ref([])
const selectedPatient = ref(null)

// 关注项
const leaveList = ref([])
const laxativeList = ref([])
const tempList = ref([])
const sugarList = ref([])
const bpList = ref([])
const urineList = ref([])
const specialCasesText = ref('')

// 12项管路巡视
const pipes = reactive({
  level1: [],
  monitor: [],
  maint: [],
  ivg: [],
  picc: [],
  cvc: [],
  port: [],
  nasobiliary: [],
  gastro: [],
  catheter: [],
  abdom: [],
  other: []
})

const pipeConfigs = [
  { name: 'I级护理', key: 'level1' },
  { name: '监护', key: 'monitor' },
  { name: '维持液', key: 'maint' },
  { name: 'IVG (静滴)', key: 'ivg' },
  { name: 'PICC', key: 'picc' },
  { name: 'CVC', key: 'cvc' },
  { name: 'PORT', key: 'port' },
  { name: '鼻胆管', key: 'nasobiliary' },
  { name: '胃肠减压', key: 'gastro' },
  { name: '导尿管', key: 'catheter' },
  { name: '腹腔引流管', key: 'abdom' },
  { name: '其他导管', key: 'other' }
]

// 选床录入弹窗状态
const showPickerModal = ref(false)
const pickerType = ref('')
const currentPickerTitle = ref('')
const tempInput = ref('38.2')
const bpHigh = ref('145')
const bpLow = ref('90')
const sugarType = ref('空腹')
const sugarVal = ref('10.5')
const urineVal = ref('200')
const laxativeTime = ref('14:00')
const laxativeName = ref('复方聚乙二醇')
const maintFluidTime = ref('14:00')
const maintFluidDrug = ref('')

// 交班提交弹窗状态
const showSubmitModal = ref(false)
const nurseList = ref([])
const selectedSuccessorNurse = ref(null)
const handoverNotesInput = ref('')

const isToday = computed(() => currentDate.value === todayDateStr.value)
const canEdit = computed(() => isToday.value && recordStatus.value !== 'LOCKED')

const currentWardName = computed(() => {
  return userStore.userInfo?.wardName || '7#19B消化内科三病区'
})

const statusBadgeClass = computed(() => {
  if (recordStatus.value === 'LOCKED') return 'locked'
  if (successorConfirmTime.value) return 'confirmed'
  if (recordStatus.value === 'SUBMITTED') return 'submitted'
  return 'draft'
})

const statusBadgeText = computed(() => {
  if (recordStatus.value === 'LOCKED') return '🔒 护士长已核签归档'
  if (successorConfirmTime.value) return '✓ 已接班确认'
  if (recordStatus.value === 'SUBMITTED') return '⏳ 已交班 (待接班确认)'
  return '✎ 草稿编辑中'
})

const pad = (n) => (n < 10 ? '0' + n : n)

onLoad((options) => {
  const now = new Date()
  todayDateStr.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  currentDate.value = options.date || todayDateStr.value
  currentWardId.value = userStore.userInfo?.wardId || 36
  loadData()
  loadNurses()
})

const backToToday = () => {
  currentDate.value = todayDateStr.value
  loadData()
}

const onDateChange = (e) => {
  const val = e.detail.value
  currentDate.value = val
  if (val !== todayDateStr.value) {
    uni.showToast({ title: '已进入历史查看模式 (只读)', icon: 'none' })
  }
  loadData()
}

const goToHistoryPage = () => {
  uni.navigateTo({ url: '/pages/handover/history' })
}

const loadNurses = async () => {
  try {
    const res = await getNurseOptionsApi(currentWardId.value)
    nurseList.value = (res || []).filter(n => n.status === 1)
  } catch (e) {}
}

const loadData = async () => {
  try {
    // 1. 获取在床患者
    const pList = await getPatientsApi(currentWardId.value)
    inBedPatients.value = (pList || []).filter(p => p.status === 1)
    if (inBedPatients.value.length > 0) {
      selectedPatient.value = inBedPatients.value[0]
    }

    // 2. 获取交接表
    const res = await getSpecialHandoverApi(currentWardId.value, currentDate.value)
    if (res) {
      recordId.value = res.id
      recordStatus.value = res.status || 'DRAFT'
      handoverNurseId.value = res.handoverNurseId
      handoverNurseName.value = res.handoverNurseName
      handoverTimeStr.value = res.handoverTime ? res.handoverTime.replace('T', ' ').substring(11, 16) : ''
      successorNurseId.value = res.successorNurseId
      successorNurseName.value = res.successorNurseName
      successorConfirmTime.value = res.successorConfirmTime || ''
      handoverNotes.value = res.handoverNotes || ''

      leaveList.value = JSON.parse(res.leaveHospitalJson || '[]')
      laxativeList.value = JSON.parse(res.laxativeJson || '[]')
      tempList.value = JSON.parse(res.temperatureAbnormalJson || '[]')
      sugarList.value = JSON.parse(res.bloodSugarJson || '[]')
      bpList.value = JSON.parse(res.bloodPressureJson || '[]')
      urineList.value = JSON.parse(res.urineVolumeJson || '[]')
      specialCasesText.value = res.specialCases || ''

      pipes.level1 = JSON.parse(res.pipeLevel1Json || '[]')
      pipes.monitor = JSON.parse(res.pipeMonitorJson || '[]')
      pipes.maint = JSON.parse(res.pipeMaintFluidJson || '[]')
      pipes.ivg = JSON.parse(res.pipeIvgJson || '[]')
      pipes.picc = JSON.parse(res.pipePiccJson || '[]')
      pipes.cvc = JSON.parse(res.pipeCvcJson || '[]')
      pipes.port = JSON.parse(res.pipePortJson || '[]')
      pipes.nasobiliary = JSON.parse(res.pipeNasobiliaryJson || '[]')
      pipes.gastro = JSON.parse(res.pipeGastroDecompJson || '[]')
      pipes.catheter = JSON.parse(res.pipeCatheterJson || '[]')
      pipes.abdom = JSON.parse(res.pipeAbdomDrainJson || '[]')
      pipes.other = JSON.parse(res.pipeOtherJson || '[]')
    }
  } catch (e) {}
}

let currentPipeKey = ''
const openQuickPicker = (type, pipeKey = '', pipeName = '') => {
  if (!canEdit.value) return
  pickerType.value = type
  if (type === 'pipe') {
    currentPipeKey = pipeKey
    currentPickerTitle.value = `登记【${pipeName}】病患`
    if (pipeKey === 'maint') {
      const now = new Date()
      maintFluidTime.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`
      maintFluidDrug.value = ''
    }
  } else if (type === 'leave') currentPickerTitle.value = '请假病患登记'
  else if (type === 'temp') currentPickerTitle.value = '异常体温登记'
  else if (type === 'laxative') currentPickerTitle.value = '泻药服用登记'
  else if (type === 'bp') currentPickerTitle.value = '异常血压登记'
  else if (type === 'sugar') currentPickerTitle.value = '血糖登记'
  else if (type === 'urine') currentPickerTitle.value = '尿量关注登记'
  showPickerModal.value = true
}

const confirmQuickAdd = () => {
  if (!selectedPatient.value) {
    uni.showToast({ title: '请先点选床位', icon: 'none' })
    return
  }
  const base = {
    bedNo: selectedPatient.value.bedNo,
    patientId: selectedPatient.value.id,
    patientName: selectedPatient.value.patientName
  }

  if (pickerType.value === 'pipe' && currentPipeKey) {
    const list = pipes[currentPipeKey] || []
    if (currentPipeKey === 'maint') {
      if (!maintFluidDrug.value.trim()) {
        uni.showToast({ title: '请输入使用的药品名称', icon: 'none' })
        return
      }
      list.push({
        ...base,
        drug: maintFluidDrug.value.trim(),
        time: maintFluidTime.value || ''
      })
    } else {
      if (list.some(i => i.patientId === base.patientId)) {
        uni.showToast({ title: '该病患已在列表中', icon: 'none' })
        return
      }
      list.push(base)
    }
  } else if (pickerType.value === 'leave') {
    if (leaveList.value.some(i => i.patientId === base.patientId)) {
      uni.showToast({ title: '该病患已在请假列表', icon: 'none' })
      return
    }
    leaveList.value.push(base)
  } else if (pickerType.value === 'temp') {
    const val = Number(tempInput.value)
    if (isNaN(val) || val < 33 || val > 45) {
      uni.showToast({ title: '体温范围须在 33-45℃ 之间', icon: 'none' })
      return
    }
    tempList.value.push({ ...base, val })
  } else if (pickerType.value === 'bp') {
    bpList.value.push({ ...base, val: `${bpHigh.value}-${bpLow.value}` })
  } else if (pickerType.value === 'sugar') {
    sugarList.value.push({ ...base, type: sugarType.value, val: Number(sugarVal.value) })
  } else if (pickerType.value === 'urine') {
    urineList.value.push({ ...base, val: Number(urineVal.value) })
  } else if (pickerType.value === 'laxative') {
    laxativeList.value.push({ ...base, time: laxativeTime.value, name: laxativeName.value })
  }

  showPickerModal.value = false
  uni.showToast({ title: '已加入', icon: 'success' })
}

// 保存草稿
const handleSaveDraft = async () => {
  if (!isToday.value) {
    uni.showToast({ title: '只能保存当天的交班记录', icon: 'none' })
    return
  }
  await executeSave('DRAFT')
}

// 移动端交班：必须弹出选择接班人弹窗
const openSubmitHandoverModal = async () => {
  if (!isToday.value) {
    uni.showToast({ title: '只能提交当天的交班记录', icon: 'none' })
    return
  }
  await loadNurses()
  handoverNotesInput.value = handoverNotes.value || ''
  if (!selectedSuccessorNurse.value && nurseList.value.length > 0) {
    selectedSuccessorNurse.value = nurseList.value[0]
  }
  showSubmitModal.value = true
}

// 确认提交交班
const confirmSubmitHandover = async () => {
  if (!selectedSuccessorNurse.value) {
    uni.showToast({ title: '请选择接班护士', icon: 'none' })
    return
  }
  await executeSave(
    'SUBMITTED',
    selectedSuccessorNurse.value.id,
    selectedSuccessorNurse.value.realName,
    handoverNotesInput.value
  )
  showSubmitModal.value = false
}

// 执行接口保存
const executeSave = async (targetStatus, successorId = null, successorName = '', notes = '') => {
  saving.value = true
  try {
    const payload = {
      id: recordId.value,
      wardId: currentWardId.value,
      handoverDate: currentDate.value,
      shiftType: 'ALL_DAY',
      status: targetStatus,
      successorNurseId: successorId || successorNurseId.value,
      successorNurseName: successorName || successorNurseName.value,
      handoverNotes: notes || handoverNotes.value,
      leaveHospitalJson: JSON.stringify(leaveList.value),
      laxativeJson: JSON.stringify(laxativeList.value),
      temperatureAbnormalJson: JSON.stringify(tempList.value),
      bloodSugarJson: JSON.stringify(sugarList.value),
      bloodPressureJson: JSON.stringify(bpList.value),
      urineVolumeJson: JSON.stringify(urineList.value),
      specialCases: specialCasesText.value,
      pipeLevel1Json: JSON.stringify(pipes.level1),
      pipeMonitorJson: JSON.stringify(pipes.monitor),
      pipeMaintFluidJson: JSON.stringify(pipes.maint),
      pipeIvgJson: JSON.stringify(pipes.ivg),
      pipePiccJson: JSON.stringify(pipes.picc),
      pipeCvcJson: JSON.stringify(pipes.cvc),
      pipePortJson: JSON.stringify(pipes.port),
      pipeNasobiliaryJson: JSON.stringify(pipes.nasobiliary),
      pipeGastroDecompJson: JSON.stringify(pipes.gastro),
      pipeCatheterJson: JSON.stringify(pipes.catheter),
      pipeAbdomDrainJson: JSON.stringify(pipes.abdom),
      pipeOtherJson: JSON.stringify(pipes.other)
    }

    const id = await saveSpecialHandoverApi(payload)
    recordId.value = id
    recordStatus.value = targetStatus
    uni.showToast({
      title: targetStatus === 'SUBMITTED' ? '已提交交班，等待接班确认' : '草稿保存成功',
      icon: 'success'
    })
    await loadData()
  } catch (e) {
  } finally {
    saving.value = false
  }
}

// 接班护士确认接班
const handleConfirmDuty = () => {
  uni.showModal({
    title: '确认接班',
    content: `确认已完成病区床位现场交接，正式接班【${currentDate.value}】记录？`,
    confirmText: '确认接班',
    success: async (res) => {
      if (res.confirm) {
        try {
          await confirmSpecialHandoverApi(recordId.value)
          uni.showToast({ title: '已完成接班确认', icon: 'success' })
          await loadData()
        } catch (e) {}
      }
    }
  })
}

// 护士长核签
const handleSign = async () => {
  uni.showModal({
    title: '护士长核签',
    content: '确认核签并归档该交接表？归档后将锁定为只读。',
    confirmText: '核签归档',
    success: async (res) => {
      if (res.confirm) {
        try {
          await signSpecialHandoverApi(recordId.value)
          uni.showToast({ title: '核签归档成功', icon: 'success' })
          await loadData()
        } catch (e) {}
      }
    }
  })
}
</script>

<style scoped>
.special-record-container {
  padding: 20rpx;
  background-color: #f5f7fa;
  min-height: 100vh;
  box-sizing: border-box;
  padding-bottom: 140rpx;
}

.top-meta-card {
  background: #ffffff;
  padding: 24rpx;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.04);
}

.date-ward-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.date-picker-wrap {
  display: flex;
  align-items: center;
  background: #eef3ff;
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
}

.date-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #1677ff;
}

.picker-arrow {
  font-size: 20rpx;
  margin-left: 8rpx;
  color: #1677ff;
}

.status-badge {
  font-size: 24rpx;
  padding: 8rpx 18rpx;
  border-radius: 30rpx;
  font-weight: 500;
}

.status-badge.draft {
  background: #f0f0f0;
  color: #595959;
}

.status-badge.submitted {
  background: #fff7e6;
  color: #d46b08;
}

.status-badge.confirmed {
  background: #f6ffed;
  color: #52c41a;
}

.status-badge.locked {
  background: #fff1f0;
  color: #cf1322;
}

.ward-desc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12rpx;
}

.ward-desc {
  font-size: 24rpx;
  color: #8c8c8c;
}

.history-entry-btn {
  display: flex;
  align-items: center;
  font-size: 24rpx;
  color: #1677ff;
  background: #f0f5ff;
  border: 1px solid #d6e4ff;
  padding: 6rpx 16rpx;
  border-radius: 24rpx;
  font-weight: 500;
}

/* 历史只读提示横幅 */
.history-mode-banner {
  background: #fffbe6;
  border: 1rpx solid #ffe58f;
  padding: 12rpx 16rpx;
  border-radius: 8rpx;
  margin-top: 14rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.banner-text {
  font-size: 22rpx;
  color: #d46b08;
  flex: 1;
}

.back-today-btn {
  background: #faad14;
  color: #ffffff;
  font-size: 20rpx;
  border-radius: 20rpx;
  padding: 0 16rpx;
  height: 44rpx;
  line-height: 44rpx;
  margin: 0;
}

/* 交接双方留痕信息条 */
.handover-flow-info {
  display: flex;
  align-items: center;
  background: #f8faff;
  border: 1rpx solid #e6f0ff;
  border-radius: 10rpx;
  padding: 14rpx 18rpx;
  margin-top: 16rpx;
}

.flow-col {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.f-label {
  font-size: 20rpx;
  color: #8c8c8c;
}

.f-val {
  font-size: 26rpx;
  font-weight: bold;
  color: #262626;
  margin-top: 2rpx;
}

.f-time {
  font-size: 20rpx;
  color: #909399;
}

.f-status {
  font-size: 20rpx;
  margin-top: 2rpx;
}

.f-status.pending {
  color: #fa8c16;
  font-weight: 500;
}

.f-status.confirmed {
  color: #52c41a;
  font-weight: bold;
}

.flow-arrow {
  color: #bfbfbf;
  font-size: 28rpx;
  padding: 0 16rpx;
}

.handover-notes-box {
  background: #fffdf5;
  border-left: 6rpx solid #faad14;
  padding: 10rpx 14rpx;
  margin-top: 12rpx;
  border-radius: 4rpx;
  font-size: 22rpx;
}

.notes-tag {
  color: #d46b08;
  font-weight: bold;
  margin-right: 8rpx;
}

.notes-content {
  color: #595959;
}

.tab-segment {
  display: flex;
  background: #eef0f4;
  border-radius: 12rpx;
  padding: 6rpx;
  margin-bottom: 20rpx;
}

.tab-btn {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 28rpx;
  color: #595959;
  border-radius: 8rpx;
}

.tab-btn.active {
  background: #ffffff;
  color: #1677ff;
  font-weight: bold;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.group-box {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.group-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #262626;
}

.add-text {
  font-size: 24rpx;
  color: #1677ff;
  font-weight: 500;
}

.tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.chip {
  background: #f0f7ff;
  border: 1rpx solid #bae0ff;
  border-radius: 8rpx;
  padding: 8rpx 16rpx;
  font-size: 26rpx;
  color: #1677ff;
  display: flex;
  align-items: center;
}

.chip.warn {
  background: #fffbe6;
  border-color: #ffe58f;
  color: #d46b08;
}

.close-x {
  margin-left: 10rpx;
  font-size: 28rpx;
  color: #999;
}

.empty-hint {
  font-size: 24rpx;
  color: #bfbfbf;
  padding: 8rpx 0;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.item-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafafa;
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  font-size: 26rpx;
}

.item-bed {
  font-weight: bold;
  color: #262626;
}

.item-detail {
  color: #1677ff;
}

.special-textarea {
  width: 100%;
  height: 180rpx;
  background: #fafafa;
  border-radius: 8rpx;
  padding: 16rpx;
  box-sizing: border-box;
  font-size: 26rpx;
  color: #262626;
}

.locked-text {
  font-size: 26rpx;
  color: #595959;
  line-height: 1.6;
}

.pipe-hint-banner {
  font-size: 22rpx;
  color: #1677ff;
  background: #e6f4ff;
  padding: 14rpx;
  border-radius: 8rpx;
  margin-bottom: 20rpx;
}

/* 弹窗通用 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.picker-panel,
.modal-box {
  background: #ffffff;
  width: 86%;
  border-radius: 20rpx;
  padding: 32rpx;
  box-sizing: border-box;
}

.submit-modal-panel {
  max-height: 85vh;
}

.picker-header,
.submit-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.picker-title,
.submit-modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #262626;
}

.picker-close,
.modal-close {
  font-size: 36rpx;
  color: #909399;
  padding: 8rpx;
}

.picker-sub {
  font-size: 24rpx;
  color: #8c8c8c;
  margin-bottom: 12rpx;
}

.selected-tip {
  color: #1677ff;
  font-weight: bold;
}

.bed-matrix {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  max-height: 240rpx;
  overflow-y: auto;
}

.matrix-btn {
  border: 1rpx solid #dcdfe6;
  border-radius: 8rpx;
  padding: 8rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100rpx;
}

.matrix-btn.active {
  border-color: #1677ff;
  background: #e6f4ff;
}

.matrix-btn .b-no {
  font-size: 24rpx;
  font-weight: bold;
  color: #1677ff;
}

.matrix-btn .b-name {
  font-size: 20rpx;
  color: #595959;
}

.input-row {
  display: flex;
  align-items: center;
}

.val-input {
  background: #f5f7fa;
  height: 72rpx;
  border-radius: 8rpx;
  padding: 0 16rpx;
  font-size: 28rpx;
}

.quick-chips {
  display: flex;
  gap: 10rpx;
  margin-left: 16rpx;
}

.q-chip {
  background: #e6f4ff;
  color: #1677ff;
  font-size: 22rpx;
  padding: 6rpx 14rpx;
  border-radius: 6rpx;
}

.input-row-col {
  display: flex;
  flex-direction: column;
}

.picker-trigger-box {
  background: #f5f7fa;
  height: 72rpx;
  border-radius: 8rpx;
  padding: 0 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-t-label {
  font-size: 26rpx;
  color: #595959;
}

.picker-t-val {
  font-size: 28rpx;
  color: #1677ff;
  font-weight: 500;
}

.picker-actions {
  margin-top: 32rpx;
}

.confirm-btn {
  background: #1677ff;
  color: #ffffff;
  font-size: 28rpx;
  border-radius: 36rpx;
}

/* 交班提交选择接班人样式 */
.submit-info-row {
  display: flex;
  align-items: center;
  background: #f5f7fa;
  padding: 14rpx 18rpx;
  border-radius: 8rpx;
  margin-bottom: 20rpx;
}

.s-label {
  font-size: 26rpx;
  color: #595959;
  margin-right: 12rpx;
}

.s-label.required {
  color: #303133;
  font-weight: bold;
  display: block;
  margin-bottom: 12rpx;
}

.s-val {
  font-size: 28rpx;
  color: #1677ff;
  font-weight: bold;
}

.submit-form-item {
  margin-bottom: 24rpx;
}

.nurse-select-matrix {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  max-height: 220rpx;
  overflow-y: auto;
}

.nurse-chip {
  border: 1rpx solid #dcdfe6;
  border-radius: 10rpx;
  padding: 10rpx 18rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 120rpx;
  background: #fafafa;
}

.nurse-chip.active {
  border-color: #1677ff;
  background: #e6f4ff;
}

.nurse-chip .n-name {
  font-size: 26rpx;
  font-weight: bold;
  color: #262626;
}

.nurse-chip.active .n-name {
  color: #1677ff;
}

.nurse-chip .n-job {
  font-size: 20rpx;
  color: #8c8c8c;
}

.submit-notes-input {
  width: 100%;
  height: 140rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
  padding: 14rpx;
  box-sizing: border-box;
  font-size: 26rpx;
}

.modal-btns {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
}

.m-btn {
  flex: 1;
  height: 76rpx;
  line-height: 76rpx;
  font-size: 28rpx;
  border-radius: 38rpx;
}

.m-btn.cancel {
  background: #f5f5f5;
  color: #595959;
}

.m-btn.confirm-submit {
  background: #1677ff;
  color: #ffffff;
}

/* 底部操作栏 */
.bottom-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #ffffff;
  padding: 16rpx 24rpx;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
  display: flex;
  gap: 16rpx;
  z-index: 99;
}

.action-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 500;
}

.action-btn.draft {
  background: #f0f2f5;
  color: #595959;
}

.action-btn.submit {
  background: #1677ff;
  color: #ffffff;
}

.action-btn.confirm-duty {
  background: #52c41a;
  color: #ffffff;
}

.action-btn.sign {
  background: #ff4d4f;
  color: #ffffff;
}

.action-btn.back-today-action {
  background: #faad14;
  color: #ffffff;
}
</style>
