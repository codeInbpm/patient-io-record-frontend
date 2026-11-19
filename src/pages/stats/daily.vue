<template>
  <view class="container">
    <!-- 1. 未登录提示卡片 -->
    <view class="state-card" v-if="!userStore.token">
      <view class="state-icon">🔒</view>
      <text class="state-title">您尚未登录微信账号</text>
      <text class="state-desc">登录后即可查看病患出入量统计分析与明细流水。</text>
      <button class="state-btn" type="primary" @tap="goToLogin">前往微信登录</button>
    </view>

    <!-- 2. 未绑定身份提示卡片 -->
    <view class="state-card" v-else-if="!userStore.isBound">
      <view class="state-icon">🏥</view>
      <text class="state-title">未绑定临床身份</text>
      <text class="state-desc">请先完成医护工号或病患床位核验绑定，方可查看出入量分析。</text>
      <button class="state-btn" type="primary" @tap="goToBind">立即去绑定身份</button>
    </view>

    <!-- 3. 已登录且已绑定：多病患多维度出入量查询看板 -->
    <view v-else>
      <!-- 顶部多维筛选条件卡片 -->
      <view class="filter-panel">
        <view class="panel-header">
          <text class="panel-title">出入量多维综合查询</text>
          <button class="filter-toggle-btn" size="mini" @tap="showFilterMore = !showFilterMore">
            {{ showFilterMore ? '收起筛选 ▲' : '更多筛选 ▼' }}
          </button>
        </view>

        <!-- 1) 病患范围选择（支持多选/全选） -->
        <view class="filter-row" v-if="!userStore.isPatient">
          <text class="filter-label">查询病患：</text>
          <view class="patient-select-box" @tap="openPatientModal">
            <text class="patient-select-text">{{ selectedPatientsDisplayText }}</text>
            <text class="patient-select-arrow">⚙️ 勾选病患</text>
          </view>
        </view>

        <!-- 2) 时间周期快捷与范围选择 -->
        <view class="time-section">
          <view class="segmented-control">
            <view 
              :class="['seg-item', activeDateRange === 'today' ? 'active' : '']" 
              @tap="setDateRangePreset('today')"
            >今日</view>
            <view 
              :class="['seg-item', activeDateRange === '3days' ? 'active' : '']" 
              @tap="setDateRangePreset('3days')"
            >近3天</view>
            <view 
              :class="['seg-item', activeDateRange === '7days' ? 'active' : '']" 
              @tap="setDateRangePreset('7days')"
            >近7天</view>
            <view 
              :class="['seg-item', activeDateRange === '30days' ? 'active' : '']" 
              @tap="setDateRangePreset('30days')"
            >近30天</view>
            <view 
              :class="['seg-item', activeDateRange === 'custom' ? 'active' : '']" 
              @tap="switchToCustomDate"
            >自定义</view>
          </view>

          <!-- 自定义日期起止选择 -->
          <view class="custom-date-container" v-if="activeDateRange === 'custom'">
            <picker mode="date" :value="startDate" @change="onStartDateChange">
              <view class="picker-pill">
                <text class="p-tip">开始:</text>
                <text class="p-date">{{ startDate }}</text>
                <text class="p-icon">📅</text>
              </view>
            </picker>
            <text class="range-arrow">→</text>
            <picker mode="date" :value="endDate" @change="onEndDateChange">
              <view class="picker-pill">
                <text class="p-tip">结束:</text>
                <text class="p-date">{{ endDate }}</text>
                <text class="p-icon">📅</text>
              </view>
            </picker>
          </view>
        </view>

        <!-- 3) 展开更多筛选条件 -->
        <view class="extra-filters" v-if="showFilterMore">
          <!-- 出入分类 -->
          <view class="filter-row">
            <text class="filter-label">出入类型：</text>
            <view class="option-chips">
              <text 
                :class="['opt-chip', filterCategory === 'ALL' ? 'active' : '']"
                @tap="filterCategory = 'ALL'"
              >全部</text>
              <text 
                :class="['opt-chip', filterCategory === 'INTAKE' ? 'active' : '']"
                @tap="filterCategory = 'INTAKE'"
              >仅入量</text>
              <text 
                :class="['opt-chip', filterCategory === 'OUTPUT' ? 'active' : '']"
                @tap="filterCategory = 'OUTPUT'"
              >仅出量</text>
            </view>
          </view>

          <!-- 录入人身份筛选 -->
          <view class="filter-row">
            <text class="filter-label">录入身份：</text>
            <view class="option-chips">
              <text 
                :class="['opt-chip', filterRecorderRole === 'ALL' ? 'active' : '']"
                @tap="filterRecorderRole = 'ALL'"
              >全部</text>
              <text 
                :class="['opt-chip', filterRecorderRole === 'NURSE' ? 'active' : '']"
                @tap="filterRecorderRole = 'NURSE'"
              >护士录入</text>
              <text 
                :class="['opt-chip', filterRecorderRole === 'PATIENT' ? 'active' : '']"
                @tap="filterRecorderRole = 'PATIENT'"
              >患者自录</text>
            </view>
          </view>

          <!-- 预警状态快速筛选 -->
          <view class="filter-row">
            <text class="filter-label">预警异常：</text>
            <view class="option-chips">
              <text 
                :class="['opt-chip', filterAlertStatus === 'ALL' ? 'active' : '']"
                @tap="filterAlertStatus = 'ALL'"
              >全部</text>
              <text 
                :class="['opt-chip', filterAlertStatus === 'ABNORMAL' ? 'active alert-chip' : '']"
                @tap="filterAlertStatus = 'ABNORMAL'"
              >🚨 仅看异常</text>
              <text 
                :class="['opt-chip', filterAlertStatus === 'URINE' ? 'active alert-chip' : '']"
                @tap="filterAlertStatus = 'URINE'"
              >少尿(＜400)</text>
              <text 
                :class="['opt-chip', filterAlertStatus === 'BALANCE' ? 'active alert-chip' : '']"
                @tap="filterAlertStatus = 'BALANCE'"
              >差值高(＞1000)</text>
            </view>
          </view>

          <!-- 搜索关键词 -->
          <view class="filter-row">
            <text class="filter-label">关键词：</text>
            <input 
              class="keyword-input" 
              v-model="keyword" 
              placeholder="搜索患者姓名/床号/品名/护士" 
              confirm-type="search"
              @confirm="handleSearch"
            />
          </view>
        </view>

        <!-- 4) 操作按钮栏：查询、重置、导出Excel -->
        <view class="action-btn-row">
          <button class="btn btn-reset" size="mini" @tap="handleReset">重置</button>
          <button class="btn btn-search" size="mini" type="primary" @tap="handleSearch">
            {{ loading ? '查询中...' : '🔍 立即查询' }}
          </button>
          <button class="btn btn-export" size="mini" @tap="handleExportExcel">
            📥 导出Excel
          </button>
        </view>

        <!-- 5) 预警图例说明条 -->
        <view class="legend-bar">
          <text class="l-title">⚠️ 预警提示：</text>
          <text class="l-tag tag-red">🔴 24h少尿(＜400ml)</text>
          <text class="l-tag tag-red">🔴 差值＞1000ml</text>
          <text class="l-tag tag-yellow">🟡 输液＞3000ml</text>
        </view>
      </view>

      <!-- 核心指标统计卡片 -->
      <view class="stat-card" v-if="queryResult">
        <view class="card-top-title">
          <view class="t-title-row">
            <text class="t-main">出入平衡看板</text>
            <text class="t-badge">{{ queryResult.patientCount }} 位病患 · {{ queryResult.recordCount }} 笔流水</text>
          </view>
          <text class="t-sub-date">统计周期：{{ startDate }} 至 {{ endDate }}</text>
        </view>

        <view class="balance-grid">
          <view class="grid-cell in">
            <text class="c-num">{{ queryResult.totalIntake || 0 }}</text>
            <text class="c-sub">总入量 (ml)</text>
          </view>
          <view class="grid-cell out">
            <text class="c-num">{{ queryResult.totalOutput || 0 }}</text>
            <text class="c-sub">总出量 (ml)</text>
          </view>
          <!-- 规则2: 入量-出量差值>1000ml 标红 -->
          <view :class="['grid-cell', 'net', (queryResult.netBalance || 0) > 1000 ? 'bg-alert-red' : '']">
            <text :class="['c-num', (queryResult.netBalance || 0) > 1000 ? 'alert-red-text' : ((queryResult.netBalance || 0) >= 0 ? 'pos' : 'neg')]">
              {{ (queryResult.netBalance || 0) > 0 ? '+' : '' }}{{ queryResult.netBalance || 0 }}
            </text>
            <text class="c-sub">净差值 (ml)</text>
            <text v-if="(queryResult.netBalance || 0) > 1000" class="mini-alert-pill">差值＞1000ml</text>
          </view>
        </view>

        <!-- 平衡比例可视化条 -->
        <view class="bar-progress-wrap">
          <view class="bar-labels">
            <text class="l-in">入量占比 ({{ intakePercent }}%)</text>
            <text class="l-out">出量占比 ({{ 100 - intakePercent }}%)</text>
          </view>
          <view class="bar-track">
            <view class="bar-fill-in" :style="{ width: intakePercent + '%' }"></view>
            <view class="bar-fill-out" :style="{ width: (100 - intakePercent) + '%' }"></view>
          </view>
        </view>
      </view>

      <!-- 多病患出入量汇总对比卡片（多于0个患者时展示） -->
      <view class="patient-sum-card" v-if="queryResult && queryResult.patientSummaries && queryResult.patientSummaries.length > 0">
        <view class="sum-card-header">
          <view class="sum-card-header-top">
            <view class="card-title-group">
              <text class="card-title">各病患出入量平衡汇总</text>
              <text class="badge-count">({{ filteredPatientSummaries.length }}人)</text>
            </view>
            <text class="filter-hint" v-if="filterAlertStatus !== 'ALL'">已过滤异常病患</text>
          </view>

          <!-- 1) 病患快捷模糊筛选框（可输入床号/姓名过滤） -->
          <view class="card-search-box">
            <text class="search-icon">🔍</text>
            <input 
              class="search-input" 
              v-model="summaryPatientKeyword" 
              placeholder="输入病患姓名/床号快速筛选"
              confirm-type="search"
              @input="onSummaryKeywordInput"
            />
            <text v-if="summaryPatientKeyword" class="search-clear-btn" @tap="clearSummaryKeyword">✕</text>
          </view>
        </view>

        <view class="sum-table">
          <view class="sum-th-row">
            <text class="th col-p">病患/床号</text>
            <text class="th col-in">入量</text>
            <text class="th col-out">出量</text>
            <text class="th col-net">净差值</text>
            <text class="th col-warn">状态</text>
          </view>
          <view 
            class="sum-tr-row" 
            v-for="p in pagedPatientSummaries" 
            :key="p.patientId"
            @tap="goToPatientDetail(p.patientId)"
          >
            <view class="td col-p">
              <text class="bed-tag">{{ p.bedNo }}</text>
              <text class="p-name">{{ p.patientName }}</text>
            </view>
            <!-- 静脉输液>3000ml 标黄 -->
            <view :class="['td', 'col-in', 'in-num', p.isIvAlert ? 'bg-alert-yellow' : '']">
              <text>{{ p.totalIntake }}</text>
              <text v-if="p.isIvAlert" class="badge-mini-yellow">输液＞3000</text>
            </view>
            <!-- 24h尿量<400ml 标红 -->
            <view :class="['td', 'col-out', 'out-num', p.isUrineAlert ? 'bg-alert-red' : '']">
              <text>{{ p.totalOutput }}</text>
              <text v-if="p.isUrineAlert" class="badge-mini-red">尿量＜400</text>
            </view>
            <!-- 入量-出量差值>1000ml 标红 -->
            <view :class="['td', 'col-net', p.isBalanceAlert ? 'bg-alert-red alert-red-text' : (p.netBalance >= 0 ? 'pos' : 'neg')]">
              <text>{{ p.netBalance > 0 ? '+' : '' }}{{ p.netBalance }}</text>
              <text v-if="p.isBalanceAlert" class="badge-mini-red">差值＞1000</text>
            </view>
            <view class="td col-warn">
              <text v-if="p.isUrineAlert" class="alert-pill pill-red">少尿</text>
              <text v-else-if="p.isBalanceAlert" class="alert-pill pill-red">差值高</text>
              <text v-else-if="p.isIvAlert" class="alert-pill pill-yellow">输液高</text>
              <text v-else class="alert-pill pill-normal">正常</text>
            </view>
          </view>

          <!-- 空状态 -->
          <view class="table-empty-row" v-if="pagedPatientSummaries.length === 0">
            <text class="table-empty-text">未找到匹配的病患汇总数据</text>
          </view>
        </view>

        <!-- 平衡汇总分页器 -->
        <view class="pagination-container" v-if="filteredPatientSummaries.length > 0">
          <view class="page-size-selector">
            <text class="page-size-label">每页:</text>
            <text 
              :class="['page-size-chip', summaryPageSize === 6 ? 'active' : '']" 
              @tap="setSummaryPageSize(6)"
            >6</text>
            <text 
              :class="['page-size-chip', summaryPageSize === 10 ? 'active' : '']" 
              @tap="setSummaryPageSize(10)"
            >10</text>
          </view>

          <view class="page-nav-group">
            <button 
              class="page-nav-btn" 
              size="mini" 
              :disabled="summaryCurrentPage <= 1"
              @tap="changeSummaryPage(-1)"
            >上一页</button>
            <text class="page-indicator">{{ summaryCurrentPage }} / {{ summaryTotalPages }}</text>
            <button 
              class="page-nav-btn" 
              size="mini" 
              :disabled="summaryCurrentPage >= summaryTotalPages"
              @tap="changeSummaryPage(1)"
            >下一页</button>
          </view>
        </view>
      </view>

      <!-- 出入量详细流水列表 -->
      <view class="records-card" v-if="queryResult">
        <view class="records-header">
          <view class="records-header-top">
            <view class="card-title-group">
              <text class="card-title">出入量明细流水</text>
              <text class="badge-count">({{ filteredRecords.length }}条)</text>
            </view>
            <text class="hint-text">点击可查看/核对具体录入人</text>
          </view>

          <!-- 2) 明细流水快捷模糊筛选框（病患姓名/床号/品名/录入人） -->
          <view class="card-search-box">
            <text class="search-icon">🔍</text>
            <input 
              class="search-input" 
              v-model="recordFilterKeyword" 
              placeholder="搜索流水病患/床号/品名/录入人"
              confirm-type="search"
              @input="onRecordKeywordInput"
            />
            <text v-if="recordFilterKeyword" class="search-clear-btn" @tap="clearRecordKeyword">✕</text>
          </view>
        </view>

        <view class="records-list">
          <view 
            :class="['record-item', item.alertLevel === 'red' ? 'item-alert-red' : (item.alertLevel === 'yellow' ? 'item-alert-yellow' : '')]" 
            v-for="item in pagedRecords" 
            :key="item.category + item.id"
          >
            <view class="r-left">
              <text :class="['badge-cat', item.category.toLowerCase()]">
                {{ item.category === 'INTAKE' ? '入' : '出' }}
              </text>
            </view>
            <view class="r-main">
              <view class="r-top">
                <view class="patient-meta">
                  <text class="r-bed">{{ item.bedNo }}</text>
                  <text class="r-pname">{{ item.patientName }}</text>
                  <text class="r-type-text">{{ item.itemName }}</text>
                  <!-- 预警徽章 -->
                  <text v-if="item.alertTag" :class="['alert-tag-badge', item.alertLevel === 'red' ? 'badge-red' : 'badge-yellow']">
                    {{ item.alertTag }}
                  </text>
                </view>
                <text :class="['r-amount', item.category.toLowerCase()]">
                  {{ item.category === 'INTAKE' ? '+' : '-' }}{{ item.amount }} ml
                </text>
              </view>

              <view class="r-sub">
                <text class="r-time">{{ item.recordTime ? item.recordTime.substring(0, 16) : '' }}</text>
                <!-- 具体录入人高亮展示 -->
                <text :class="['r-recorder', item.recorderRole === 'PATIENT' ? 'patient' : 'nurse']">
                  {{ item.recorderText || (item.recorderRole === 'PATIENT' ? '患者本人录入' : (item.recorderName ? item.recorderName + '录入' : '护士录入')) }}
                </text>
                <text class="r-nature" v-if="item.natureOrColor">性状: {{ item.natureOrColor }}</text>
              </view>

              <view class="r-remark" v-if="item.remark">备注: {{ item.remark }}</view>
            </view>
          </view>

          <view class="empty-box" v-if="pagedRecords.length === 0">
            <text class="empty-icon">📋</text>
            <text class="empty-text">当前筛选条件下暂无出入量流水记录</text>
          </view>
        </view>

        <!-- 出入量明细分页器 -->
        <view class="pagination-container" v-if="filteredRecords.length > 0">
          <view class="page-size-selector">
            <text class="page-size-label">每页:</text>
            <text 
              :class="['page-size-chip', recordPageSize === 10 ? 'active' : '']" 
              @tap="setRecordPageSize(10)"
            >10</text>
            <text 
              :class="['page-size-chip', recordPageSize === 20 ? 'active' : '']" 
              @tap="setRecordPageSize(20)"
            >20</text>
          </view>

          <view class="page-nav-group">
            <button 
              class="page-nav-btn" 
              size="mini" 
              :disabled="recordCurrentPage <= 1"
              @tap="changeRecordPage(-1)"
            >上一页</button>
            <text class="page-indicator">{{ recordCurrentPage }} / {{ recordTotalPages }}</text>
            <button 
              class="page-nav-btn" 
              size="mini" 
              :disabled="recordCurrentPage >= recordTotalPages"
              @tap="changeRecordPage(1)"
            >下一页</button>
          </view>
        </view>
      </view>
    </view>

    <!-- 4. 病患多选弹窗 Modal -->
    <view class="modal-mask" v-if="showPatientModal" @tap="showPatientModal = false">
      <view class="modal-box" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">选择查询病患（可多选）</text>
          <text class="modal-close" @tap="showPatientModal = false">✕</text>
        </view>

        <!-- 3) 弹窗内病患模糊搜索框 -->
        <view class="modal-search-box">
          <text class="search-icon">🔍</text>
          <input 
            class="modal-search-input" 
            v-model="modalPatientSearch" 
            placeholder="输入床号、姓名或住院号模糊搜索..." 
          />
          <text v-if="modalPatientSearch" class="search-clear-btn" @tap="modalPatientSearch = ''">✕</text>
        </view>

        <!-- 快捷操作栏 -->
        <view class="modal-tools">
          <button class="tool-btn" size="mini" @tap="selectAllFilteredPatients">
            {{ modalPatientSearch ? `全选搜索(${modalFilteredPatients.length})` : `全选全部(${patientCandidates.length})` }}
          </button>
          <button class="tool-btn" size="mini" @tap="clearFilteredPatients">
            {{ modalPatientSearch ? '清空搜索勾选' : '清空勾选' }}
          </button>
          <button class="tool-btn" size="mini" @tap="selectMyPatients">我负责的</button>
        </view>

        <!-- 病患勾选列表 -->
        <scroll-view class="modal-scroll" scroll-y>
          <view 
            class="patient-check-item" 
            v-for="p in modalFilteredPatients" 
            :key="p.id"
            @tap="togglePatientCheck(p.id)"
          >
            <view class="check-box" :class="{ checked: tempSelectedPatientIds.includes(p.id) }">
              {{ tempSelectedPatientIds.includes(p.id) ? '✓' : '' }}
            </view>
            <view class="p-info">
              <view class="p-row1">
                <text class="bed-pill">{{ p.bedNo }}</text>
                <text class="p-name-bold">{{ p.patientName }}</text>
                <text class="hosp-no">住院号: {{ p.hospitalNo }}</text>
              </view>
              <view class="p-row2">
                <text class="n-name" v-if="p.assignedNurseName">责任护士: {{ p.assignedNurseName }}</text>
                <text class="n-name none" v-else>未分责任护士</text>
              </view>
            </view>
          </view>

          <!-- 搜索未搜到病患 -->
          <view class="modal-empty-box" v-if="modalFilteredPatients.length === 0">
            <text class="modal-empty-text">未搜到匹配的病患，请尝试输入其他床号或姓名</text>
          </view>
        </scroll-view>

        <view class="modal-footer">
          <text class="selected-count">已勾选 {{ tempSelectedPatientIds.length }} 位病患</text>
          <button class="confirm-btn" type="primary" size="mini" @tap="confirmPatientSelection">确定选择</button>
        </view>
      </view>
    </view>

    <!-- 底部角色定制导航栏 -->
    <CustomTabBar current="stats" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user'
import { getPatientsByWardApi, getMyBoundPatientApi } from '../../api/patient'
import { queryFluidRecordsApi, exportFluidRecordsExcel } from '../../api/record'
import { formatDate } from '../../utils/date'
import { syncRoleTabBar } from '../../utils/tabbar'
import CustomTabBar from '../../components/CustomTabBar.vue'

const userStore = useUserStore()

// 筛选状态
const activeDateRange = ref('7days') // today, 3days, 7days, 30days, custom
const startDate = ref(formatDate(new Date(Date.now() - 6 * 24 * 3600 * 1000)))
const endDate = ref(formatDate())
const filterCategory = ref('ALL') // ALL, INTAKE, OUTPUT
const filterRecorderRole = ref('ALL') // ALL, NURSE, PATIENT
const filterAlertStatus = ref('ALL') // ALL, ABNORMAL, URINE, BALANCE
const keyword = ref('')
const showFilterMore = ref(false)

// 病患选择状态
const patientCandidates = ref([])
const selectedPatientIds = ref([])
const tempSelectedPatientIds = ref([])
const showPatientModal = ref(false)

// 查询结果与加载
const loading = ref(false)
const queryResult = ref(null)

// 平衡汇总快捷搜索与分页
const summaryPatientKeyword = ref('')
const summaryPageSize = ref(6) // 默认每页6人
const summaryCurrentPage = ref(1)

// 出入量明细快捷搜索与分页
const recordFilterKeyword = ref('')
const recordPageSize = ref(10) // 默认每页10条流水
const recordCurrentPage = ref(1)

// 弹窗病患模糊搜索
const modalPatientSearch = ref('')

const selectedPatientsDisplayText = computed(() => {
  if (selectedPatientIds.value.length === 0) {
    return `全部病患 (共 ${patientCandidates.value.length} 人)`
  }
  if (selectedPatientIds.value.length === patientCandidates.value.length && patientCandidates.value.length > 0) {
    return `全部病患 (共 ${patientCandidates.value.length} 人)`
  }
  const names = patientCandidates.value
    .filter(p => selectedPatientIds.value.includes(p.id))
    .map(p => `${p.bedNo} ${p.patientName}`)
  if (names.length <= 2) {
    return names.join('、')
  }
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 人`
})

const intakePercent = computed(() => {
  if (!queryResult.value) return 50
  const tin = Number(queryResult.value.totalIntake || 0)
  const tout = Number(queryResult.value.totalOutput || 0)
  const sum = tin + tout
  if (sum === 0) return 50
  return Math.round((tin / sum) * 100)
})

const filteredPatientSummaries = computed(() => {
  if (!queryResult.value || !queryResult.value.patientSummaries) return []
  let list = queryResult.value.patientSummaries
  if (filterAlertStatus.value === 'ABNORMAL') {
    list = list.filter(p => p.isUrineAlert || p.isBalanceAlert || p.isIvAlert)
  } else if (filterAlertStatus.value === 'URINE') {
    list = list.filter(p => p.isUrineAlert)
  } else if (filterAlertStatus.value === 'BALANCE') {
    list = list.filter(p => p.isBalanceAlert)
  }

  if (summaryPatientKeyword.value.trim()) {
    const kw = summaryPatientKeyword.value.trim().toLowerCase()
    list = list.filter(p => 
      (p.patientName && p.patientName.toLowerCase().includes(kw)) ||
      (p.bedNo && p.bedNo.toLowerCase().includes(kw)) ||
      (p.hospitalNo && p.hospitalNo.toLowerCase().includes(kw))
    )
  }
  return list
})

const summaryTotalPages = computed(() => {
  return Math.ceil(filteredPatientSummaries.value.length / summaryPageSize.value) || 1
})

const pagedPatientSummaries = computed(() => {
  const start = (summaryCurrentPage.value - 1) * summaryPageSize.value
  return filteredPatientSummaries.value.slice(start, start + summaryPageSize.value)
})

const filteredRecords = computed(() => {
  if (!queryResult.value || !queryResult.value.records) return []
  const list = queryResult.value.records
  if (!recordFilterKeyword.value.trim()) return list
  const kw = recordFilterKeyword.value.trim().toLowerCase()
  return list.filter(r => 
    (r.patientName && r.patientName.toLowerCase().includes(kw)) ||
    (r.bedNo && r.bedNo.toLowerCase().includes(kw)) ||
    (r.itemName && r.itemName.toLowerCase().includes(kw)) ||
    (r.recorderText && r.recorderText.toLowerCase().includes(kw)) ||
    (r.recorderName && r.recorderName.toLowerCase().includes(kw)) ||
    (r.remark && r.remark.toLowerCase().includes(kw)) ||
    (r.natureOrColor && r.natureOrColor.toLowerCase().includes(kw))
  )
})

const recordTotalPages = computed(() => {
  return Math.ceil(filteredRecords.value.length / recordPageSize.value) || 1
})

const pagedRecords = computed(() => {
  const start = (recordCurrentPage.value - 1) * recordPageSize.value
  return filteredRecords.value.slice(start, start + recordPageSize.value)
})

const modalFilteredPatients = computed(() => {
  if (!modalPatientSearch.value.trim()) {
    return patientCandidates.value
  }
  const kw = modalPatientSearch.value.trim().toLowerCase()
  return patientCandidates.value.filter(p =>
    (p.patientName && p.patientName.toLowerCase().includes(kw)) ||
    (p.bedNo && p.bedNo.toLowerCase().includes(kw)) ||
    (p.hospitalNo && p.hospitalNo.toLowerCase().includes(kw))
  )
})

function goToLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}

function goToBind() {
  uni.navigateTo({ url: '/pages/auth/bind' })
}

function goToPatientDetail(patientId) {
  uni.navigateTo({
    url: `/pages/patient/detail?patientId=${patientId}`
  })
}

function setDateRangePreset(preset) {
  if (activeDateRange.value === preset) return
  activeDateRange.value = preset
  const now = new Date()
  endDate.value = formatDate(now)

  if (preset === 'today') {
    startDate.value = formatDate(now)
  } else if (preset === '3days') {
    const d3 = new Date(now.getTime() - 2 * 24 * 3600 * 1000)
    startDate.value = formatDate(d3)
  } else if (preset === '7days') {
    const d7 = new Date(now.getTime() - 6 * 24 * 3600 * 1000)
    startDate.value = formatDate(d7)
  } else if (preset === '30days') {
    const d30 = new Date(now.getTime() - 29 * 24 * 3600 * 1000)
    startDate.value = formatDate(d30)
  }
  handleSearch()
}

function switchToCustomDate() {
  activeDateRange.value = 'custom'
}

function onStartDateChange(e) {
  startDate.value = e.detail.value
  handleSearch()
}

function onEndDateChange(e) {
  endDate.value = e.detail.value
  handleSearch()
}

// 汇总分页与快捷筛选方法
function onSummaryKeywordInput() {
  summaryCurrentPage.value = 1
}

function clearSummaryKeyword() {
  summaryPatientKeyword.value = ''
  summaryCurrentPage.value = 1
}

function setSummaryPageSize(size) {
  if (summaryPageSize.value === size) return
  summaryPageSize.value = size
  summaryCurrentPage.value = 1
}

function changeSummaryPage(delta) {
  const target = summaryCurrentPage.value + delta
  if (target >= 1 && target <= summaryTotalPages.value) {
    summaryCurrentPage.value = target
  }
}

// 明细分页与快捷筛选方法
function onRecordKeywordInput() {
  recordCurrentPage.value = 1
}

function clearRecordKeyword() {
  recordFilterKeyword.value = ''
  recordCurrentPage.value = 1
}

function setRecordPageSize(size) {
  if (recordPageSize.value === size) return
  recordPageSize.value = size
  recordCurrentPage.value = 1
}

function changeRecordPage(delta) {
  const target = recordCurrentPage.value + delta
  if (target >= 1 && target <= recordTotalPages.value) {
    recordCurrentPage.value = target
  }
}

function openPatientModal() {
  modalPatientSearch.value = ''
  tempSelectedPatientIds.value = selectedPatientIds.value.length > 0 
    ? [...selectedPatientIds.value] 
    : patientCandidates.value.map(p => p.id)
  showPatientModal.value = true
}

function togglePatientCheck(id) {
  const idx = tempSelectedPatientIds.value.indexOf(id)
  if (idx > -1) {
    tempSelectedPatientIds.value.splice(idx, 1)
  } else {
    tempSelectedPatientIds.value.push(id)
  }
}

function selectAllPatients() {
  tempSelectedPatientIds.value = patientCandidates.value.map(p => p.id)
}

function clearSelectedPatients() {
  tempSelectedPatientIds.value = []
}

function selectAllFilteredPatients() {
  const idsToAdd = modalFilteredPatients.value.map(p => p.id)
  const set = new Set([...tempSelectedPatientIds.value, ...idsToAdd])
  tempSelectedPatientIds.value = Array.from(set)
}

function clearFilteredPatients() {
  if (!modalPatientSearch.value.trim()) {
    tempSelectedPatientIds.value = []
  } else {
    const idsToRemove = new Set(modalFilteredPatients.value.map(p => p.id))
    tempSelectedPatientIds.value = tempSelectedPatientIds.value.filter(id => !idsToRemove.has(id))
  }
}

function selectMyPatients() {
  const currentUserName = userStore.userInfo?.realName
  if (!currentUserName) {
    selectAllPatients()
    return
  }
  const myIds = patientCandidates.value
    .filter(p => p.assignedNurseName && p.assignedNurseName.includes(currentUserName))
    .map(p => p.id)
  if (myIds.length > 0) {
    tempSelectedPatientIds.value = myIds
  } else {
    uni.showToast({ title: '未查找到您负责的病患', icon: 'none' })
  }
}

function confirmPatientSelection() {
  if (tempSelectedPatientIds.value.length === 0) {
    uni.showToast({ title: '请至少勾选一位病患', icon: 'none' })
    return
  }
  selectedPatientIds.value = [...tempSelectedPatientIds.value]
  showPatientModal.value = false
  handleSearch()
}

async function handleSearch() {
  if (!userStore.token || !userStore.isBound) return

  loading.value = true
  try {
    const params = {
      startDate: startDate.value,
      endDate: endDate.value,
      category: filterCategory.value,
      recorderRole: filterRecorderRole.value,
      keyword: keyword.value.trim()
    }

    if (!userStore.isPatient) {
      if (selectedPatientIds.value.length > 0 && selectedPatientIds.value.length < patientCandidates.value.length) {
        params.patientIds = selectedPatientIds.value
      }
    }

    const res = await queryFluidRecordsApi(params)
    queryResult.value = res
    summaryCurrentPage.value = 1
    recordCurrentPage.value = 1
  } catch (e) {
    console.error('查询出入量失败', e)
  } finally {
    loading.value = false
  }
}

function handleReset() {
  setDateRangePreset('7days')
  filterCategory.value = 'ALL'
  filterRecorderRole.value = 'ALL'
  filterAlertStatus.value = 'ALL'
  keyword.value = ''
  summaryPatientKeyword.value = ''
  recordFilterKeyword.value = ''
  modalPatientSearch.value = ''
  selectedPatientIds.value = []
  summaryCurrentPage.value = 1
  recordCurrentPage.value = 1
  handleSearch()
}

function handleExportExcel() {
  const params = {
    startDate: startDate.value,
    endDate: endDate.value,
    category: filterCategory.value,
    recorderRole: filterRecorderRole.value,
    keyword: keyword.value.trim()
  }

  if (!userStore.isPatient) {
    if (selectedPatientIds.value.length > 0 && selectedPatientIds.value.length < patientCandidates.value.length) {
      params.patientIds = selectedPatientIds.value
    }
  }

  exportFluidRecordsExcel(params)
}

async function initPage() {
  if (!userStore.token || !userStore.isBound) return

  if (userStore.isPatient) {
    const my = await getMyBoundPatientApi()
    if (my) {
      patientCandidates.value = [my]
      selectedPatientIds.value = [my.id]
    }
  } else {
    // 护士长或护士：不做限制，获取全部病区病患
    const pts = await getPatientsByWardApi(null, false)
    patientCandidates.value = pts || []
  }
  handleSearch()
}

onMounted(() => {
  initPage()
})

onShow(() => {
  syncRoleTabBar()
  if (userStore.isPatient) {
    uni.switchTab({ url: '/pages/patient-view/home' })
    return
  }
  if (userStore.token && userStore.isBound) {
    if (patientCandidates.value.length === 0) {
      initPage()
    }
  }
})
</script>

<style>
.container {
  padding: 24rpx;
  padding-bottom: 80rpx;
  background-color: #f5f7fa;
  min-height: 100vh;
}

/* 状态提示卡片 */
.state-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 60rpx 40rpx;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
  margin-top: 60rpx;
}

.state-icon {
  font-size: 72rpx;
  margin-bottom: 24rpx;
}

.state-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #1f2937;
  display: block;
  margin-bottom: 16rpx;
}

.state-desc {
  font-size: 26rpx;
  color: #6b7280;
  display: block;
  line-height: 1.5;
  margin-bottom: 40rpx;
}

.state-btn {
  background: #1677ff;
  border-radius: 40rpx;
  font-size: 28rpx;
  width: 60%;
}

/* 筛选面板 */
.filter-panel {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  margin-bottom: 24rpx;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 16rpx;
  margin-bottom: 16rpx;
}

.panel-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #1a1a1a;
}

.filter-toggle-btn {
  font-size: 22rpx;
  color: #1677ff;
  background: #f0f5ff;
  border: 1px solid #adc6ff;
  border-radius: 20rpx;
  margin: 0;
  padding: 0 16rpx;
  height: 44rpx;
  line-height: 42rpx;
}

.filter-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.filter-label {
  font-size: 26rpx;
  color: #4b5563;
  width: 140rpx;
  flex-shrink: 0;
}

.patient-select-box {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  padding: 12rpx 20rpx;
  border-radius: 12rpx;
}

.patient-select-text {
  font-size: 26rpx;
  color: #1f2937;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.patient-select-arrow {
  font-size: 22rpx;
  color: #1677ff;
  flex-shrink: 0;
  margin-left: 12rpx;
}

/* 时间选择分段器 */
.time-section {
  margin-bottom: 16rpx;
}

.segmented-control {
  display: flex;
  background: #f1f5f9;
  border-radius: 14rpx;
  padding: 6rpx;
  width: 100%;
  box-sizing: border-box;
}

.seg-item {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: #64748b;
  height: 56rpx;
  line-height: 56rpx;
  border-radius: 10rpx;
  box-sizing: border-box;
}

.seg-item.active {
  background: #ffffff;
  color: #1677ff;
  font-weight: bold;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}

.custom-date-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  margin-top: 14rpx;
  background: #f8fafc;
  padding: 12rpx;
  border-radius: 12rpx;
  border: 1px dashed #cbd5e1;
}

.picker-pill {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: #ffffff;
  border: 1px solid #d1d5db;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.p-tip {
  color: #94a3b8;
  font-size: 22rpx;
}

.p-date {
  color: #1e293b;
  font-weight: 500;
  font-size: 24rpx;
}

.p-icon {
  font-size: 22rpx;
}

.range-arrow {
  font-size: 24rpx;
  color: #94a3b8;
  font-weight: bold;
}

.extra-filters {
  background: #f9fafb;
  padding: 16rpx;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}

.option-chips {
  display: flex;
  gap: 12rpx;
}

.opt-chip {
  font-size: 24rpx;
  color: #4b5563;
  background: #e5e7eb;
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
}

.opt-chip.active {
  background: #1677ff;
  color: #ffffff;
  font-weight: 500;
}

.keyword-input {
  flex: 1;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8rpx;
  padding: 8rpx 16rpx;
  font-size: 24rpx;
}

.action-btn-row {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 10rpx;
}

.btn {
  font-size: 26rpx;
  border-radius: 30rpx;
  margin: 0;
  padding: 0 24rpx;
  height: 60rpx;
  line-height: 58rpx;
  text-align: center;
  box-sizing: border-box;
}

.btn-reset {
  background: #f3f4f6;
  color: #4b5563;
  border: 1px solid #d1d5db;
  min-width: 120rpx;
}

.btn-search {
  background: #1677ff;
  color: #ffffff;
  min-width: 170rpx;
}

.btn-export {
  background: #52c41a;
  color: #ffffff;
  border: none;
  min-width: 170rpx;
}

/* 核心看板卡片 */
.stat-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  margin-bottom: 24rpx;
}

.card-top-title {
  margin-bottom: 20rpx;
}

.t-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6rpx;
}

.t-main {
  font-size: 30rpx;
  font-weight: bold;
  color: #111827;
}

.t-badge {
  font-size: 22rpx;
  color: #1677ff;
  background: #eff6ff;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.t-sub-date {
  font-size: 22rpx;
  color: #6b7280;
  display: block;
}

.balance-grid {
  display: flex;
  justify-content: space-between;
  background: #fafafa;
  border-radius: 12rpx;
  padding: 20rpx 10rpx;
  margin-bottom: 20rpx;
}

.grid-cell {
  flex: 1;
  text-align: center;
}

.grid-cell.in .c-num { color: #52c41a; }
.grid-cell.out .c-num { color: #fa8c16; }

.c-num {
  font-size: 40rpx;
  font-weight: bold;
  display: block;
}

.c-num.pos { color: #1677ff; }
.c-num.neg { color: #ff4d4f; }

.c-sub {
  font-size: 22rpx;
  color: #8c8c8c;
  margin-top: 4rpx;
  display: block;
}

.bar-progress-wrap {
  margin-top: 10rpx;
}

.bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 22rpx;
  margin-bottom: 8rpx;
}

.l-in { color: #52c41a; font-weight: 500; }
.l-out { color: #fa8c16; font-weight: 500; }

.bar-track {
  height: 16rpx;
  border-radius: 8rpx;
  background: #e5e7eb;
  overflow: hidden;
  display: flex;
}

.bar-fill-in {
  background: #52c41a;
  height: 100%;
}

.bar-fill-out {
  background: #fa8c16;
  height: 100%;
}

/* 多病患汇总卡片 */
.patient-sum-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  margin-bottom: 24rpx;
}

.sum-card-header {
  margin-bottom: 16rpx;
}

.sum-card-header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.card-title-group {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.badge-count {
  font-size: 24rpx;
  color: #1677ff;
  font-weight: 600;
}

.card-search-box {
  display: flex;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 28rpx;
  padding: 6rpx 20rpx;
  gap: 12rpx;
}

.search-icon {
  font-size: 24rpx;
  color: #94a3b8;
}

.search-input {
  flex: 1;
  font-size: 24rpx;
  color: #1e293b;
  height: 48rpx;
}

.search-clear-btn {
  font-size: 26rpx;
  color: #94a3b8;
  padding: 4rpx 10rpx;
}

.table-empty-row {
  padding: 36rpx 0;
  text-align: center;
}

.table-empty-text {
  font-size: 24rpx;
  color: #9ca3af;
}

.card-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #1a1a1a;
}

.sum-table {
  border: 1px solid #f0f0f0;
  border-radius: 8rpx;
  overflow: hidden;
}

.sum-th-row {
  display: flex;
  background: #fafafa;
  padding: 14rpx 10rpx;
  font-size: 22rpx;
  color: #8c8c8c;
  font-weight: bold;
}

.sum-tr-row {
  display: flex;
  padding: 16rpx 10rpx;
  font-size: 24rpx;
  border-top: 1px solid #f0f0f0;
  align-items: center;
}

.col-p { flex: 2; display: flex; align-items: center; gap: 8rpx; }
.col-in { flex: 1.5; text-align: center; }
.col-out { flex: 1.5; text-align: center; }
.col-net { flex: 1.5; text-align: right; padding-right: 8rpx; font-weight: bold; }

.bed-tag {
  background: #e6f4ff;
  color: #1677ff;
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
  font-weight: bold;
}

.p-name {
  color: #262626;
  font-weight: 500;
}

.in-num { color: #52c41a; }
.out-num { color: #fa8c16; }
.pos { color: #1677ff; }
.neg { color: #ff4d4f; }

/* 流水明细卡片 */
.records-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.records-header {
  margin-bottom: 20rpx;
}

.records-header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

/* 分页器通用容器 */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1px solid #f1f5f9;
}

.page-size-selector {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.page-size-label {
  font-size: 22rpx;
  color: #64748b;
}

.page-size-chip {
  font-size: 22rpx;
  color: #64748b;
  background: #f1f5f9;
  padding: 4rpx 14rpx;
  border-radius: 16rpx;
  border: 1px solid #e2e8f0;
}

.page-size-chip.active {
  background: #1677ff;
  color: #ffffff;
  border-color: #1677ff;
  font-weight: 500;
}

.page-nav-group {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.page-nav-btn {
  font-size: 22rpx !important;
  color: #1677ff !important;
  background: #f0f5ff !important;
  border: 1px solid #adc6ff !important;
  border-radius: 24rpx !important;
  margin: 0 !important;
  padding: 0 18rpx !important;
  height: 48rpx !important;
  line-height: 46rpx !important;
}

.page-nav-btn[disabled] {
  color: #9ca3af !important;
  background: #f3f4f6 !important;
  border-color: #e5e7eb !important;
  opacity: 0.6;
}

.page-indicator {
  font-size: 24rpx;
  color: #334155;
  font-weight: 600;
  min-width: 80rpx;
  text-align: center;
}

.hint-text {
  font-size: 20rpx;
  color: #9ca3af;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.record-item {
  display: flex;
  align-items: flex-start;
  padding: 16rpx 0;
  border-bottom: 1px solid #f9fafb;
}

.badge-cat {
  font-size: 20rpx;
  font-weight: bold;
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-right: 14rpx;
}

.badge-cat.intake {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.badge-cat.output {
  background: #fffbe6;
  color: #fa8c16;
  border: 1px solid #ffe58f;
}

.r-main {
  flex: 1;
}

.r-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6rpx;
}

.patient-meta {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.r-bed {
  background: #f0f0f0;
  color: #595959;
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
}

.r-pname {
  font-size: 26rpx;
  font-weight: bold;
  color: #1f2937;
}

.r-type-text {
  font-size: 24rpx;
  color: #4b5563;
}

.r-amount {
  font-size: 28rpx;
  font-weight: bold;
}

.r-amount.intake { color: #52c41a; }
.r-amount.output { color: #fa8c16; }

.r-sub {
  font-size: 22rpx;
  color: #9ca3af;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 4rpx;
}

.r-recorder.nurse {
  color: #1677ff;
  font-weight: 500;
  background: #e6f4ff;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
}

.r-recorder.patient {
  color: #52c41a;
  font-weight: 500;
  background: #f6ffed;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
}

.r-nature {
  color: #d97706;
}

.r-remark {
  font-size: 20rpx;
  color: #6b7280;
  margin-top: 4rpx;
}

.empty-box {
  padding: 60rpx 0;
  text-align: center;
}

.empty-icon {
  font-size: 64rpx;
  display: block;
  margin-bottom: 12rpx;
}

.empty-text {
  font-size: 24rpx;
  color: #9ca3af;
}

/* 弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 999;
}

.modal-box {
  background: #ffffff;
  width: 100%;
  border-radius: 24rpx 24rpx 0 0;
  padding: 24rpx;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16rpx;
  border-bottom: 1px solid #f0f0f0;
}

.modal-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #111827;
}

.modal-close {
  font-size: 36rpx;
  color: #9ca3af;
  padding: 0 10rpx;
}

.modal-search-box {
  display: flex;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 28rpx;
  padding: 6rpx 20rpx;
  gap: 12rpx;
  margin-top: 14rpx;
  margin-bottom: 6rpx;
}

.modal-search-input {
  flex: 1;
  font-size: 24rpx;
  color: #1e293b;
  height: 48rpx;
}

.modal-empty-box {
  padding: 50rpx 20rpx;
  text-align: center;
}

.modal-empty-text {
  font-size: 24rpx;
  color: #9ca3af;
}

.modal-tools {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 0;
}

.tool-btn {
  font-size: 22rpx;
  color: #1677ff;
  background: #e6f4ff;
  border: 1px solid #adc6ff;
  border-radius: 20rpx;
  margin: 0;
}

.modal-scroll {
  max-height: 50vh;
  margin: 10rpx 0;
}

.patient-check-item {
  display: flex;
  align-items: center;
  padding: 18rpx 0;
  border-bottom: 1px solid #f3f4f6;
}

.check-box {
  width: 40rpx;
  height: 40rpx;
  border-radius: 8rpx;
  border: 2rpx solid #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: #ffffff;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.check-box.checked {
  background: #1677ff;
  border-color: #1677ff;
}

.p-info {
  flex: 1;
}

.p-row1 {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 6rpx;
}

.bed-pill {
  background: #e6f4ff;
  color: #1677ff;
  font-size: 22rpx;
  font-weight: bold;
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
}

.p-name-bold {
  font-size: 28rpx;
  font-weight: bold;
  color: #111827;
}

.hosp-no {
  font-size: 22rpx;
  color: #9ca3af;
}

.p-row2 {
  font-size: 22rpx;
}

.n-name {
  color: #4b5563;
}

.n-name.none {
  color: #d97706;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16rpx;
  border-top: 1px solid #f0f0f0;
}

.selected-count {
  font-size: 24rpx;
  color: #6b7280;
}

.confirm-btn {
  background: #1677ff;
  border-radius: 30rpx;
  padding: 0 40rpx;
  margin: 0;
}

/* 临床智能预警高亮样式 (红底 / 黄底) */
.legend-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1px dashed #e5e7eb;
}
.l-title {
  font-size: 22rpx;
  font-weight: bold;
  color: #4b5563;
}
.l-tag {
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
  font-weight: 600;
}
.tag-red {
  background-color: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}
.tag-yellow {
  background-color: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #faecd8;
}

/* 背景染色 */
.bg-alert-red {
  background-color: #fef0f0 !important;
}
.bg-alert-yellow {
  background-color: #fdf6ec !important;
}
.alert-red-text {
  color: #f56c6c !important;
  font-weight: bold;
}

.mini-alert-pill {
  font-size: 18rpx;
  background-color: #f56c6c;
  color: #ffffff;
  padding: 2rpx 8rpx;
  border-radius: 10rpx;
  margin-top: 4rpx;
}

.badge-mini-red {
  font-size: 18rpx;
  background-color: #f56c6c;
  color: #ffffff;
  padding: 2rpx 8rpx;
  border-radius: 8rpx;
  margin-left: 6rpx;
}
.badge-mini-yellow {
  font-size: 18rpx;
  background-color: #e6a23c;
  color: #ffffff;
  padding: 2rpx 8rpx;
  border-radius: 8rpx;
  margin-left: 6rpx;
}

.col-warn {
  width: 90rpx;
  text-align: center;
}
.alert-pill {
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  font-weight: bold;
}
.pill-red {
  background-color: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}
.pill-yellow {
  background-color: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #faecd8;
}
.pill-normal {
  background-color: #f0fdf4;
  color: #16a34a;
}

.item-alert-red {
  background-color: #fef0f0 !important;
  border-left: 6rpx solid #f56c6c !important;
}
.item-alert-yellow {
  background-color: #fdf6ec !important;
  border-left: 6rpx solid #e6a23c !important;
}

.alert-tag-badge {
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  font-weight: bold;
  margin-left: 8rpx;
}
.badge-red {
  background-color: #f56c6c;
  color: #ffffff;
}
.badge-yellow {
  background-color: #e6a23c;
  color: #ffffff;
}
</style>
