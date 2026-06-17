/**
 * Firebase Configuration and Initialization for Store AI
 * 
 * * Firebase를 사용하려면 아래 firebaseConfig 객체에 프로젝트 정보를 입력해 주세요.
 * * 설정이 입력되지 않으면 자동으로 LocalStorage 모드(데모용)로 동작하여 백엔드 없이도 테스트가 가능합니다.
 */

const firebaseConfig = {
  apiKey: "AIzaSyAiRQ-GHT3jsseTA85U9m9proepfLQsQ9Y",
  authDomain: "store-ai-ec4d5.firebaseapp.com",
  projectId: "store-ai-ec4d5",
  storageBucket: "store-ai-ec4d5.firebasestorage.app",
  messagingSenderId: "330100052988",
  appId: "1:330100052988:web:b602525011f261cca3d879",
  measurementId: "G-FN5W1QMTG2"
};

// SHA-256 해시 검증용 해시값 (비밀번호: storeai1!)
const ADMIN_PASSWORD_HASH = "805c6d58ee7be29ccdc051f33f6df231c6d3ff3fb7c7849b251a37c768652d5e";

// SHA-256 해싱 함수 (Web Crypto API 사용)
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Firebase가 설정되었는지 감지
const isFirebaseEnabled = () => {
  return firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" && firebaseConfig.apiKey !== "";
};

let db = null;

// Firebase CDN 스크립트가 로드되었는지 확인 후 초기화
function initDatabase() {
  if (isFirebaseEnabled() && typeof firebase !== 'undefined') {
    try {
      // Firebase 앱 초기화
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      console.log("Firebase Firestore initialized successfully.");
      return { type: 'firebase', db };
    } catch (e) {
      console.error("Firebase initialization failed, falling back to LocalStorage:", e);
    }
  }
  
  console.log("Firebase is not configured. Using LocalStorage mode (Demo).");
  return { type: 'local', db: window.localStorage };
}

// 데이터베이스 연동 Helper 클래스
class DatabaseService {
  constructor() {
    const { type, db } = initDatabase();
    this.type = type;
    this.db = db;
    this.collectionName = "store_ai_survey_responses";
  }

  // 설문 응답 제출 (5초 타임아웃 적용으로 무한 대기 버그 방지)
  async submitResponse(data) {
    const responseData = {
      ...data,
      submittedAt: new Date().toISOString()
    };

    if (this.type === 'firebase' && this.db) {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("연결 시간 초과. Firebase Database 및 보안 규칙 설정을 확인해 주세요.")), 5000)
      );
      
      const submitPromise = this.db.collection(this.collectionName).add(responseData);
      
      return Promise.race([submitPromise, timeoutPromise]);
    } else {
      // LocalStorage 모드
      let responses = this.getLocalResponses();
      responses.push({
        id: 'local_' + Math.random().toString(36).substr(2, 9),
        ...responseData
      });
      localStorage.setItem(this.collectionName, JSON.stringify(responses));
      return { id: 'local_success' };
    }
  }

  // 설문 응답 전체 조회 (관리자용)
  async getResponses(password) {
    // 비밀번호 해시값 검증
    const inputHash = await sha256(password);
    if (inputHash !== ADMIN_PASSWORD_HASH) {
      throw new Error("비밀번호가 일치하지 않습니다.");
    }

    if (this.type === 'firebase' && this.db) {
      const snapshot = await this.db.collection(this.collectionName)
        .orderBy('submittedAt', 'desc')
        .get();
      
      const responses = [];
      snapshot.forEach(doc => {
        responses.push({ id: doc.id, ...doc.data() });
      });
      return responses;
    } else {
      // LocalStorage 모드에서 읽어오기
      return this.getLocalResponses().sort((a, b) => 
        new Date(b.submittedAt) - new Date(a.submittedAt)
      );
    }
  }

  // LocalStorage 데이터 헬퍼
  getLocalResponses() {
    const data = localStorage.getItem(this.collectionName);
    if (!data) {
      // 테스트를 위한 더미 데이터 25개 자동 생성 (로컬스토리지 모드일 때 시각화와 엑셀 확인용)
      const dummyData = this.generateDummyData();
      localStorage.setItem(this.collectionName, JSON.stringify(dummyData));
      return dummyData;
    }
    return JSON.parse(data);
  }

  // 더미 데이터 생성기 (로컬 테스트 및 시연용)
  generateDummyData() {
    const storeTypes = ["백화점", "아울렛"];
    const jobs = ["영업", "지원"];
    
    const publicFeatures = [
      "이달의 주요 행사", "연간 총 행사", "관광객 최고 집중일자", "평균 집중률", "3일 날씨 예보"
    ];

    const q6Answers = [
      "경쟁사의 실시간 F&B 팝업 및 신규 브랜드 입점 일정을 추가로 크롤링하면 좋겠습니다.",
      "근처 대학교의 학기 일정 및 축제 기간도 함께 크롤링되었으면 합니다.",
      "인근 지하철역의 시간대별 하차 인원 추이 데이터를 연동해 주세요.",
      "백화점 인근 도로의 실시간 정체 상태와 교통 통제 정보가 있으면 유용할 것 같습니다.",
      "주변 예술의 전당 등 문화 시설의 대형 공연 스케줄 크롤링이 필요합니다.",
      ""
    ];

    const q7Answers = [
      "상권 날씨와 관광객 추이를 결합해 주말 프로모션 유형(예: 실내 행사 vs 야외 팝업)을 제언해 주면 좋겠음.",
      "주변 대형 컨벤션 일정에 맞춰 인근 식당가 및 MD 유치 전략 제안.",
      "비가 오거나 폭염이 있는 날, 방문객 동선에 기반한 점내 고객 분산 프로모션 추천.",
      "경쟁사 대형 사은 행사 시기에 방어적인 마케팅 쿠폰 발행 타이밍 조언.",
      "공공 데이터와 연동하여 시즌별 핵심 테마 기획전 테마 추천.",
      "지원 부서 관점에서, 혼잡도 예측에 기반한 주차 및 보안 인력 배치 최적화 제안."
    ];

    const q8Answers = [
      "백화점 브랜드별 구매 단가나 VIP 방문 비중 등 고객 세그먼트 특성이 반영되어야 함.",
      "자사 점포의 과거 프로모션 성과 이력 데이터가 필수적으로 학습되어야 함.",
      "대체 공휴일이나 샌드위치 데이 같은 캘린더 변수가 제대로 고려되어야 제언의 신뢰도가 올라갑니다.",
      "점포 MD 개편 주기 및 브랜드 리뉴얼 공사 일정 등 내부 이슈 변수 반영 필요.",
      "브랜드 카테고리별(패션, 리빙, F&B) 기온 민감도가 다르므로 이를 차등 적용해야 함."
    ];

    const q10Answers = [
      "지도 UI가 모바일에서도 빠르게 로딩될 수 있도록 최적화가 중요할 것 같습니다.",
      "전반적으로 캘린더와 공공 API 연동은 획기적입니다. AI 전략 제언이 얼마나 신뢰성 있을지가 관건입니다.",
      "영업 담당자들이 아침 조회 시 쉽게 볼 수 있도록 데일리 대시보드 리포트 이메일 발송 기능이 있으면 좋겠네요.",
      "기획안이 매우 실무적이며 완성도 높습니다. 빠른 구현을 기대합니다."
    ];

    const dummies = [];
    
    for (let i = 0; i < 25; i++) {
      const q4Count = Math.floor(Math.random() * 3) + 1;
      const selectedPublic = [];
      while(selectedPublic.length < q4Count) {
        const item = publicFeatures[Math.floor(Math.random() * publicFeatures.length)];
        if(!selectedPublic.includes(item)) selectedPublic.push(item);
      }

      dummies.push({
        id: `dummy_${i}`,
        q1: storeTypes[i % storeTypes.length],
        q2: jobs[Math.floor(i / 2) % jobs.length],
        q3: Math.floor(Math.random() * 2) + 4, // 4 or 5
        q4: selectedPublic,
        q5: Math.floor(Math.random() * 3) + 3, // 3, 4, or 5
        q6: q6Answers[i % q6Answers.length],
        q7: q7Answers[i % q7Answers.length],
        q8: q8Answers[i % q8Answers.length],
        q9: Math.floor(Math.random() * 2) + 4, // 4 or 5
        q10: q10Answers[i % q10Answers.length],
        submittedAt: new Date(Date.now() - (30 - i) * 6 * 3600 * 1000).toISOString()
      });
    }
    return dummies;
  }

  // 개별 설문 응답 삭제
  async deleteResponse(id) {
    if (this.type === 'firebase' && this.db) {
      return this.db.collection(this.collectionName).doc(id).delete();
    } else {
      let responses = this.getLocalResponses();
      responses = responses.filter(r => r.id !== id);
      localStorage.setItem(this.collectionName, JSON.stringify(responses));
      return true;
    }
  }

  // 다중 설문 응답 선택 삭제 (Batch 일괄 처리)
  async deleteResponses(ids) {
    if (this.type === 'firebase' && this.db) {
      const batch = this.db.batch();
      ids.forEach(id => {
        const docRef = this.db.collection(this.collectionName).doc(id);
        batch.delete(docRef);
      });
      return batch.commit();
    } else {
      let responses = this.getLocalResponses();
      responses = responses.filter(r => !ids.includes(r.id));
      localStorage.setItem(this.collectionName, JSON.stringify(responses));
      return true;
    }
  }
}

// 글로벌 인스턴스 노출
window.dbService = new DatabaseService();
