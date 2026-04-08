# PeakDone — Weekly/Monthly 자동 성과 분석 설정 가이드

> Google Cloud Functions + Cloud Scheduler를 통한 자동화된 리포트 생성

---

## 📋 개요

- **Weekly Report**: 매주 월요일 오전 9시 → 지난 7일 성과 분석
- **Monthly Report**: 매달 1일 오전 9시 → 지난 30일 성과 분석
- **알림**: FCM(Firebase Cloud Messaging) 푸시 알림
- **저장**: Firestore `users/{uid}/reports` 컬렉션에 저장

---

## 🔧 Step 1: Firebase 프로젝트 설정

### 1.1 Firebase CLI 설치
```bash
npm install -g firebase-tools
firebase login
cd /Users/charlie/Desktop/찰리\ /peakdone
firebase init functions
```

### 1.2 Functions 폴더 구조
```
functions/
├── package.json
├── .env
├── index.js (또는 report-scheduler.js)
└── .runtimeconfig.json
```

### 1.3 환경 변수 설정
```bash
# functions/.env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# firebase functions 명령으로 등록
firebase functions:config:set gemini.api_key="YOUR_GEMINI_API_KEY"
```

---

## 🚀 Step 2: Cloud Functions 배포

### 2.1 Functions 코드 준비
```bash
cd functions
npm install firebase-admin @google/genai
```

### 2.2 index.js에 함수 추가
`functions/index.js` 파일에 `report-scheduler.js` 내용 합치기:
```bash
cat ../scripts/report-scheduler.js >> index.js
```

### 2.3 배포
```bash
firebase deploy --only functions
```

배포 완료 시:
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/YOUR_PROJECT/functions
```

---

## ⏰ Step 3: Google Cloud Scheduler 설정

### 3.1 Google Cloud Console 접속
1. https://console.cloud.google.com
2. 프로젝트 선택
3. Cloud Scheduler 활성화 (API 검색 → Cloud Scheduler API 활성화)

### 3.2 Weekly Report 스케줄 생성

**콘솔 화면:**
- 지역: asia-northeast1 (서울)
- 이름: `peakdone-weekly-report`
- 빈도: `0 9 ? * MON` (주 월요일 9시)
- 시간대: Asia/Seoul
- 실행 대상: Cloud Pub/Sub
- 토픽: `firebase-schedule-generateWeeklyReport`

**또는 gcloud CLI:**
```bash
gcloud scheduler jobs create pubsub peakdone-weekly-report \
  --schedule="0 9 ? * MON" \
  --time-zone="Asia/Seoul" \
  --topic=firebase-schedule-generateWeeklyReport \
  --location=asia-northeast1
```

### 3.3 Monthly Report 스케줄 생성

**콘솔 화면:**
- 이름: `peakdone-monthly-report`
- 빈도: `0 9 1 * ?` (매달 1일 9시)
- 시간대: Asia/Seoul
- 실행 대상: Cloud Pub/Sub
- 토픽: `firebase-schedule-generateMonthlyReport`

**또는 gcloud CLI:**
```bash
gcloud scheduler jobs create pubsub peakdone-monthly-report \
  --schedule="0 9 1 * ?" \
  --time-zone="Asia/Seoul" \
  --topic=firebase-schedule-generateMonthlyReport \
  --location=asia-northeast1
```

---

## 📱 Step 4: FCM 알림 설정 (선택사항)

### 4.1 앱에서 알림 토큰 수집
```typescript
// App.tsx 또는 service worker에 추가
if ('serviceWorker' in navigator && 'Notification' in window) {
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      // Firebase Messaging에서 토큰 수집
      const messaging = getMessaging();
      getToken(messaging).then(token => {
        // Firestore users/{uid}에 저장
        updateDoc(doc(db, 'users', user.uid), {
          notificationToken: token
        });
      });
    }
  });
}
```

### 4.2 제공자 설정 (Firebase Console)
1. Firebase Console → 프로젝트 설정 → 클라우드 메시징
2. APNs 인증서 또는 Firebase Cloud Messaging 토큰 설정

---

## 🧪 Step 5: 테스트

### 5.1 HTTP 트리거로 수동 테스트
```bash
# 테스트 URL (배포 후 생성된 endpoint)
curl "https://asia-northeast1-YOUR_PROJECT.cloudfunctions.net/triggerReport?userId=USER_ID&type=weekly"
```

### 5.2 더미 데이터로 테스트
```bash
# Firestore에 테스트 사용자 및 dailyData 추가
# 수동으로 리포트 트리거 실행

# Cloud Functions 로그 확인
firebase functions:log
```

### 5.3 Firestore에서 리포트 확인
```
Firestore → users/{uid}/reports
└── [report documents with summary, strengths, improvements, nextGoal]
```

---

## ⚙️ Step 6: 앱 UI 통합

### 6.1 리포트 알림 설정 토글 UI
```typescript
// Settings 컴포넌트에 추가
const [weeklyNotification, setWeeklyNotification] = useState(false);
const [monthlyNotification, setMonthlyNotification] = useState(false);

const handleToggle = async (type: 'weekly' | 'monthly') => {
  const newValue = type === 'weekly' ? !weeklyNotification : !monthlyNotification;

  await updateDoc(doc(db, 'users', user.uid), {
    [`reportNotification.${type}`]: newValue
  });

  if (type === 'weekly') setWeeklyNotification(newValue);
  else setMonthlyNotification(newValue);
};
```

### 6.2 리포트 화면 통합
```typescript
// Dashboard.tsx에 Reports 탭 추가
const Reports = ({ userId }) => {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'users', userId, 'reports'),
      orderBy('generatedAt', 'desc'),
      limit(12)
    );

    onSnapshot(q, (snap) => {
      setReports(snap.docs.map(doc => doc.data()));
    });
  }, [userId]);

  return (
    <div>
      {reports.map((report) => (
        <div key={report.generatedAt} className="report-card">
          <h3>{report.type.toUpperCase()} REPORT</h3>
          <p>{report.summary}</p>
          <ul>
            {report.strengths.map((s) => <li key={s}>💪 {s}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
};
```

---

## 🔍 모니터링

### 로그 확인
```bash
# 실시간 함수 로그
firebase functions:log --follow

# 특정 함수 로그
firebase functions:log -- --function=generateWeeklyReport
```

### Google Cloud Monitoring
1. Cloud Console → Monitoring
2. Metrics Explorer → Cloud Functions 메트릭 확인
3. Alert Policy 설정 (함수 오류율 > 5% 시 알림)

---

## 💡 Best Practices

| 항목 | 권장사항 |
|-----|--------|
| 함수 메모리 | 512MB 이상 (Gemini API 호출용) |
| 타임아웃 | 300초 이상 |
| 최대 인스턴스 | 100 (동시 요청 처리) |
| Pub/Sub 재시도 | 7일 (Dead Letter Topic 사용) |

---

## 🛠️ 트러블슈팅

| 문제 | 해결책 |
|-----|--------|
| "Function not found" | `firebase deploy --only functions` 재실행 |
| Gemini API 오류 | `GEMINI_API_KEY` 환경 변수 확인 |
| 리포트 미생성 | Cloud Scheduler 작업 상태 확인, 함수 로그 확인 |
| 알림 미수신 | FCM 토큰 유효성 확인, 브라우저 알림 권한 확인 |

---

## 📊 비용 예상

월 1,000명 사용자 기준:
- **Cloud Functions**: ~$1-2 (호출 1,000회 × 2)
- **Cloud Scheduler**: ~$0.3 (스케줄 2개)
- **Firestore**: ~$1-3 (읽기/쓰기)
- **총 비용**: ~$3-5/월

---

## ✅ 배포 체크리스트

- [ ] `functions/package.json` 의존성 설치 완료
- [ ] `.env` 파일에서 `GEMINI_API_KEY` 설정
- [ ] `firebase deploy --only functions` 성공
- [ ] Cloud Scheduler 작업 2개 생성 (weekly, monthly)
- [ ] 테스트 URL로 수동 트리거 확인
- [ ] Firestore 리포트 문서 생성 확인
- [ ] 앱 UI에서 리포트 설정 토글 추가
- [ ] FCM 푸시 알림 테스트
