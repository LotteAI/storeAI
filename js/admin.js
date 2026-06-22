/**
 * Admin Dashboard Logic for Store AI
 */

let surveyResponses = [];
let currentFeedbackTab = 'q6'; // Q6 문항으로 기본 탭 설정
let adminPassword = '';

// 정렬 및 선택 상태 관리 전역 변수
let sortColumn = 'submittedAt';
let sortOrder = 'none'; // 'none' | 'asc' | 'desc'
let selectedResponseIds = [];
let activeDeleteId = null;  // 개별 삭제 대상 ID
let activeDeleteIds = [];  // 일괄 삭제 대상 ID 배열
let showAllSubjective = false; // 주관식 전체 보기 여부

// Chart.js 인스턴스 참조 보관용 객체
const charts = {
  metricsAvg: null,
  storeTypes: null,
  jobTypes: null,
  publicFeatures: null
};

// 상단 대형 네비게이션 탭 전환 제어
function switchNavTab(tabKey) {
  const tabDashboard = document.getElementById("tabContentDashboard");
  const tabTable = document.getElementById("tabContentTable");
  const btnDashboard = document.getElementById("navTabDashboard");
  const btnTable = document.getElementById("navTabTable");

  if (!tabDashboard || !tabTable || !btnDashboard || !btnTable) return;

  if (tabKey === 'dashboard') {
    tabDashboard.style.display = "flex";
    tabTable.style.display = "none";
    btnDashboard.classList.add("active");
    btnTable.classList.remove("active");

    // 숨겨진 컨테이너에서 드러날 때 차트 찌그러짐 예방을 위한 업데이트
    setTimeout(() => {
      Object.keys(charts).forEach(key => {
        if (charts[key]) {
          charts[key].resize();
          charts[key].update();
        }
      });
    }, 50);
  } else if (tabKey === 'table') {
    tabDashboard.style.display = "none";
    tabTable.style.display = "flex";
    btnDashboard.classList.remove("active");
    btnTable.classList.add("active");
    
    // 테이블 다시 그리기
    renderTable();
  }

  lucide.createIcons();
}

document.addEventListener("DOMContentLoaded", () => {
  // Lucide 아이콘 초기화
  lucide.createIcons();

  // 세션 스토리지에 암호 정보가 있는 경우 자동 로그인 시도
  const savedPw = sessionStorage.getItem("admin_pw_storeai");
  if (savedPw) {
    document.getElementById("inputPassword").value = savedPw;
    verifyAdmin();
  }

  // 비밀번호 입력창에서 Enter 감지
  document.getElementById("inputPassword").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      verifyAdmin();
    }
  });
});

// 관리자 인증 시도
async function verifyAdmin() {
  const pwInput = document.getElementById("inputPassword");
  const loginOverlay = document.getElementById("loginOverlay");
  const adminContainer = document.getElementById("adminContainer");
  const errorMsg = document.getElementById("loginErrorMsg");
  const loginBtn = document.querySelector(".btn-login");
  const originalHtml = loginBtn.innerHTML;

  const pw = pwInput.value.trim();
  if (!pw) return;

  // 로딩 상태 표기
  loginBtn.disabled = true;
  loginBtn.innerHTML = `<span class="spinner"></span> 인증 중...`;
  errorMsg.style.display = "none";

  try {
    const responses = await window.dbService.getResponses(pw);
    
    // 인증 성공 처리
    adminPassword = pw;
    sessionStorage.setItem("admin_pw_storeai", pw);
    surveyResponses = responses;
    
    // UI 전환
    loginOverlay.classList.remove("active");
    adminContainer.style.display = "flex";
    
    // 대시보드 그리기
    renderDashboard();
    
  } catch (error) {
    console.error("인증 실패:", error);
    errorMsg.innerText = error.message || "비밀번호가 올바르지 않습니다.";
    errorMsg.style.display = "block";
    
    // 흔들림 이펙트
    const loginCard = document.querySelector(".login-card");
    loginCard.style.animation = "none";
    setTimeout(() => {
      loginCard.style.animation = "shake 0.4s ease";
    }, 10);
    
    pwInput.value = "";
    pwInput.focus();
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = originalHtml;
  }
}

// 대시보드 데이터 새로고침
async function loadDashboardData() {
  const refreshBtn = document.querySelector(".btn-refresh");
  const originalHtml = refreshBtn.innerHTML;
  
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = `<i data-lucide="refresh-cw" class="spin-animation"></i> 로딩 중...`;
  lucide.createIcons();

  try {
    const responses = await window.dbService.getResponses(adminPassword);
    surveyResponses = responses;
    selectedResponseIds = []; // 선택 상태 초기화
    document.getElementById("selectAllCheckbox").checked = false;
    updateDeleteSelectedButton();
    renderDashboard();
  } catch (error) {
    console.error("새로고침 실패:", error);
    alert("데이터를 새로 불러오는 데 실패했습니다.");
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = originalHtml;
    lucide.createIcons();
  }
}

// 대시보드 렌더링 총괄
function renderDashboard() {
  renderMetrics();
  renderCharts();
  renderFeedback();
  renderTable(); 
}

// 1. 핵심 스코어 카드 갱신
function renderMetrics() {
  const count = surveyResponses.length;
  document.getElementById("metricTotalResponses").innerText = count;

  if (count === 0) {
    document.getElementById("metricAvgMap").innerHTML = `0.0 <span class="max-val">/ 5.0</span>`;
    document.getElementById("metricAvgCal").innerHTML = `0.0 <span class="max-val">/ 5.0</span>`;
    document.getElementById("metricAvgEff").innerHTML = `0.0 <span class="max-val">/ 5.0</span>`;
    return;
  }

  // q3(지도), q5(캘린더), q10(효율성) 평균 계산
  const sumQ3 = surveyResponses.reduce((acc, curr) => acc + (curr.q3 || 0), 0);
  const sumQ5 = surveyResponses.reduce((acc, curr) => acc + (curr.q5 || 0), 0);
  const sumQ10 = surveyResponses.reduce((acc, curr) => acc + (curr.q10 || 0), 0);

  const avgQ3 = (sumQ3 / count).toFixed(1);
  const avgQ5 = (sumQ5 / count).toFixed(1);
  const avgQ10 = (sumQ10 / count).toFixed(1);

  document.getElementById("metricAvgMap").innerHTML = `${avgQ3} <span class="max-val">/ 5.0</span>`;
  document.getElementById("metricAvgCal").innerHTML = `${avgQ5} <span class="max-val">/ 5.0</span>`;
  document.getElementById("metricAvgEff").innerHTML = `${avgQ10} <span class="max-val">/ 5.0</span>`;
}

// 2. Chart.js 시각화 차트 렌더링
function renderCharts() {
  const count = surveyResponses.length;
  
  // 기존 차트 파괴
  Object.keys(charts).forEach(key => {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  });

  if (count === 0) return;

  const colorPrimary = '#0071e3'; // Apple Blue
  const colorSecondary = '#6e00f5'; // Tech Purple
  const colorAccent = '#30d158'; // Success Green
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
  const gridColor = 'rgba(255, 255, 255, 0.08)';

  Chart.defaults.color = textColor;
  Chart.defaults.font.family = 'Inter, -apple-system, sans-serif';

  // --- 차트 1: 5점 척도 핵심 평가 지표 평균 (가로형 막대 차트) ---
  const indicatorSums = [0, 0, 0];
  surveyResponses.forEach(r => {
    indicatorSums[0] += r.q3 || 0;
    indicatorSums[1] += r.q5 || 0;
    indicatorSums[2] += r.q10 || 0;
  });
  
  const indicatorAvgs = indicatorSums.map(sum => (sum / count).toFixed(2));

  const ctx1 = document.getElementById('chartMetricsAvg').getContext('2d');
  charts.metricsAvg = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: ["Q3. 지도 유용성", "Q5. 캘린더 도움도", "Q10. 업무 효율 개선"],
      datasets: [{
        label: '평균 점수 (5점 만점)',
        data: indicatorAvgs,
        backgroundColor: [colorPrimary, colorSecondary, colorAccent],
        borderRadius: 8,
        borderWidth: 0,
        barThickness: 20
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { 
          min: 0, 
          max: 5,
          grid: { color: gridColor },
          ticks: { stepSize: 1 }
        },
        y: { grid: { display: false } }
      }
    }
  });

  // --- 차트 2: 점포 유형별 응답 분포 (Q1: 백화점/아울렛 비율) ---
  const storeCounts = { "백화점": 0, "아울렛": 0 };
  surveyResponses.forEach(r => {
    if (storeCounts[r.q1] !== undefined) {
      storeCounts[r.q1]++;
    }
  });

  const ctx2 = document.getElementById('chartStoreTypes').getContext('2d');
  charts.storeTypes = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: Object.keys(storeCounts),
      datasets: [{
        data: Object.values(storeCounts),
        backgroundColor: ['#0071e3', '#ff9f0a'],
        borderWidth: 2,
        borderColor: '#121318'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      },
      cutout: '55%'
    }
  });

  // --- 차트 3: 담당 업무별 응답 분포 (Q2: 영업/지원 비율) ---
  const jobCounts = { "영업": 0, "지원": 0 };
  surveyResponses.forEach(r => {
    if (jobCounts[r.q2] !== undefined) {
      jobCounts[r.q2]++;
    }
  });

  const ctx3 = document.getElementById('chartJobTypes').getContext('2d');
  charts.jobTypes = new Chart(ctx3, {
    type: 'doughnut',
    data: {
      labels: Object.keys(jobCounts),
      datasets: [{
        data: Object.values(jobCounts),
        backgroundColor: ['#6e00f5', '#30d158'],
        borderWidth: 2,
        borderColor: '#121318'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      },
      cutout: '55%'
    }
  });

  // --- 차트 4: 공공 데이터 실효성 선호 빈도 (Q4 다중 선택) ---
  const publicCounts = {};
  surveyResponses.forEach(r => {
    if (r.q4 && Array.isArray(r.q4)) {
      r.q4.forEach(val => {
        publicCounts[val] = (publicCounts[val] || 0) + 1;
      });
    }
  });

  const publicLabels = Object.keys(publicCounts).sort((a,b) => publicCounts[b] - publicCounts[a]);
  const publicValues = publicLabels.map(label => publicCounts[label]);

  const ctx4 = document.getElementById('chartPublicFeatures').getContext('2d');
  charts.publicFeatures = new Chart(ctx4, {
    type: 'bar',
    data: {
      labels: publicLabels,
      datasets: [{
        label: '선택 빈도 (명)',
        data: publicValues,
        backgroundColor: '#bf5af2',
        borderRadius: 6,
        barThickness: 20
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: gridColor },
          ticks: { stepSize: 1 }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

// 3. 주관식 피드백 리스트 출력
function renderFeedback() {
  const container = document.getElementById("feedbackList");
  container.innerHTML = "";

  let listHtml = "";
  const items = surveyResponses.filter(r => r[currentFeedbackTab] && r[currentFeedbackTab].trim().length > 0);

  if (items.length === 0) {
    listHtml = `<p class="no-feedback">작성된 의견이 없습니다.</p>`;
  } else {
    items.forEach(r => {
      listHtml += createFeedbackCard(r.q1, r.q2, r.submittedAt, r[currentFeedbackTab]);
    });
  }

  container.innerHTML = listHtml;
}

// 피드백 카드 HTML 템플릿 생성기
function createFeedbackCard(storeType, jobType, dateStr, content) {
  const formattedDate = new Date(dateStr).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <div class="feedback-card">
      <div class="feedback-meta">
        <span class="feedback-name">${storeType} / ${jobType} 담당자</span>
        <span class="feedback-date">${formattedDate}</span>
      </div>
      <div class="feedback-content">${content}</div>
    </div>
  `;
}

// 피드백 탭 전환
function switchFeedbackTab(tabKey) {
  currentFeedbackTab = tabKey;
  
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.classList.remove("active");
  });

  event.target.classList.add("active");

  renderFeedback();
}

// 4. 데이터 표(Table) 렌더링 및 정렬 기능
function renderTable() {
  const tableBody = document.getElementById("tableBody");
  const tableElement = document.getElementById("surveyTable");
  
  if (!tableBody || !tableElement) return;
  tableBody.innerHTML = "";

  const count = surveyResponses.length;
  if (count === 0) {
    tableBody.innerHTML = `<tr><td colspan="14" class="no-feedback" style="text-align:center;">설문 데이터가 존재하지 않습니다.</td></tr>`;
    return;
  }

  // 1. 정렬 기준에 맞춰 데이터 복사 및 정렬
  let displayData = [...surveyResponses];

  if (sortOrder !== 'none') {
    displayData.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (sortColumn === 'submittedAt') {
        comparison = new Date(valA) - new Date(valB);
      } else {
        comparison = String(valA).localeCompare(String(valB), 'ko-KR');
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  // 2. 정렬 아이콘 헤더 업데이트
  const headers = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'submittedAt'];
  headers.forEach(header => {
    const iconSpan = document.getElementById(`sort-${header}`);
    if (iconSpan) {
      if (sortColumn === header) {
        if (sortOrder === 'asc') iconSpan.innerHTML = ' ▲';
        else if (sortOrder === 'desc') iconSpan.innerHTML = ' ▼';
        else iconSpan.innerHTML = '';
      } else {
        iconSpan.innerHTML = '';
      }
    }
  });

  // 3. 테이블 행 생성
  displayData.forEach(r => {
    const dateStr = new Date(r.submittedAt).toLocaleDateString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const isChecked = selectedResponseIds.includes(r.id);

    const q4Str = Array.isArray(r.q4) ? r.q4.join(", ") : (r.q4 || '');
    const q6 = (r.q6 || '').replace(/"/g, '&quot;');
    const q7 = (r.q7 || '').replace(/"/g, '&quot;');
    const q8 = (r.q8 || '').replace(/"/g, '&quot;');
    const q9 = (r.q9 || '').replace(/"/g, '&quot;');
    const q10 = r.q10 || 0;
    const q11 = (r.q11 || '').replace(/"/g, '&quot;');

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="row-checkbox" data-id="${r.id}" ${isChecked ? 'checked' : ''} onchange="handleRowCheckboxChange('${r.id}', this.checked)"></td>
      <td><strong>${r.q1}</strong></td>
      <td>${r.q2}</td>
      <td>${r.q3}</td>
      <td class="subjective-col" title="${q4Str}">${q4Str}</td>
      <td>${r.q5}</td>
      <td class="subjective-col" title="${q6 || '-'}">${r.q6 || '-'}</td>
      <td class="subjective-col" title="${q7 || '-'}">${r.q7 || '-'}</td>
      <td class="subjective-col" title="${q8 || '-'}">${r.q8 || '-'}</td>
      <td class="subjective-col" title="${q9 || '-'}">${r.q9 || '-'}</td>
      <td>${q10}</td>
      <td class="subjective-col" title="${q11 || '-'}">${r.q11 || '-'}</td>
      <td><span class="feedback-date">${dateStr}</span></td>
      <td>
        <button class="btn-row-delete" onclick="openDeleteModal('${r.id}')" title="삭제">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  lucide.createIcons();
}

// 주관식 답변 펼쳐보기 / 말줄임 토글 제어
function toggleSubjectiveView() {
  const table = document.getElementById("surveyTable");
  const btn = document.getElementById("btnToggleSubjective");
  if (!table || !btn) return;

  showAllSubjective = !showAllSubjective;

  if (showAllSubjective) {
    table.classList.add("expanded-mode");
    btn.innerHTML = `<i data-lucide="minimize-2"></i> 주관식 말줄임 보기`;
  } else {
    table.classList.remove("expanded-mode");
    btn.innerHTML = `<i data-lucide="maximize-2"></i> 주관식 전체 보기`;
  }

  lucide.createIcons();
}

// 컬럼 헤더 클릭 시 정렬 핸들링
function handleSort(column) {
  if (sortColumn === column) {
    if (sortOrder === 'none') sortOrder = 'asc';
    else if (sortOrder === 'asc') sortOrder = 'desc';
    else sortOrder = 'none';
  } else {
    sortColumn = column;
    sortOrder = 'asc';
  }
  renderTable();
}

// 체크박스 전체 선택 / 해제
function toggleSelectAll(masterCb) {
  const rowCheckboxes = document.querySelectorAll(".row-checkbox");
  const isChecked = masterCb.checked;
  
  selectedResponseIds = [];
  rowCheckboxes.forEach(cb => {
    cb.checked = isChecked;
    if (isChecked) {
      const id = cb.getAttribute("data-id");
      selectedResponseIds.push(id);
    }
  });
  updateDeleteSelectedButton();
}

// 개별 행 체크박스 감지
function handleRowCheckboxChange(id, isChecked) {
  if (isChecked) {
    if (!selectedResponseIds.includes(id)) {
      selectedResponseIds.push(id);
    }
  } else {
    selectedResponseIds = selectedResponseIds.filter(item => item !== id);
  }

  const allRowCbs = document.querySelectorAll(".row-checkbox");
  const selectAllCb = document.getElementById("selectAllCheckbox");
  
  if (selectAllCb) {
    selectAllCb.checked = (allRowCbs.length > 0 && selectedResponseIds.length === allRowCbs.length);
  }
  updateDeleteSelectedButton();
}

// '선택 삭제' 상단 버튼 디자인 상태 업데이트
function updateDeleteSelectedButton() {
  const btn = document.getElementById("btnDeleteSelected");
  const countSpan = document.getElementById("selectedCount");
  
  if (btn && countSpan) {
    const count = selectedResponseIds.length;
    countSpan.innerText = count;
    btn.disabled = count === 0;
  }
}

// 개별 삭제 모달 열기
function openDeleteModal(id) {
  activeDeleteId = id;
  activeDeleteIds = [];
  
  document.getElementById("deleteModalMsg").innerText = "정말 이 응답 데이터를 삭제하시겠습니까?";
  document.getElementById("deleteModal").classList.add("active");
}

// 일괄 삭제 모달 열기
function openBatchDeleteModal() {
  if (selectedResponseIds.length === 0) return;
  activeDeleteId = null;
  activeDeleteIds = [...selectedResponseIds];
  
  document.getElementById("deleteModalMsg").innerText = `정말 선택한 ${activeDeleteIds.length}개의 응답 데이터를 모두 일괄 삭제하시겠습니까?`;
  document.getElementById("deleteModal").classList.add("active");
}

// 모달 닫기
function closeDeleteModal() {
  document.getElementById("deleteModal").classList.remove("active");
  activeDeleteId = null;
  activeDeleteIds = [];
}

// 실제 삭제 승인 실행
async function confirmDelete() {
  const confirmBtn = document.getElementById("btnConfirmDelete");
  const originalHtml = confirmBtn.innerHTML;

  confirmBtn.disabled = true;
  confirmBtn.innerHTML = `<span class="spinner"></span> 삭제 중...`;

  try {
    if (activeDeleteId) {
      await window.dbService.deleteResponse(activeDeleteId);
    } else if (activeDeleteIds.length > 0) {
      await window.dbService.deleteResponses(activeDeleteIds);
    }

    closeDeleteModal();
    
    selectedResponseIds = [];
    document.getElementById("selectAllCheckbox").checked = false;
    updateDeleteSelectedButton();
    
    await loadDashboardData();
    
  } catch (error) {
    console.error("데이터 삭제 실패:", error);
    alert("데이터를 삭제하는 데 실패했습니다. 네트워크 상태 및 파이어베이스 설정을 확인해 주세요.");
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = originalHtml;
  }
}

// SheetJS를 활용한 엑셀 파일 다운로드
function downloadExcel() {
  if (surveyResponses.length === 0) {
    alert("다운로드할 데이터가 없습니다.");
    return;
  }

  const excelData = surveyResponses.map((r, index) => {
    const formattedDate = new Date(r.submittedAt).toLocaleString('ko-KR');
    return {
      "번호": surveyResponses.length - index,
      "점포 유형 (Q1)": r.q1 || "",
      "담당 업무 (Q2)": r.q2 || "",
      "지도 유용성 (Q3)": r.q3 || 0,
      "공공 데이터 실효성 (Q4)": Array.isArray(r.q4) ? r.q4.join(", ") : (r.q4 || ''),
      "캘린더 도움도 (Q5)": r.q5 || 0,
      "카테고리 상세 희망 데이터 (Q6)": r.q6 || "",
      "추가 희망 데이터 (Q7)": r.q7 || "",
      "AI 제언 필요 영역 (Q8)": r.q8 || "",
      "AI 신뢰 핵심 변수 (Q9)": r.q9 || "",
      "업무 효율 개선 (Q10)": r.q10 || 0,
      "종합 보완 의견 (Q11)": r.q11 || "",
      "제출 시간": formattedDate
    };
  });

  // SheetJS 워크시트 생성
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  
  // 컬럼 너비 자동 설정
  const colWidths = [
    { wch: 6 },  // 번호
    { wch: 15 }, // 점포 유형
    { wch: 15 }, // 담당 업무
    { wch: 15 }, // 지도 유용성
    { wch: 35 }, // 공공 데이터
    { wch: 15 }, // 캘린더 도움도
    { wch: 45 }, // Q6 카테고리 상세 희망 데이터
    { wch: 45 }, // Q7 추가 희망 데이터
    { wch: 45 }, // Q8 제언 영역
    { wch: 45 }, // Q9 신뢰 변수
    { wch: 15 }, // Q10 업무 효율
    { wch: 45 }, // Q11 보완 의견
    { wch: 22 }  // 제출 시간
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Store AI 설문 결과");

  XLSX.writeFile(workbook, "Store_AI_Survey_Results.xlsx");
}

// 흔들림 애니메이션 및 스피너 스타일
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
  .spin-animation {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);
