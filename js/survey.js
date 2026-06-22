/**
 * Store AI Survey Logic (Typeform Style Navigation & Validation)
 */

let currentStep = 0;
const totalSteps = 11; // 질문 수 (1 ~ 11)

document.addEventListener("DOMContentLoaded", () => {
  // Lucide 아이콘 초기화
  lucide.createIcons();

  // 첫 화면으로 포커스
  updateProgress();
  setupEventListeners();
});

// 진행 상황 게이지 업데이트
function updateProgress() {
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  
  if (currentStep === 0) {
    progressBar.style.width = "0%";
    progressText.innerText = "0%";
  } else if (currentStep > totalSteps) {
    progressBar.style.width = "100%";
    progressText.innerText = "100%";
  } else {
    const percentage = Math.round((currentStep / totalSteps) * 100);
    progressBar.style.width = `${percentage}%`;
    progressText.innerText = `${percentage}%`;
  }
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 1. 키보드 Enter 단축키 지원
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      // 텍스트 영역(textarea)에서의 Enter는 줄바꿈을 해야 하므로 제외
      if (document.activeElement && document.activeElement.tagName === "TEXTAREA") {
        return;
      }
      e.preventDefault();
      
      if (currentStep === 0) {
        nextStep();
      } else if (currentStep < totalSteps) {
        validateAndNext(currentStep);
      } else if (currentStep === totalSteps) {
        submitSurvey();
      }
    }
  });

  // 2. 4번(Q4) 공공 데이터 체크박스 '모두 유용하지 않음' 선택 시 상호 배제 처리
  const q4Checkboxes = document.querySelectorAll('input[name="q4"]');
  q4Checkboxes.forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.value === "모두 유용하지 않음" && cb.checked) {
        q4Checkboxes.forEach(other => {
          if (other.value !== "모두 유용하지 않음") {
            other.checked = false;
          }
        });
      } else if (cb.value !== "모두 유용하지 않음" && cb.checked) {
        const noneCb = Array.from(q4Checkboxes).find(other => other.value === "모두 유용하지 않음");
        if (noneCb) noneCb.checked = false;
      }
    });
  });

  // 3. 라디오 버튼 선택 시 0.4초 후 자동으로 다음 스텝 이동
  const autoNextRadios = document.querySelectorAll('.scale-item input, .options-grid input[type="radio"]');
  autoNextRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      setTimeout(() => {
        const card = radio.closest('.survey-card');
        if (!card) return;
        const stepNum = parseInt(card.getAttribute('data-step') || "0");
        if (stepNum === currentStep) {
          validateAndNext(stepNum);
        }
      }, 350);
    });
  });
}

// 스텝 전환 연출 (애니메이션 처리)
function transitionCard(fromStep, toStep) {
  const fromCard = document.querySelector(`.survey-card[data-step="${fromStep}"]`);
  const toCard = document.querySelector(`.survey-card[data-step="${toStep}"]`);
  
  if (!fromCard || !toCard) return;

  // 1. 퇴장 애니메이션 적용
  fromCard.classList.remove("slide-down-in");
  fromCard.classList.add("slide-up-out");

  // 2. 애니메이션이 끝난 후 스텝 상태 전환
  setTimeout(() => {
    fromCard.classList.remove("active", "slide-up-out");
    
    // 3. 진입할 카드 활성화 및 애니메이션 적용
    toCard.classList.add("active", "slide-down-in");
    currentStep = toStep;
    updateProgress();
    
    // 포커싱 자동 처리 (모바일 스크롤 튐 버그 방지를 위해 try-catch 적용)
    try {
      const textInput = toCard.querySelector('.tech-input, .tech-textarea');
      if (textInput) {
        textInput.focus({ preventScroll: true });
      }
    } catch (err) {
      console.warn("Focus failed:", err);
    }
  }, 300);
}

// 다음 단계로 이동
function nextStep() {
  if (currentStep < totalSteps + 1) {
    transitionCard(currentStep, currentStep + 1);
  }
}

// 이전 단계로 이동
function prevStep() {
  if (currentStep > 0) {
    const fromCard = document.querySelector(`.survey-card[data-step="${currentStep}"]`);
    const toCard = document.querySelector(`.survey-card[data-step="${currentStep - 1}"]`);
    
    if (!fromCard || !toCard) return;

    fromCard.classList.remove("slide-down-in");
    fromCard.style.animation = "slideDownIn 0.35s cubic-bezier(0.25, 0.8, 0.25, 1) reverse forwards";
    
    setTimeout(() => {
      fromCard.classList.remove("active");
      fromCard.style.animation = "";
      
      toCard.classList.add("active");
      toCard.style.animation = "slideUpOut 0.35s cubic-bezier(0.25, 0.8, 0.25, 1) reverse forwards";
      
      currentStep = currentStep - 1;
      updateProgress();
      
      setTimeout(() => {
        toCard.style.animation = "";
      }, 350);
    }, 300);
  }
}

// 유효성 검사 및 다음 이동
function validateAndNext(step) {
  const card = document.querySelector(`.survey-card[data-step="${step}"]`);
  if (!card) return;
  const isRequired = card.getAttribute("data-required") === "true";
  
  if (!isRequired) {
    nextStep();
    return;
  }

  let isValid = false;
  
  // Q1, Q2, Q3, Q5, Q10 (라디오 버튼 검증)
  if (step === 1 || step === 2 || step === 3 || step === 5 || step === 10) {
    const qNum = `q${step}`;
    const checked = card.querySelector(`input[name="${qNum}"]:checked`);
    isValid = checked !== null;
  }
  // Q4 (체크박스 검증)
  else if (step === 4) {
    const checkedBoxes = card.querySelectorAll(`input[name="q4"]:checked`);
    isValid = checkedBoxes.length > 0;
  }

  if (isValid) {
    nextStep();
  } else {
    // 흔들림 에러 이펙트 부여
    const cardInner = card.querySelector(".card-inner");
    if (cardInner) {
      cardInner.style.animation = "none";
      setTimeout(() => {
        cardInner.style.animation = "shake 0.4s ease";
      }, 10);
    }
  }
}

// 전체 필수 값 정합성 최종 검증 (모바일 기기 폼 상태 꼬임 완벽 차단)
function validateAllRequired() {
  const requiredSteps = [
    { step: 1, name: "q1", label: "근무 점포 유형 (1번)" },
    { step: 2, name: "q2", label: "담당 업무 분야 (2번)" },
    { step: 3, name: "q3", label: "지도 기능 유용성 (3번)" },
    { step: 5, name: "q5", label: "캘린더 도움도 (5번)" },
    { step: 10, name: "q10", label: "업무 효율 개선 (10번)" }
  ];

  for (const item of requiredSteps) {
    const checked = document.querySelector(`input[name="${item.name}"]:checked`);
    if (!checked) {
      return { step: item.step, message: `필수 응답 사항인 ${item.label} 문항의 답변이 누락되었습니다. 해당 단계로 이동합니다.` };
    }
  }
  
  const checkedQ4 = document.querySelectorAll('input[name="q4"]:checked');
  if (checkedQ4.length === 0) {
    return { step: 4, message: "필수 응답 사항인 공공 데이터 활용 (4번) 문항의 답변이 누락되었습니다. 해당 단계로 이동합니다." };
  }

  return null;
}

// 폼 데이터 전송
async function submitSurvey() {
  const submitBtn = document.querySelector(".btn-submit");
  if (!submitBtn) return;
  const originalHtml = submitBtn.innerHTML;
  
  // 1. 필수 문항 입력 최종 검증
  const validationError = validateAllRequired();
  if (validationError) {
    alert(validationError.message);
    transitionCard(currentStep, validationError.step);
    return;
  }

  // 로딩 상태 연출
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> 제출 중...`;
  
  try {
    const data = parseFormData();
    await window.dbService.submitResponse(data);
    
    // 제출 성공 시 완료 화면(Step 12)으로 이동
    transitionCard(currentStep, 12);
  } catch (error) {
    console.error("설문 제출에 실패했습니다:", error);
    alert(error.message || "제출에 실패했습니다. 네트워크 상태 및 파이어베이스 설정을 확인하시고 다시 시도해 주세요.");
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }
}

// 폼 데이터 파싱 (Optional Chaining 적용으로 null-safe 처리)
function parseFormData() {
  const q1 = document.querySelector('input[name="q1"]:checked')?.value || "";
  const q2 = document.querySelector('input[name="q2"]:checked')?.value || "";
  const q3 = parseInt(document.querySelector('input[name="q3"]:checked')?.value || "0");
  
  const q4Checked = document.querySelectorAll('input[name="q4"]:checked');
  const q4 = Array.from(q4Checked).map(cb => cb.value);
  
  const q5 = parseInt(document.querySelector('input[name="q5"]:checked')?.value || "0");
  
  const q6 = document.getElementById("inputQ6")?.value.trim() || "";
  const q7 = document.getElementById("inputQ7")?.value.trim() || "";
  const q8 = document.getElementById("inputQ8")?.value.trim() || "";
  const q9 = document.getElementById("inputQ9")?.value.trim() || "";
  
  const q10 = parseInt(document.querySelector('input[name="q10"]:checked')?.value || "0");
  
  const q11 = document.getElementById("inputQ11")?.value.trim() || "";

  return {
    q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11
  };
}

// 이미지 라이트박스(확대) 제어
function openLightbox(src) {
  const lightbox = document.getElementById("imageLightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  if (lightbox && lightboxImg) {
    lightboxImg.src = src;
    lightbox.classList.add("active");
  }
}

function closeLightbox() {
  const lightbox = document.getElementById("imageLightbox");
  if (lightbox) {
    lightbox.classList.remove("active");
  }
}

// CSS Shake Keyframes 추가를 위한 스타일 삽입
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50%;
    border-top-color: #fff;
    animation: spin 1s ease-in-out infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);
