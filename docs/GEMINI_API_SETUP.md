# ⚡ Gemini API 빠른 설정 (수동 방식)

## 📋 3단계로 완료

### Step 1: Gemini API 키 발급
1. https://aistudio.google.com/app/apikeys 이동
2. "Create API key" 클릭
3. 생성된 키 **복사** (보안: 절대 GitHub에 커밋하면 안 됨)

### Step 2: .env.local 파일 생성
프로젝트 루트(`/Users/charlie/Desktop/찰리 /peakdone/`) 에 `.env.local` 파일 생성:

```
VITE_GEMINI_API_KEY=YOUR_API_KEY_HERE
```

**예시:**
```
VITE_GEMINI_API_KEY=AIzaSyB2_8q7F9x3nK4mL5pZ2qR8sT9u0vW1xY2Z
```

### Step 3: 개발 서버 재시작
```bash
# 터미널에서
npm run dev

# 또는 기존 서버 재시작 (Ctrl+C 후)
```

---

## 📱 앱에서 사용

**대시보드 하단의 "AI 성과 분석 생성" 버튼 클릭**
- ✅ Weekly Report: 지난 7일 분석
- ✅ Monthly Report: 지난 30일 분석

---

## 🔒 보안 안내

**⚠️ 절대 하지 말 것:**
```
❌ git add .env.local
❌ GitHub에 API 키 노출
```

**✅ .gitignore 확인:**
```bash
# .gitignore에 이미 포함됨
.env.local
*.local
```

---

## 🆘 오류 메시지 해결

| 오류 | 원인 | 해결책 |
|------|------|--------|
| "API key is missing" | .env.local 미설정 | 위의 Step 2 실행 |
| "Invalid API key" | 키 복사 오류 | Step 1에서 다시 발급 |
| "UNAUTHENTICATED" | 키가 유효하지 않음 | Google AI Studio에서 비활성화 확인 |

---

## 💡 테스트

앱 실행 후:
```
1. Dashboard 탭 이동
2. "주간 리포트 생성" 버튼 클릭
3. 로딩 후 AI 분석 결과 표시됨
```

완료! 🎉
