<template>
  <view class="container">
    <!-- 顶部病房选择与病区看板 -->
    <view class="header-card">
      <view class="top-meta">
        <view class="ward-selector" @tap="openWardPicker">
          <text class="ward-name">{{ currentWard?.wardName || '选择病区' }}</text>
          <text class="arrow-down">▼</text>
        </view>
        <view class="header-actions">
          <view class="add-patient-btn" @tap.stop="openAddPatientModal">
            <text class="add-plus">＋</text>
            <text>建档</text>
          </view>
          <view class="role-pill" :class="userStore.isHeadNurse ? 'head' : 'nurse'">
            {{ userStore.isHeadNurse ? '护士长视图' : '护士工作台' }}
          </view>
        </view>
      </view>

      <view class="stats-row" v-if="overview">
        <view class="stat-item clickable" @tap="toggleHeaderScope">
          <text class="stat-num">{{ headerPatientCount }}</text>
          <text class="stat-label">{{ headerPatientLabel }}</text>
        </view>
        <view class="stat-item">
          <text class="stat-num color-in">{{ headerIntake }}</text>
          <text class="stat-label">{{ isWardScope ? '今日总入(ml)' : '我负责入(ml)' }}</text>
        </view>
        <view class="stat-item">
          <text class="stat-num color-out">{{ headerOutput }}</text>
          <text class="stat-label">{{ isWardScope ? '今日总出(ml)' : '我负责出(ml)' }}</text>
        </view>
        <view class="stat-item clickable" @tap="patientFilterScope = 'abnormal'">
          <text class="stat-num color-danger">{{ overview.abnormalCount || 0 }}</text>
          <text class="stat-label">异常报警</text>
        </view>
      </view>

      <!-- 漏记哨兵：没有数据，整个系统就没有价值，这条必须最显眼 -->
      <view class="missed-banner" v-if="missedPatientsCount > 0" @tap="toggleMissedFilter">
        <text class="missed-icon">⏰</text>
        <text class="missed-text">{{ missedBannerText }}</text>
        <text class="missed-action">{{ patientFilterScope === 'missed' ? '取消筛选' : '查看名单 ›' }}</text>
      </view>

      <!-- 患者反馈：数据错了要核对，症状上报更要立刻看 -->
      <view class="correction-banner" v-if="correctionList.length > 0" @tap="showCorrectionModal = true">
        <text class="correction-icon">{{ symptomCount > 0 ? '⚠️' : '📝' }}</text>
        <text class="correction-text">{{ correctionBannerText }}</text>
        <text class="correction-action">去处理 ›</text>
      </view>

      <!-- 弱网离线队列：让护士知道记录没有丢 -->
      <view class="offline-bar" v-if="offlinePending > 0" @tap="retryOffline">
        <text class="offline-text">📶 {{ offlinePending }} 条记录待同步</text>
        <text class="offline-retry">立即重试</text>
      </view>

      <!-- 快捷入口金刚区：补液监护 & 每日特殊交接本 -->
      <view class="quick-feature-bar">
        <view class="feature-capsule" @tap="goToInfusionList">
          <text class="capsule-icon">💧</text>
          <text class="capsule-text">补液监护</text>
        </view>
        <view class="feature-capsule handover" @tap="goToSpecialHandover">
          <text class="capsule-icon">📋</text>
          <text class="capsule-text">特殊交接本</text>
        </view>
      </view>
    </view>

    <!-- 护士长专属管理操作栏 -->
    <view class="admin-action-bar" v-if="userStore.isHeadNurse">
      <view class="bar-header-row">
        <text class="bar-title">科室管理工作台</text>
        <button class="m-btn small nurse-manage-btn" @tap="goToNurseManage">👩‍⚕️ 护士管理与排班</button>
      </view>
      <view class="admin-btns">
        <button class="m-btn small outline" @tap="showAddWardModal = true">+ 新建病房</button>
        <button class="m-btn small outline" @tap="openAddBedModal">+ 新建床位</button>
      </view>
    </view>

    <!-- 护士当班管辖床位状态条（支持随时换班/认领床位） -->
    <view class="duty-bar-card" v-if="!userStore.isHeadNurse">
      <view class="duty-bar-left">
        <text class="duty-badge">🩺 当班管辖</text>
        <text class="duty-text" v-if="myDutyBedNos.length > 0">
          已认领 <text class="duty-num">{{ myDutyBedNos.length }}</text> 床
        </text>
        <text class="duty-text empty" v-else>⚠️ 暂未认领管辖床位，请点击右侧选择床位</text>
      </view>
      <view class="duty-bar-btns">
        <button class="duty-manage-btn" size="mini" @tap="openDutyBedModal">
          {{ myDutyBedNos.length > 0 ? '更换/交班' : '+ 选择床位' }}
        </button>
      </view>
    </view>

    <!-- 护士/护士长标签切换：等宽自适应布局，彻底杜绝遮盖溢出 -->
    <view class="section-header">
      <view class="tab-switch-row">
        <view 
          v-if="!userStore.isHeadNurse"
          :class="['scope-tab', patientFilterScope === 'my' ? 'active' : '']"
          @tap="patientFilterScope = 'my'"
        >
          <text>我管辖</text>
          <text class="tab-count">({{ myPatientsCount }})</text>
        </view>
        <view 
          :class="['scope-tab', patientFilterScope === 'all' ? 'active' : '']"
          @tap="patientFilterScope = 'all'"
        >
          <text>{{ userStore.isHeadNurse ? '全部病患' : '全部' }}</text>
          <text class="tab-count">({{ allPatientsCount }})</text>
        </view>
        <view 
          :class="['scope-tab', 'tab-alert', patientFilterScope === 'abnormal' ? 'active alert-active' : '']"
          @tap="patientFilterScope = 'abnormal'"
        >
          <text class="alert-icon-text">▲ 异常</text>
          <text :class="['tab-count', abnormalPatientsCount > 0 ? 'has-alert' : '']">({{ abnormalPatientsCount }})</text>
        </view>
      </view>
    </view>

    <!-- 病人列表：加载 / 失败 / 空 三态区分，避免把断网显示成「没有病人」 -->
    <StateView
      v-if="loadState === 'loading'"
      state="loading"
      :skeleton-rows="4"
    />
    <StateView
      v-else-if="loadState === 'error'"
      state="error"
      title="病区数据加载失败"
      desc="网络不稳定或服务暂时不可用，点击下方按钮重试"
      @retry="reloadCurrentWard"
    />

    <view class="patient-list" v-else>
      <view 
        class="patient-card" 
        v-for="p in displayPatientList" 
        :key="p.id"
        @tap="goToDetail(p.id)"
      >
        <view class="card-top">
          <view class="bed-badge">{{ p.bedNo }}</view>
          <text class="patient-name">{{ p.patientName }}</text>
          <text class="hospital-no">（住院号: {{ p.hospitalNo }}）</text>
          <view class="status-tags">
            <text class="tag duty" v-if="p.isMyDuty">在管责任</text>
            <text class="tag readonly" v-else-if="!userStore.isHeadNurse">仅查阅</text>
            <text class="tag bound" v-if="p.isBound">已绑微信</text>
            <text class="tag alert" v-if="p.isAbnormal">异常报警</text>
          </view>
        </view>

        <view class="nurse-line">
          <text class="nurse-label">责任护士：</text>
          <text class="nurse-val" v-if="p.assignedNurseName">👩‍⚕️ {{ p.assignedNurseName }}</text>
          <text class="nurse-none" v-else>⚠️ 暂未分配责任护士</text>
          <!-- 护士长拥有分配护士按钮 -->
          <button 
            v-if="userStore.isHeadNurse" 
            class="assign-btn" 
            size="mini" 
            @tap.stop="openAssignModal(p)"
          >
            分配护士
          </button>
        </view>

        <view class="diag-line">诊断：{{ p.diagnosis || '暂无诊断' }}</view>

        <!-- 顶部黄色箭头临床警示条（清爽紧凑，仅上方给出警示） -->
        <view class="patient-alert-banner" v-if="p.isAbnormal">
          <text class="alert-arrow">▲</text>
          <text class="alert-title">临床警示：</text>
          <text class="alert-desc">{{ p.abnormalReason || '指标存在临床异常风险' }}</text>
        </view>

        <!-- 出入量简报条：整洁清爽无框排版，不在格子里加框 -->
        <view class="io-summary-bar">
          <view class="io-col in">
            <text class="io-label">入量：</text>
            <text class="io-val">{{ p.todayIntake || 0 }} ml</text>
          </view>
          <view class="io-col out">
            <text class="io-label">出量：</text>
            <text class="io-val">{{ p.todayOutput || 0 }} ml</text>
          </view>
          <view class="io-col balance">
            <text class="io-label">净平衡：</text>
            <text :class="['io-val', p.isBalanceAlert ? 'alert-red-text' : ((p.todayBalance || 0) >= 0 ? 'pos' : 'neg')]">
              {{ (p.todayBalance || 0) > 0 ? '+' : '' }}{{ p.todayBalance || 0 }} ml
            </text>
          </view>
        </view>

        <!-- 记录活跃度：一眼看出谁可能漏记 -->
        <view :class="['record-pulse', p.isMissed ? 'missed' : '']">
          <text class="pulse-dot" :class="p.isMissed ? 'dot-warn' : 'dot-ok'"></text>
          <text class="pulse-text">{{ recordPulseText(p) }}</text>
        </view>

        <!-- 快捷操作：只留两个高频动作，其余收进「更多」，避免误触出院 -->
        <view class="card-actions" @tap.stop>
          <button 
            :class="['quick-btn', 'in', (p.isMyDuty || userStore.isHeadNurse) ? '' : 'btn-disabled']" 
            size="mini" 
            @tap="handleCardRecord(p, 'intake')"
          >
            ＋ 记入量
          </button>
          <button 
            :class="['quick-btn', 'out', (p.isMyDuty || userStore.isHeadNurse) ? '' : 'btn-disabled']" 
            size="mini" 
            @tap="handleCardRecord(p, 'output')"
          >
            ＋ 记出量
          </button>
          <button class="quick-btn more" size="mini" @tap="openMoreActions(p)">更多 ⋯</button>
        </view>
      </view>

      <view class="empty-tip" v-if="displayPatientList.length === 0">
        <view class="empty-alert-box" v-if="patientFilterScope === 'abnormal'">
          <text class="empty-alert-icon">🎉</text>
          <text class="empty-alert-title">当前病区暂无异常预警病患</text>
          <text class="empty-alert-desc">24小时少尿(＜400ml)、差值过大(＞1000ml)与高容量输液(＞3000ml)指标均处于安全范围</text>
          <button class="m-btn small primary back-all-btn" @tap="patientFilterScope = userStore.isHeadNurse ? 'all' : 'my'">返回查看病患列表</button>
        </view>
        <view class="empty-alert-box" v-else-if="patientFilterScope === 'missed'">
          <text class="empty-alert-icon">✅</text>
          <text class="empty-alert-title">{{ userStore.isHeadNurse ? '全部患者' : '我管辖的患者' }} 4 小时内均有记录</text>
          <text class="empty-alert-desc">当前没有需要补记的患者</text>
          <button class="m-btn small primary back-all-btn" @tap="patientFilterScope = userStore.isHeadNurse ? 'all' : 'my'">返回查看病患列表</button>
        </view>
        <view v-else-if="userStore.isHeadNurse" class="empty-nurse-box">
          <text class="empty-nurse-text">该病区暂无在院病人</text>
          <button class="m-btn small primary empty-claim-btn" @tap="openAddPatientModal">＋ 建档录入病人</button>
        </view>
        <view v-else class="empty-nurse-box">
          <text class="empty-nurse-text" v-if="patientFilterScope === 'my'">您当前在管床位暂无在院病人，或尚未认领当班床位</text>
          <text class="empty-nurse-text" v-else>该病房暂无在院病人</text>
          <button class="m-btn small primary empty-claim-btn" @tap="openDutyBedModal">👉 点击选择管辖床位</button>
          <button class="m-btn small outline empty-claim-btn" @tap="openAddPatientModal">＋ 建档录入病人</button>
        </view>
      </view>
    </view>

    <!-- 护士长弹窗：分配责任护士 -->
    <view class="modal-mask" v-if="showAssignModal">
      <view class="modal-content">
        <view class="modal-title">为【{{ currentAssignPatient?.bedNo }} - {{ currentAssignPatient?.patientName }}】分配责任护士</view>
        <view class="form-desc">请选择负责该床位出入量监测的责任护士：</view>
        <view class="nurse-picker-list">
          <view 
            :class="['n-item', selectedNurseId === n.id ? 'active' : '']"
            v-for="n in nurseList" 
            :key="n.id"
            @tap="selectedNurseId = n.id"
          >
            <text class="n-name">{{ n.realName }} (工号: {{ n.jobNumber }})</text>
            <text class="n-role">{{ n.role === 'HEAD_NURSE' ? '护士长' : '护士' }}</text>
          </view>
        </view>
        <view class="modal-actions">
          <button class="m-btn cancel" @tap="showAssignModal = false">取消</button>
          <button class="m-btn confirm" type="primary" @tap="confirmAssignNurse">确认分配</button>
        </view>
      </view>
    </view>

    <!-- 护士长弹窗：新建病房 -->
    <view class="modal-mask" v-if="showAddWardModal">
      <view class="modal-content">
        <view class="modal-title">新建病房/病区</view>
        <view class="form-item">
          <text class="form-label">病区名称 *</text>
          <input class="form-input" v-model="formWard.wardName" placeholder="如：心内科三病区" />
        </view>
        <view class="form-item">
          <text class="form-label">所属科室 *</text>
          <input class="form-input" v-model="formWard.department" placeholder="如：心血管内科" />
        </view>
        <view class="form-item">
          <text class="form-label">房号</text>
          <input class="form-input" v-model="formWard.roomNo" placeholder="如：301室" />
        </view>
        <view class="modal-actions">
          <button class="m-btn cancel" @tap="showAddWardModal = false">取消</button>
          <button class="m-btn confirm" type="primary" @tap="handleAddWard">创建病房</button>
        </view>
      </view>
    </view>

    <!-- 护士长弹窗：新建床位 -->
    <view class="modal-mask" v-if="showAddBedModal">
      <view class="modal-content">
        <view class="modal-title">在【{{ currentWard?.wardName }}】新建床位</view>
        <view class="form-item">
          <text class="form-label">床位号 *</text>
          <input class="form-input" v-model="formBed.bedNo" placeholder="如：03床、加01床" />
        </view>
        <view class="modal-actions">
          <button class="m-btn cancel" @tap="showAddBedModal = false">取消</button>
          <button class="m-btn confirm" type="primary" @tap="handleAddBed">添加床位</button>
        </view>
      </view>
    </view>

    <!-- 录入住院病患档案弹窗（所有护士可用，与后台完全一致） -->
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

        <view class="patient-modal-footer">
          <button class="p-btn cancel" @tap="showAddPatientModal = false">取消</button>
          <button class="p-btn confirm" :loading="isPatientSaving" @tap="handleAddPatient">保存</button>
        </view>
      </view>
    </view>

    <!-- 待核对记录弹窗 -->
    <view class="modal-mask" v-if="showCorrectionModal" @tap="showCorrectionModal = false">
      <view class="correction-modal" @tap.stop>
        <view class="cm-head">
          <text class="cm-title">待处理 ({{ correctionList.length }})</text>
          <text class="cm-close" @tap="showCorrectionModal = false">✕</text>
        </view>
        <view class="cm-tip">症状上报请到床边看；记录说记错的，点「确认无误」或「驳回」——驳回会从今天的出入量里移除，患者重新记。</view>
        <scroll-view scroll-y class="cm-body">
          <view
            class="cm-item"
            :class="{ 'cm-sym': c.category === 'SYMPTOM' }"
            v-for="c in correctionList"
            :key="c.id"
            @tap="onCorrectionTap(c)"
          >
            <view class="cm-line1">
              <text class="cm-bed">{{ c.bedNo }}</text>
              <text class="cm-name">{{ c.patientName }}</text>
              <text class="cm-sym-tag" v-if="c.category === 'SYMPTOM'">症状上报</text>
              <text class="cm-time">{{ (c.recordTime || '').substring(11, 16) }}</text>
            </view>

            <!-- 症状：没有对错可判断，给一个「知道了」就收口 -->
            <template v-if="c.category === 'SYMPTOM'">
              <view class="cm-line2">{{ c.itemName }}<text v-if="c.amount"> · {{ c.amount }}ml</text></view>
              <view class="cm-reason strong">患者自己上报的，请到床边看一下</view>
              <view class="cm-actions" @tap.stop>
                <text class="cm-btn primary" @tap.stop="dismissCorrection(c)">知道了</text>
              </view>
            </template>

            <!-- 记错了：护士只判断，不代改 -->
            <template v-else>
              <view class="cm-line2">
                {{ c.category === 'INTAKE' ? '喝的' : '排的' }} {{ c.amount }}ml · {{ c.itemName }}
              </view>
              <view class="cm-reason">患者说：{{ c.reason || '没说明原因' }}</view>
              <view class="cm-look">看这条的上下文 ›</view>
              <view class="cm-actions" @tap.stop>
                <text class="cm-btn ghost" @tap.stop="rejectCorrection(c)">驳回，让患者重记</text>
                <text class="cm-btn primary" @tap.stop="dismissCorrection(c)">确认无误</text>
              </view>
            </template>
          </view>
          <view class="cm-empty" v-if="correctionList.length === 0">暂无待处理</view>
        </scroll-view>
      </view>
    </view>

    <!-- 切换病房弹窗（支持查看全部科室/病区） -->
    <view class="modal-mask" v-if="showWardModal" @tap="showWardModal = false">
      <view class="ward-modal-box" @tap.stop>
        <view class="ward-modal-header">
          <text class="ward-modal-title">🏥 切换病房/病区</text>
          <text class="ward-modal-close" @tap="showWardModal = false">✕</text>
        </view>
        <scroll-view scroll-y class="ward-modal-scroll">
          <view 
            v-for="w in wardList" 
            :key="w.id"
            :class="['ward-select-item', currentWard?.id === w.id ? 'active' : '']"
            @tap="selectWard(w)"
          >
            <view class="w-item-left">
              <text class="w-name">{{ w.wardName }}</text>
              <text class="w-dept" v-if="w.department">({{ w.department }})</text>
            </view>
            <text class="w-check" v-if="currentWard?.id === w.id">✓</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 仿 Pad 端手持界面：护士当班自主认领/换班管辖床位弹窗 -->
    <view class="pad-modal-mask" v-if="showDutyBedModal" @tap="showDutyBedModal = false">
      <view class="pad-modal-window" @tap.stop>
        <!-- 头部：信息图标 + 标题 + 关闭按钮 -->
        <view class="pad-modal-header">
          <view class="pad-header-left">
            <view class="pad-info-circle">i</view>
            <text class="pad-modal-title">选择床位</text>
          </view>
          <text class="pad-close-btn" @tap="showDutyBedModal = false">✕</text>
        </view>

        <!-- 提示说明条 -->
        <view class="pad-notice-bar">
          <text class="pad-notice-text">💡 勾选床位接班即可开始记录出入量，最后交班打勾者为该床位责任护士。</text>
        </view>

        <!-- 床位列表（仿Pad带室、床号、Checkbox） -->
        <scroll-view scroll-y class="pad-bed-scroll">
          <view 
            v-for="b in dutyBedList" 
            :key="b.bedId"
            :class="['pad-bed-item', selectedDutyBedIds.includes(b.bedId) ? 'pad-item-checked' : '']"
            @tap="toggleDutyBed(b.bedId)"
          >
            <view class="pad-room-label">室</view>
            <view class="pad-bed-content">
              <view class="pad-bed-line1">
                <text class="pad-bed-number">{{ b.bedNo }}</text>
                <text :class="['pad-patient-chip', !b.patientId ? 'chip-empty' : '']">
                  {{ b.patientName || '（空床）' }}
                </text>
              </view>
              <view class="pad-bed-line2" v-if="b.currentNurseName">
                <text class="pad-other-nurse">当前在管：{{ b.currentNurseName }}</text>
              </view>
            </view>
            <view class="pad-checkbox-col">
              <view :class="['pad-checkbox-square', selectedDutyBedIds.includes(b.bedId) ? 'checked' : '']">
                <text v-if="selectedDutyBedIds.includes(b.bedId)" class="pad-check-v">✓</text>
              </view>
            </view>
          </view>

          <view class="pad-empty-box" v-if="dutyBedList.length === 0">
            <text>当前病区暂无床位</text>
          </view>
        </scroll-view>

        <!-- 底部控制栏：全选复选框 + 确定 + 退出（与 Pad 照片完全一致） -->
        <view class="pad-modal-footer">
          <view class="pad-select-all-box" @tap="toggleSelectAllDutyBeds">
            <view :class="['pad-checkbox-square', 'pad-small-check', isAllDutyBedsSelected ? 'checked' : '']">
              <text v-if="isAllDutyBedsSelected" class="pad-check-v">✓</text>
            </view>
            <text class="pad-select-all-text">全选</text>
          </view>
          <view class="pad-footer-actions">
            <button class="pad-btn pad-confirm-btn" :loading="isDutyBedSaving" @tap="handleSaveDutyBeds">确定</button>
            <button class="pad-btn pad-exit-btn" @tap="showDutyBedModal = false">退出</button>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部角色定制导航栏 -->
    <CustomTabBar current="index" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onPullDownRefresh, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user'
import { getWardsApi, getWardOverviewApi, createWardApi } from '../../api/ward'
import { getBedsByWardApi, createBedApi } from '../../api/bed'
import { getPatientsApi, createPatientApi, assignNurseApi, dischargePatientApi } from '../../api/patient'
import { getActiveNursesApi } from '../../api/auth'
import { getMyAssignmentsApi, claimMyDutyBedsApi } from '../../api/nurse'
import { getCorrectionRequestsApi, handleCorrectionRequestApi, rejectCorrectionRequestApi } from '../../api/record'
import { formatDate, formatSinceLastRecord } from '../../utils/date'
import { syncRoleTabBar } from '../../utils/tabbar'
import { queueCount, flushQueue } from '../../utils/offline'
import CustomTabBar from '../../components/CustomTabBar.vue'
import StateView from '../../components/StateView.vue'

const userStore = useUserStore()
const wardList = ref([])
const currentWard = ref(null)
const overview = ref(null)
const patientList = ref([])
const patientFilterScope = ref('my') // 护士默认聚焦在“我管辖的”
const loadState = ref('loading') // loading | error | ready
const offlinePending = ref(queueCount())

// 患者反馈「记错了」的待核对列表
const correctionList = ref([])
const showCorrectionModal = ref(false)

// 症状上报不是数据问题，是病情问题，必须在列表最上面
const symptomCount = computed(() => correctionList.value.filter(c => c.category === 'SYMPTOM').length)
const correctionBannerText = computed(() => {
  const symptom = symptomCount.value
  const wrong = correctionList.value.length - symptom
  if (symptom > 0 && wrong > 0) return `${symptom} 条症状上报，${wrong} 条说记错了`
  if (symptom > 0) return `${symptom} 条症状上报，请当面看一下`
  return `${wrong} 条记录患者说记错了`
})

async function loadCorrections(wardId) {
  if (!wardId) return
  try {
    const list = await getCorrectionRequestsApi(wardId)
    // 症状排前面：护士扫一眼先看到病情信号
    correctionList.value = (list || []).slice().sort((a, b) => {
      const sa = a.category === 'SYMPTOM' ? 0 : 1
      const sb = b.category === 'SYMPTOM' ? 0 : 1
      return sa - sb
    })
  } catch (e) {
    // 拉不到不影响主流程，下一次刷新再试
    correctionList.value = []
  }
}

// 症状上报没有「对错」可判断，点一下就是知道了
function onCorrectionTap(item) {
  if (item.category === 'SYMPTOM') {
    uni.showModal({
      title: `${item.bedNo} ${item.patientName}`,
      content: `${item.itemName}${item.amount ? ' · ' + item.amount + 'ml' : ''}\n上报时间 ${(item.createTime || '').replace('T', ' ').substring(0, 16)}\n\n患者自己上报的症状，请到床边看一下。`,
      confirmText: '知道了',
      showCancel: false
    })
    return
  }
  goFixCorrection(item)
}

// 记录本身没问题 / 症状已知晓
async function dismissCorrection(item) {
  try {
    await handleCorrectionRequestApi(item.id)
    correctionList.value = correctionList.value.filter(c => c.id !== item.id)
    uni.showToast({
      title: item.category === 'SYMPTOM' ? '已知晓，请到床边查看' : '已标记确认无误',
      icon: 'none'
    })
  } catch (e) {
    console.error('处理核对请求失败', e)
  }
}

// 记录不成立：不代改，直接撤掉这条，让患者重新记一次
async function rejectCorrection(item) {
  const confirmed = await new Promise((resolve) => {
    uni.showModal({
      title: '驳回这条记录？',
      content: `【${item.itemName} ${item.amount}ml】会从今天的出入量里移除，患者会收到提醒重新记一次。\n\n护士不代改数据，驳回后不可撤回。`,
      confirmText: '驳回',
      confirmColor: '#ff4d4f',
      success: (res) => resolve(res.confirm),
      fail: () => resolve(false)
    })
  })
  if (!confirmed) return
  try {
    await rejectCorrectionRequestApi(item.id)
    correctionList.value = correctionList.value.filter(c => c.id !== item.id)
    uni.showToast({ title: '已驳回，等患者重记', icon: 'none' })
    if (currentWard.value) {
      loadWardData(currentWard.value.id)
    }
  } catch (e) {
    console.error('驳回失败', e)
    uni.showToast({ title: '驳回失败，请重试', icon: 'none' })
  }
}

// 点进患者详情，只是想看看这条记录的上下文（谁录的、旁边还记了什么），
// 判断对错仍然只在详情页点「确认无误 / 驳回」，不允许护士代改患者的记录
async function goFixCorrection(item) {
  showCorrectionModal.value = false
  const datePart = (item.recordTime || '').substring(0, 10)
  const query = [
    `patientId=${item.patientId}`,
    `recordId=${item.recordId}`,
    `category=${item.category}`,
    `correctionId=${item.id}`,
    datePart ? `date=${datePart}` : '',
    `reason=${encodeURIComponent(item.reason || '')}`
  ].filter(Boolean).join('&')
  uni.navigateTo({ url: `/pages/patient/detail?${query}` })
}

async function retryOffline() {
  uni.showLoading({ title: '正在补传…' })
  await flushQueue()
  uni.hideLoading()
  offlinePending.value = queueCount()
  await reloadCurrentWard()
}

const allPatientsCount = computed(() => patientList.value.length)

// 我管辖的床号列表
const myDutyBedNos = computed(() => {
  return patientList.value.filter(p => p.isMyDuty).map(p => p.bedNo)
})

// 我管辖的在院患者（顶部数字、漏记哨兵、合计入出量共用这一个基数）
const myDutyPatients = computed(() => patientList.value.filter(p => p.isMyDuty))

const myPatientsCount = computed(() => myDutyPatients.value.length)

// 护士：'我负责' 与 '全部' 是两个视角，护士长只有病区视角
const isWardScope = computed(() => userStore.isHeadNurse || patientFilterScope.value === 'all')

const headerPatientCount = computed(() => (isWardScope.value ? allPatientsCount.value : myPatientsCount.value))

const headerPatientLabel = computed(() => {
  if (userStore.isHeadNurse) return '病区总病患'
  if (isWardScope.value) return '全部病患'
  return '我负责病患'
})

// 头部合计：看全部时用病区汇总，看我负责时只算我管的床
const headerIntake = computed(() => {
  if (isWardScope.value) return overview.value?.wardTotalIntake || 0
  return myDutyPatients.value.reduce((sum, p) => sum + Number(p.todayIntake || 0), 0)
})

const headerOutput = computed(() => {
  if (isWardScope.value) return overview.value?.wardTotalOutput || 0
  return myDutyPatients.value.reduce((sum, p) => sum + Number(p.todayOutput || 0), 0)
})

const abnormalPatientsCount = computed(() => {
  return patientList.value.filter(p => p.isAbnormal).length
})

// 漏记哨兵：护士只看自己管辖的床（超出自己管辖的床提醒了也补不了），护士长看全病区
const missedPatients = computed(() => {
  const base = userStore.isHeadNurse ? patientList.value : myDutyPatients.value
  return base.filter(p => p.isMissed)
})

const missedPatientsCount = computed(() => missedPatients.value.length)

const missedBannerText = computed(() => {
  const prefix = userStore.isHeadNurse ? '' : '我管辖的 '
  return `${prefix}${missedPatientsCount.value} 位患者超过 4 小时未记录`
})

function toggleHeaderScope() {
  if (userStore.isHeadNurse) {
    patientFilterScope.value = 'all'
    return
  }
  patientFilterScope.value = patientFilterScope.value === 'my' ? 'all' : 'my'
}

const displayPatientList = computed(() => {
  if (patientFilterScope.value === 'abnormal') {
    return patientList.value.filter(p => p.isAbnormal)
  }
  if (patientFilterScope.value === 'missed') {
    return missedPatients.value
  }
  if (userStore.isHeadNurse || patientFilterScope.value === 'all') {
    return patientList.value
  }
  return myDutyPatients.value
})

function toggleMissedFilter() {
  patientFilterScope.value = patientFilterScope.value === 'missed'
    ? (userStore.isHeadNurse ? 'all' : 'my')
    : 'missed'
}

function recordPulseText(p) {
  const base = formatSinceLastRecord(p.lastRecordTime, p.hoursSinceLastRecord)
  const count = p.todayRecordCount || 0
  if (p.isMissed) {
    return `${base} · 今日 ${count} 笔 · 建议补记`
  }
  return `${base} · 今日 ${count} 笔`
}

// 卡片「更多」：低频操作收进 ActionSheet，避免误触出院
function openMoreActions(p) {
  const itemList = ['记补液', '查看流水详情']
  if (userStore.isHeadNurse) {
    itemList.push('分配责任护士', '办理出院')
  }
  uni.showActionSheet({
    itemList,
    success: (res) => {
      const label = itemList[res.tapIndex]
      if (label === '记补液') {
        handleCardInfusion(p)
      } else if (label === '查看流水详情') {
        goToDetail(p.id)
      } else if (label === '分配责任护士') {
        openAssignModal(p)
      } else if (label === '办理出院') {
        handleDischarge(p)
      }
    }
  })
}

// 仿Pad端：管辖床位选择弹窗状态
const showDutyBedModal = ref(false)
const dutyBedList = ref([])
const selectedDutyBedIds = ref([])
const isDutyBedSaving = ref(false)

const isAllDutyBedsSelected = computed(() => {
  if (dutyBedList.value.length === 0) return false
  return dutyBedList.value.every(b => selectedDutyBedIds.value.includes(b.bedId))
})

// 弹窗状态
const showWardModal = ref(false)
const showAssignModal = ref(false)
const currentAssignPatient = ref(null)
const nurseList = ref([])
const selectedNurseId = ref(null)

const showAddWardModal = ref(false)
const formWard = ref({ wardName: '', department: '', roomNo: '' })

const showAddBedModal = ref(false)
const formBed = ref({ bedNo: '' })

// 字典选项配置（与后台完全一致）
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

const showAddPatientModal = ref(false)
const availableBeds = ref([])
const selectedBed = ref(null)
const selectedTubes = ref([])
const isPatientSaving = ref(false)

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

async function checkLoginAndLoad() {
  // 1. 未登录 -> 跳转至大厂规范登录页（图2）
  if (!userStore.token) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return
  }

  // 2. 严格核验：未绑定身份 -> 跳转到绑定页面（图3）
  if (!userStore.isBound) {
    uni.reLaunch({ url: '/pages/auth/bind' })
    return
  }

  // 3. 患者角色定向到患者端专用视图
  if (userStore.isPatient) {
    uni.switchTab({ url: '/pages/patient-view/home' })
    return
  }

  await loadWardsAndData()
}

async function loadWardsAndData() {
  loadState.value = 'loading'
  let wards = []
  try {
    wards = await getWardsApi({ status: 1 })
  } catch (e) {
    console.error('加载病区失败', e)
    loadState.value = 'error'
    return
  }
  // 确保工作台切换病区弹窗只显示正常启用的病区
  wardList.value = (wards || []).filter(w => w.status === undefined || w.status === 1)
  if (wardList.value && wardList.value.length > 0) {
    const list = wardList.value
    // 智能定位病区（满足图2需求）：
    // 1. 核心第一优先级：当前登录护士绑定的专属病区（若护士和病区已绑定，默认必展示其所在病区）
    let targetWard = null
    if (userStore.userInfo?.wardId) {
      targetWard = list.find(w => w.id === Number(userStore.userInfo.wardId))
    } else if (userStore.userInfo?.wardName) {
      targetWard = list.find(w => w.wardName === userStore.userInfo.wardName || w.wardName.includes(userStore.userInfo.wardName))
    }

    // 2. 本地缓存记录（仅当护士未绑定病区，或在当前会话中主动切换后保持）
    if (!targetWard) {
      const cachedWardId = uni.getStorageSync('selected_ward_id')
      targetWard = cachedWardId ? list.find(w => w.id === Number(cachedWardId)) : null
    }

    // 3. 匹配当前护士所属科室/楼宇
    if (!targetWard && userStore.userInfo?.department) {
      const nurseDept = userStore.userInfo.department
      targetWard = list.find(w => w.department === nurseDept || w.wardName.includes(nurseDept) || (w.building && nurseDept.includes(w.building)))
    }

    // 4. 兜底优先选择启用的首个病区
    if (!targetWard) {
      targetWard = list[0]
    }

    currentWard.value = targetWard
    uni.setStorageSync('selected_ward_id', targetWard.id)
    await loadWardData(currentWard.value.id)
  }
}

async function loadWardData(wardId) {
  if (!wardId) return
  if (!patientList.value.length) {
    loadState.value = 'loading'
  }
  try {
    const data = await getWardOverviewApi(wardId)
    overview.value = data
    patientList.value = data.patients || []
    loadState.value = 'ready'
    loadCorrections(wardId)
  } catch (e) {
    console.error(e)
    // 只有首次加载（还没有任何数据）才整页报错，刷新失败保留旧数据
    if (!patientList.value.length) {
      loadState.value = 'error'
    }
  }
}

function reloadCurrentWard() {
  if (currentWard.value) {
    loadWardData(currentWard.value.id)
  }
}

function openWardPicker() {
  showWardModal.value = true
}

function selectWard(w) {
  currentWard.value = w
  uni.setStorageSync('selected_ward_id', w.id)
  showWardModal.value = false
  loadWardData(w.id)
}

function goToNurseManage() {
  uni.navigateTo({
    url: '/pages/nurse/list'
  })
}

function goToDetail(patientId) {
  uni.navigateTo({
    url: `/pages/patient/detail?patientId=${patientId}`
  })
}

function goToRecord(patientId, type) {
  uni.navigateTo({
    url: `/pages/record/${type}?patientId=${patientId}`
  })
}

// 护士卡片点击录入：未管辖则阻止并引导认领
function handleCardRecord(p, type) {
  if (!p.isMyDuty && !userStore.isHeadNurse) {
    uni.showModal({
      title: '非当班管辖床位',
      content: `您当前未管辖【${p.bedNo} - ${p.patientName}】（或已交班取消勾选），无法为其录入数据，仅支持查阅流水！如需记录，请在顶部点击【选择床位】认领。`,
      confirmText: '去认领床位',
      cancelText: '仅查阅',
      success: (res) => {
        if (res.confirm) {
          openDutyBedModal()
        } else {
          goToDetail(p.id)
        }
      }
    })
    return
  }
  goToRecord(p.id, type)
}

function goToInfusionList() {
  uni.navigateTo({
    url: '/pages/infusion/list'
  })
}

function goToSpecialHandover() {
  uni.navigateTo({
    url: '/pages/handover/special-record'
  })
}

function handleCardInfusion(p) {
  if (!p.isMyDuty && !userStore.isHeadNurse) {
    uni.showModal({
      title: '非当班管辖床位',
      content: `您当前未管辖【${p.bedNo} - ${p.patientName}】，无法为其登记补液！如需登记，请在顶部点击【选择床位】认领。`,
      confirmText: '去认领床位',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          openDutyBedModal()
        }
      }
    })
    return
  }
  uni.navigateTo({
    url: `/pages/infusion/add?patientId=${p.id}&bedNo=${encodeURIComponent(p.bedNo)}&patientName=${encodeURIComponent(p.patientName)}&hospitalNo=${p.hospitalNo || ''}`
  })
}

// 打开仿 Pad 端选择管辖床位弹窗
async function openDutyBedModal() {
  if (!currentWard.value) return
  uni.showLoading({ title: '加载床位中...' })
  try {
    const res = await getMyAssignmentsApi(currentWard.value.id)
    dutyBedList.value = res?.beds || []
    selectedDutyBedIds.value = (res?.beds || [])
      .filter(b => b.isAssignedToThisNurse)
      .map(b => b.bedId)
    showDutyBedModal.value = true
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '加载床位失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

// 单选/反选床位
function toggleDutyBed(bedId) {
  const idx = selectedDutyBedIds.value.indexOf(bedId)
  if (idx >= 0) {
    selectedDutyBedIds.value.splice(idx, 1)
  } else {
    selectedDutyBedIds.value.push(bedId)
  }
}

// 全选/清空床位
function toggleSelectAllDutyBeds() {
  if (isAllDutyBedsSelected.value) {
    selectedDutyBedIds.value = []
  } else {
    selectedDutyBedIds.value = dutyBedList.value.map(b => b.bedId)
  }
}

// 保存管辖床位分配（勾选接班不覆盖他人，取消勾选解除管辖）
async function handleSaveDutyBeds() {
  if (!currentWard.value) return
  isDutyBedSaving.value = true
  try {
    await claimMyDutyBedsApi({
      wardId: currentWard.value.id,
      bedIds: selectedDutyBedIds.value
    })
    uni.showToast({ title: '管辖床位已更新', icon: 'success' })
    showDutyBedModal.value = false
    await loadWardData(currentWard.value.id)
  } catch (e) {
    console.error(e)
  } finally {
    isDutyBedSaving.value = false
  }
}

// 护士长：分配责任护士
async function openAssignModal(p) {
  currentAssignPatient.value = p
  selectedNurseId.value = p.assignedNurseId || null
  const nurses = await getActiveNursesApi()
  nurseList.value = nurses || []
  showAssignModal.value = true
}

async function confirmAssignNurse() {
  if (!selectedNurseId.value) {
    uni.showToast({ title: '请选择责任护士', icon: 'none' })
    return
  }
  try {
    await assignNurseApi(currentAssignPatient.value.id, selectedNurseId.value)
    uni.showToast({ title: '分配责任护士成功', icon: 'success' })
    showAssignModal.value = false
    loadWardData(currentWard.value.id)
  } catch (e) {
    console.error(e)
  }
}

// 护士长：办理出院
function handleDischarge(p) {
  uni.showModal({
    title: '办理出院确认',
    content: `确认将【${p.bedNo} - ${p.patientName}】办理出院并释放其床位吗？`,
    success: async (res) => {
      if (res.confirm) {
        await dischargePatientApi(p.id)
        uni.showToast({ title: '已办理出院', icon: 'success' })
        loadWardData(currentWard.value.id)
      }
    }
  })
}

// 护士长：新建病房
async function handleAddWard() {
  if (!formWard.value.wardName || !formWard.value.department) {
    uni.showToast({ title: '请填写病房名称及科室', icon: 'none' })
    return
  }
  await createWardApi(formWard.value)
  uni.showToast({ title: '创建病房成功', icon: 'success' })
  showAddWardModal.value = false
  formWard.value = { wardName: '', department: '', roomNo: '' }
  loadWardsAndData()
}

// 护士长：新建床位
function openAddBedModal() {
  showAddBedModal.value = true
}

async function handleAddBed() {
  if (!formBed.value.bedNo.trim()) {
    uni.showToast({ title: '请输入床位号', icon: 'none' })
    return
  }
  await createBedApi({
    wardId: currentWard.value.id,
    bedNo: formBed.value.bedNo.trim()
  })
  uni.showToast({ title: '添加床位成功', icon: 'success' })
  showAddBedModal.value = false
  formBed.value.bedNo = ''
  loadWardData(currentWard.value.id)
}

// 所有护士通用：录入住院病患档案
async function openAddPatientModal() {
  const currentWardId = currentWard.value?.id || wardList.value[0]?.id
  formPatient.value = {
    hospitalNo: '',
    patientName: '',
    gender: 1,
    age: 50,
    patientType: 'ADULT',
    admissionType: 'ROUTINE',
    wardId: currentWardId,
    bedId: null,
    nursingLevel: 'LEVEL_2',
    needIoRecordBool: true,
    admissionDate: formatDate(),
    diagnosis: ''
  }
  selectedTubes.value = []
  if (currentWardId) {
    await loadAvailableBeds(currentWardId)
  }
  showAddPatientModal.value = true
}

async function loadAvailableBeds(wardId) {
  try {
    const beds = await getBedsByWardApi(wardId)
    // 筛选当前病区的空床
    availableBeds.value = (beds || []).filter(b => b.status === 0)
    // 床位必须由录入人亲自选择，避免默认占用第一张空床
    selectedBed.value = null
    formPatient.value.bedId = null
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
    uni.showToast({ title: '病患档案录入成功', icon: 'success' })
    showAddPatientModal.value = false
    if (currentWard.value) {
      await loadWardData(currentWard.value.id)
    }
  } catch (e) {
    console.error('建档异常', e)
  } finally {
    isPatientSaving.value = false
  }
}

onMounted(() => {
  checkLoginAndLoad()
})

// 患者随时可能说「记错了」，护士一直停在首页时也要能看到。
// 只在首页可见时每分钟拉一次待核对列表，量很小（通常 0-5 条），切走就停。
let correctionTimer = null

function startCorrectionPolling() {
  stopCorrectionPolling()
  correctionTimer = setInterval(() => {
    if (currentWard.value && !userStore.isPatient) {
      loadCorrections(currentWard.value.id)
    }
  }, 60000)
}

function stopCorrectionPolling() {
  if (correctionTimer) {
    clearInterval(correctionTimer)
    correctionTimer = null
  }
}

onShow(() => {
  syncRoleTabBar()
  offlinePending.value = queueCount()
  if (userStore.isPatient) {
    uni.switchTab({ url: '/pages/patient-view/home' })
    return
  }
  if (userStore.isBound && !userStore.isPatient && currentWard.value) {
    loadWardData(currentWard.value.id)
  }
  startCorrectionPolling()
})

onHide(() => {
  stopCorrectionPolling()
})

onUnload(() => {
  stopCorrectionPolling()
})

onPullDownRefresh(async () => {
  if (currentWard.value) {
    await loadWardData(currentWard.value.id)
  }
  uni.stopPullDownRefresh()
})
</script>

<style>
.container {
  padding: 24rpx;
}

.header-card {
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  color: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 8rpx 20rpx rgba(22, 119, 255, 0.2);
}

.top-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.ward-selector {
  display: flex;
  align-items: center;
}

.ward-name {
  font-size: 34rpx;
  font-weight: bold;
  margin-right: 12rpx;
}

.arrow-down {
  font-size: 22rpx;
  opacity: 0.8;
}

.role-pill {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.role-pill.head {
  background: #fa8c16;
  color: #ffffff;
}

.role-pill.nurse {
  background: #52c41a;
  color: #ffffff;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

/* 建档入口：护士现场最常用的动作，必须一直可见 */
.add-patient-btn {
  display: flex;
  align-items: center;
  background: #ffffff;
  color: #1677ff;
  font-size: 26rpx;
  font-weight: bold;
  border-radius: 30rpx;
  padding: 8rpx 22rpx;
  min-height: 56rpx;
}

.add-plus {
  font-size: 30rpx;
  margin-right: 2rpx;
}

.missed-banner {
  display: flex;
  align-items: center;
  background: #fff7e6;
  border: 1rpx solid #ffd591;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-top: 16rpx;
}

.missed-icon {
  font-size: 30rpx;
  margin-right: 10rpx;
}

.missed-text {
  flex: 1;
  font-size: 26rpx;
  color: #ad4e00;
  font-weight: 500;
}

.missed-action {
  font-size: 26rpx;
  color: #d46b08;
  font-weight: bold;
}

.record-pulse {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
  background: #f7f9fc;
  border-radius: 10rpx;
  padding: 10rpx 16rpx;
}

.record-pulse.missed {
  background: #fff7e6;
  border: 1rpx solid #ffe58f;
}

.pulse-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-right: 10rpx;
  flex-shrink: 0;
}

.dot-ok { background: #52c41a; }
.dot-warn { background: #fa8c16; }

.pulse-text {
  font-size: 24rpx;
  color: #595959;
  flex: 1;
}

.record-pulse.missed .pulse-text {
  color: #ad4e00;
  font-weight: 500;
}

.offline-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #e6f4ff;
  border: 1rpx solid #91caff;
  border-radius: 12rpx;
  padding: 14rpx 20rpx;
  margin-top: 12rpx;
}

.offline-text {
  font-size: 26rpx;
  color: #0958d9;
}

.offline-retry {
  font-size: 26rpx;
  color: #1677ff;
  font-weight: bold;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12rpx;
  padding: 16rpx 10rpx;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-item.clickable {
  cursor: pointer;
}

.stat-num {
  font-size: 32rpx;
  font-weight: bold;
}

.stat-label {
  font-size: 22rpx;
  opacity: 0.85;
  margin-top: 6rpx;
}

.color-in { color: #a0d911; }
.color-out { color: #ffd666; }
.color-danger { color: #ff7875; }

.admin-action-bar {
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin: 20rpx 0 16rpx 0;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
}

.bar-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.nurse-manage-btn {
  background-color: #e6f4ff !important;
  color: #1677ff !important;
  font-weight: 500;
  border: 1rpx solid #91caff !important;
}

.bar-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #262626;
}

.admin-btns {
  display: flex;
  justify-content: flex-end;
  gap: 12rpx;
}

.m-btn.small {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  margin: 0;
}

.m-btn.outline {
  background: #ffffff;
  color: #1677ff;
  border: 1px solid #1677ff;
}

.m-btn.primary {
  background: #1677ff;
  color: #ffffff;
}

.section-header {
  margin: 20rpx 0 16rpx 0;
  width: 100%;
}

.tab-switch-row {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  background: #f1f5f9;
  border-radius: 36rpx;
  padding: 6rpx;
  gap: 8rpx;
}

.scope-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #64748b;
  padding: 12rpx 0;
  border-radius: 30rpx;
  transition: all 0.2s;
  white-space: nowrap;
}

.scope-tab.active {
  background: #ffffff;
  color: #1677ff;
  font-weight: bold;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}

.scope-tab.tab-alert {
  color: #cf1322;
}

.scope-tab.tab-alert.alert-active {
  background: #ff4d4f !important;
  color: #ffffff !important;
  font-weight: bold;
  box-shadow: 0 4rpx 12rpx rgba(255, 77, 79, 0.35);
}

.alert-icon-text {
  color: inherit;
  margin-right: 4rpx;
}

.tab-count {
  margin-left: 4rpx;
  font-size: 22rpx;
}

.tab-count.has-alert {
  font-weight: bold;
  color: #ff4d4f;
}

.scope-tab.tab-alert.alert-active .tab-count.has-alert {
  color: #ffffff !important;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #262626;
}

.patient-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.patient-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.card-top {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.bed-badge {
  background: #e6f4ff;
  color: #1677ff;
  font-weight: bold;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-size: 26rpx;
  margin-right: 14rpx;
}

.patient-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #262626;
}

.hospital-no {
  font-size: 26rpx;
  color: #8c8c8c;
  margin-left: 8rpx;
}

.status-tags {
  margin-left: auto;
  display: flex;
  gap: 8rpx;
}

.tag {
  font-size: 22rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.tag.bound {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.tag.alert {
  background: #fff2f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
  font-weight: 500;
}

.patient-alert-banner {
  display: flex;
  align-items: center;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 8rpx;
  padding: 8rpx 16rpx;
  margin-bottom: 16rpx;
  font-size: 24rpx;
}

.alert-arrow {
  color: #fa8c16;
  font-weight: bold;
  font-size: 24rpx;
  margin-right: 8rpx;
  flex-shrink: 0;
}

.alert-title {
  font-weight: bold;
  color: #d46b08;
  margin-right: 6rpx;
  flex-shrink: 0;
}

.alert-desc {
  color: #cf1322;
  font-weight: 500;
  line-height: 1.4;
  flex: 1;
  word-break: break-all;
}

.nurse-line {
  display: flex;
  align-items: center;
  font-size: 26rpx;
  margin-bottom: 8rpx;
}

.nurse-label {
  color: #8c8c8c;
}

.nurse-val {
  color: #1677ff;
  font-weight: 500;
}

.nurse-none {
  color: #fa8c16;
}

.assign-btn {
  margin-left: auto;
  font-size: 20rpx;
  padding: 0 14rpx;
  background: #fff7e6;
  color: #fa8c16;
  border: 1px solid #ffd591;
}

.diag-line {
  font-size: 26rpx;
  color: #595959;
  margin-bottom: 16rpx;
}

.io-summary-bar {
  display: flex;
  background: #fafafa;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
  justify-content: space-between;
  align-items: center;
}

.io-col {
  display: flex;
  align-items: center;
  font-size: 26rpx;
}

.alert-red-text {
  color: #cf1322 !important;
  font-weight: bold;
}

.io-label { color: #8c8c8c; }
.io-val { font-weight: bold; }
.io-col.in .io-val { color: #52c41a; }
.io-col.out .io-val { color: #fa8c16; }
.io-val.pos { color: #1677ff; }
.io-val.neg { color: #eb2f96; }

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
}

.quick-btn {
  font-size: 26rpx;
  margin: 0;
  border-radius: 24rpx;
  min-height: 64rpx;
  line-height: 64rpx;
  padding: 0 24rpx;
}

.quick-btn.more {
  background: #f5f7fa;
  color: #595959;
  border: 1px solid #d9d9d9;
}

.quick-btn.in {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #52c41a;
}

.quick-btn.out {
  background: #fffbe6;
  color: #fa8c16;
  border: 1px solid #fa8c16;
}

.quick-btn.infusion {
  background: #e6fffb;
  color: #13c2c2;
  border: 1px solid #13c2c2;
}

.quick-feature-bar {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.2);
}

.feature-capsule {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 30rpx;
  padding: 10rpx 0;
}

.feature-capsule.handover {
  background: rgba(255, 255, 255, 0.25);
}

.capsule-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
}

.capsule-text {
  font-size: 26rpx;
  color: #ffffff;
  font-weight: 500;
}

.quick-btn.view {
  background: #e6f4ff;
  color: #1677ff;
}

.quick-btn.discharge {
  background: #fff1f0;
  color: #ff4d4f;
  border: 1px solid #ffa39e;
}

.empty-tip {
  text-align: center;
  padding: 80rpx 0;
  color: #8c8c8c;
  font-size: 26rpx;
}

.empty-alert-box {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 60rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.empty-alert-icon {
  font-size: 64rpx;
  margin-bottom: 20rpx;
}

.empty-alert-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #237804;
  margin-bottom: 12rpx;
}

.empty-alert-desc {
  font-size: 24rpx;
  color: #595959;
  line-height: 1.5;
  text-align: center;
  margin-bottom: 30rpx;
}

.back-all-btn {
  background: #1677ff;
  border-radius: 30rpx;
  font-size: 24rpx;
  padding: 8rpx 32rpx;
}

/* 弹窗样式 */
.correction-banner {
  display: flex;
  align-items: center;
  background: #fff7e6;
  border: 1rpx solid #ffd591;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-top: 14rpx;
}

.correction-icon {
  font-size: 30rpx;
  margin-right: 10rpx;
}

.correction-text {
  flex: 1;
  font-size: 28rpx;
  color: #ad4e00;
  font-weight: 500;
}

.correction-action {
  font-size: 26rpx;
  color: #d46b08;
  font-weight: bold;
}

.correction-modal {
  width: 88%;
  max-height: 78vh;
  background: #ffffff;
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx 20rpx;
  border-bottom: 1rpx solid #f2f4f7;
}

.cm-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #1f2329;
}

.cm-close {
  font-size: 32rpx;
  color: #8c8c8c;
  padding: 0 8rpx;
}

.cm-body {
  height: 62vh;
  padding: 10rpx 24rpx 24rpx;
}

.cm-item {
  border: 1rpx solid #eef0f4;
  border-radius: 14rpx;
  padding: 20rpx;
  margin-top: 18rpx;
  background: #fafbfc;
}

/* 症状上报：红边直接把人拽到这一条，和数据纠错明确分开 */
.cm-item.cm-sym {
  border-color: #ffccc7;
  background: #fff2f0;
}

.cm-sym-tag {
  font-size: 22rpx;
  color: #ffffff;
  background: #cf1322;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  margin-right: 10rpx;
}

.cm-reason.strong {
  color: #cf1322;
  font-weight: bold;
}

.cm-line1 {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.cm-bed {
  background: #1677ff;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: bold;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  margin-right: 10rpx;
}

.cm-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #1f2329;
  flex: 1;
}

.cm-time {
  font-size: 26rpx;
  color: #8c8c8c;
}

.cm-line2 {
  font-size: 28rpx;
  color: #1f2329;
  margin-bottom: 10rpx;
}

.cm-reason {
  font-size: 26rpx;
  color: #cf1322;
  background: #fff1f0;
  border-radius: 8rpx;
  padding: 10rpx 14rpx;
}

.cm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 16rpx;
}

.cm-tip {
  font-size: 24rpx;
  color: #8c8c8c;
  line-height: 1.5;
  padding: 0 30rpx 16rpx;
}

.cm-look {
  font-size: 22rpx;
  color: #1677ff;
  text-align: right;
  margin-top: 10rpx;
}

.cm-btn {
  font-size: 28rpx;
  border-radius: 44rpx;
  height: 84rpx;
  line-height: 84rpx;
  padding: 0 24rpx;
  text-align: center;
  box-sizing: border-box;
}

.cm-btn.ghost {
  color: #cf1322;
  background: #fff1f0;
  border: 1rpx solid #ffccc7;
}

.cm-btn.primary {
  color: #ffffff;
  background: #1677ff;
  font-weight: bold;
}

.cm-empty {
  text-align: center;
  font-size: 28rpx;
  color: #bfbfbf;
  padding: 60rpx 0;
}

.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
}

.modal-content {
  background: #ffffff;
  width: 88%;
  border-radius: 20rpx;
  padding: 40rpx;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 24rpx;
}

.form-desc {
  font-size: 26rpx;
  color: #8c8c8c;
  margin-bottom: 20rpx;
}

.nurse-picker-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  max-height: 380rpx;
  overflow-y: auto;
  margin-bottom: 30rpx;
}

.n-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e8e8e8;
  padding: 18rpx 24rpx;
  border-radius: 12rpx;
}

.n-item.active {
  border-color: #1677ff;
  background: #e6f4ff;
  color: #1677ff;
  font-weight: bold;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  font-size: 26rpx;
  color: #595959;
  display: block;
  margin-bottom: 8rpx;
}

.form-input {
  height: 80rpx;
  min-height: 80rpx;
  line-height: 80rpx;
  padding: 0 20rpx;
  border: 1px solid #d9d9d9;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.picker-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.arrow {
  font-size: 22rpx;
  color: #bfbfbf;
}

.modal-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}

.m-btn {
  flex: 1;
  font-size: 28rpx;
}

/* 当班管辖床位状态条 */
.duty-bar-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-top: 20rpx;
  border: 1px solid #bae0ff;
  box-shadow: 0 4rpx 12rpx rgba(22, 119, 255, 0.08);
}

.duty-bar-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-right: 16rpx;
}

.duty-badge {
  font-size: 22rpx;
  color: #1677ff;
  font-weight: bold;
}

.duty-text {
  font-size: 26rpx;
  color: #262626;
  line-height: 1.4;
}

.duty-text.empty {
  color: #fa8c16;
  font-size: 24rpx;
}

.duty-num {
  color: #1677ff;
  font-weight: bold;
}

.duty-manage-btn {
  background: #1677ff;
  color: #ffffff;
  font-size: 24rpx;
  padding: 0 20rpx;
  height: 60rpx;
  line-height: 60rpx;
  border-radius: 30rpx;
  flex-shrink: 0;
}

/* 标签样式增强 */
.tag.duty {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.tag.readonly {
  background: #f5f5f5;
  color: #8c8c8c;
  border: 1px solid #d9d9d9;
}

.quick-btn.btn-disabled {
  background: #f5f5f5 !important;
  color: #bfbfbf !important;
  border: 1px solid #d9d9d9 !important;
}

.empty-nurse-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.empty-nurse-text {
  color: #8c8c8c;
  font-size: 26rpx;
}

.empty-claim-btn {
  width: 320rpx;
}

/* ================= 仿 Pad 端床位选择弹窗样式 ================= */
.pad-modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
}

.pad-modal-window {
  background: #ffffff;
  width: 90%;
  max-width: 680rpx;
  border-radius: 12rpx;
  overflow: hidden;
  box-shadow: 0 12rpx 36rpx rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.pad-modal-header {
  background: #3b4252;
  padding: 24rpx 28rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pad-header-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.pad-info-circle {
  width: 36rpx;
  height: 36rpx;
  background: #1890ff;
  color: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: bold;
  font-family: serif;
}

.pad-modal-title {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 500;
  letter-spacing: 2rpx;
}

.pad-close-btn {
  color: #d8dee9;
  font-size: 32rpx;
  padding: 4rpx 12rpx;
}

.pad-notice-bar {
  background: #fffbe6;
  border-bottom: 1px solid #ffe58f;
  padding: 14rpx 24rpx;
}

.pad-notice-text {
  font-size: 22rpx;
  color: #d46b08;
  line-height: 1.4;
}

.pad-bed-scroll {
  max-height: 640rpx;
  min-height: 300rpx;
  background: #eceff4;
}

.pad-bed-item {
  display: flex;
  align-items: center;
  background: #f4f6f9;
  border-bottom: 1px solid #e5e9f0;
  padding: 22rpx 24rpx;
  transition: background-color 0.15s ease;
}

.pad-bed-item:active {
  background: #e5e9f0;
}

.pad-bed-item.pad-item-checked {
  background: #ffffff;
}

.pad-room-label {
  font-size: 28rpx;
  color: #4c566a;
  width: 70rpx;
  font-weight: 500;
}

.pad-bed-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.pad-bed-line1 {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.pad-bed-number {
  font-size: 30rpx;
  color: #2e3440;
  font-weight: bold;
}

.pad-patient-chip {
  font-size: 24rpx;
  color: #2e3440;
}

.pad-patient-chip.chip-empty {
  color: #8c8c8c;
}

.pad-other-nurse {
  font-size: 22rpx;
  color: #00897b;
}

.pad-checkbox-col {
  padding-left: 20rpx;
}

.pad-checkbox-square {
  width: 44rpx;
  height: 44rpx;
  border: 2px solid #8c8c8c;
  background: #ffffff;
  border-radius: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pad-checkbox-square.checked {
  background: #00897b;
  border-color: #00897b;
}

.pad-checkbox-square.pad-small-check {
  width: 38rpx;
  height: 38rpx;
}

.pad-check-v {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: bold;
  line-height: 1;
}

.pad-empty-box {
  padding: 60rpx 0;
  text-align: center;
  color: #8c8c8c;
  font-size: 26rpx;
}

/* 仿Pad底部条 */
.pad-modal-footer {
  background: #e5e9f0;
  padding: 18rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #d8dee9;
}

.pad-select-all-box {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.pad-select-all-text {
  font-size: 28rpx;
  color: #2e3440;
  font-weight: 500;
}

.pad-footer-actions {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.pad-btn {
  margin: 0;
  height: 72rpx;
  line-height: 72rpx;
  font-size: 28rpx;
  border-radius: 8rpx;
  min-width: 140rpx;
  padding: 0 30rpx;
}

.pad-confirm-btn {
  background: #ffffff;
  color: #2e3440;
  border: 1px solid #c0c6cf;
}

.pad-confirm-btn:active {
  background: #e2e6eb;
}

.pad-exit-btn {
  background: #e5e9f0;
  color: #4c566a;
  border: 1px solid #c0c6cf;
}

.pad-exit-btn:active {
  background: #d8dee9;
}

/* 切换病房弹窗样式 */
.ward-modal-box {
  background: #ffffff;
  width: 86%;
  max-width: 620rpx;
  border-radius: 20rpx;
  padding: 30rpx;
  max-height: 75vh;
  display: flex;
  flex-direction: column;
}

.ward-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 20rpx;
  border-bottom: 1px solid #f0f0f0;
}

.ward-modal-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #111827;
}

.ward-modal-close {
  font-size: 36rpx;
  color: #8c8c8c;
  padding: 0 10rpx;
}

.ward-modal-scroll {
  max-height: 55vh;
  margin-top: 14rpx;
}

.ward-select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 16rpx;
  border-bottom: 1px solid #f5f5f5;
  border-radius: 8rpx;
}

.ward-select-item:active {
  background: #f0f7ff;
}

.ward-select-item.active {
  background: #e6f4ff;
}

.w-item-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.w-name {
  font-size: 28rpx;
  color: #262626;
  font-weight: 500;
}

.ward-select-item.active .w-name {
  color: #1677ff;
  font-weight: bold;
}

.w-dept {
  font-size: 24rpx;
  color: #8c8c8c;
}

.w-check {
  font-size: 30rpx;
  color: #1677ff;
  font-weight: bold;
}

/* 快捷录入病患按钮 */
.duty-bar-btns {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.duty-add-patient-btn {
  background: #52c41a;
  color: #ffffff;
  font-size: 24rpx;
  padding: 0 18rpx;
  height: 60rpx;
  line-height: 60rpx;
  border-radius: 30rpx;
}

.section-quick-add-btn {
  background: #52c41a;
  color: #ffffff;
  font-size: 22rpx;
  padding: 0 16rpx;
  height: 52rpx;
  line-height: 52rpx;
  border-radius: 26rpx;
}

/* 录入住院病患档案弹窗 */
.patient-modal-box {
  width: 90vw;
  max-width: 680rpx;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 32rpx;
  box-sizing: border-box;
  box-shadow: 0 12rpx 36rpx rgba(0, 0, 0, 0.2);
}

.patient-modal-header {
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
  max-height: 68vh;
  margin-top: 20rpx;
  padding-right: 6rpx;
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
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1px solid #f0f0f0;
}

.p-btn {
  flex: 1;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 14rpx;
  font-size: 28rpx;
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
