# PeakDone SEO 외부 등록 완전 가이드

> **도메인**: `https://peakdone.com` (배포 후 실제 도메인으로 교체)

---

## 1. Google Search Console 등록

1. https://search.google.com/search-console 접속
2. "URL 접두어" 방식으로 `https://peakdone.com/` 입력
3. HTML 태그 인증 방법 선택 → 코드 복사
4. `index.html`의 주석 처리된 부분에 코드 붙여넣기:
   ```html
   <meta name="google-site-verification" content="YOUR_CODE_HERE">
   ```
5. 배포 후 "확인" 클릭
6. 사이드바 → Sitemaps → `https://peakdone.com/sitemap.xml` 제출

---

## 2. 네이버 서치어드바이저 등록

1. https://searchadvisor.naver.com 접속 (네이버 계정 필요)
2. "사이트 등록" → `https://peakdone.com/` 입력
3. **HTML 파일 업로드** 방식 선택
4. 발급된 파일명으로 `public/` 폴더 안의 파일명 교체
5. 배포 후 "소유 확인" 클릭
6. 요청 → 웹 페이지 수집 → URL 직접 제출
7. `index.html`에 메타태그 추가:
   ```html
   <meta name="naver-site-verification" content="YOUR_NAVER_CODE">
   ```

---

## 3. Bing Webmaster Tools 등록

1. https://www.bing.com/webmasters 접속 (Microsoft 계정 필요)
2. "사이트 추가" → `https://peakdone.com/`
3. XML 사이트맵 방법으로 인증: `https://peakdone.com/sitemap.xml`
   (Google Search Console 이미 연결되어 있으면 자동 Import 가능)
4. `index.html`에 메타태그 추가:
   ```html
   <meta name="msvalidate.01" content="YOUR_BING_CODE">
   ```

---

## 4. Product Hunt 등록 (영어 타겟)

**등록 시 사용할 정보:**

```
Product Name: PeakDone
Tagline: Time box your day the Elon Musk way — 30-min blocks, AI insights
Description:
PeakDone is a precision time boxing planner inspired by how Elon Musk and
top performers structure their day. Features:
• 30-minute time blocks for your entire day
• Automatic carry-over for incomplete tasks
• Delay tracking to identify procrastination patterns
• Monthly AI productivity report powered by Gemini
• Works offline as a PWA
• Free to use — sign in with Google to sync all devices

Topics: Productivity, Time Management, AI, PWA
Makers: [Your name]
Website: https://peakdone.com/
```

**최적 런칭 시간**: 화요일 오전 12:01 AM PST (미국 서부 기준)

---

## 5. 기타 등록 리스트

| 플랫폼 | URL | 우선순위 |
|--------|-----|---------|
| AlternativeTo | https://alternativeto.net/software/add/ | ★★★ |
| There's An AI For That | https://theresanaiforthat.com/submit/ | ★★★ |
| Futurepedia | https://www.futurepedia.io/submit-tool | ★★ |
| G2 | https://sell.g2.com/add-a-product | ★★ |
| Capterra | https://www.capterra.com/vendors/sign-up | ★★ |
| AppSumo (검토 필요) | https://appsumo.com/partners/ | ★ |
| Reddit r/productivity | 커뮤니티 공유 (판매 글 아닌 가치 제공 형태) | ★★★ |

---

## 6. 백링크 전략 — 한국어 타겟

### 커뮤니티 공유 (자연스럽게)
- **클리앙** 자유게시판: "제가 만든 타임박스 앱 공유합니다"
- **디시인사이드 생산성 갤러리**: 사용 후기 공유
- **카카오 오픈채팅**: 생산성 관련 채팅방

### 블로그 기고 타겟
- 브런치(브런치스토리): 하버드 공부법 관련 에세이 + 자연스러운 링크
- 티스토리 SEO 블로그: 타임박싱 방법론 포스팅

### 유튜브 설명란
타임박스·생산성 관련 유튜버에게 협업 제안 시 설명란 링크 요청

---

## 7. 한국어 보도자료 템플릿

```
[배포 즉시] 

엘론 머스크·하버드 공부법 기반 타임박스 플래너 'PeakDone' 출시

AI 월간 피드백·자동 이월 기능으로 국내 생산성 앱 시장 공략

[서울, 2025년 4월 8일] 시간관리 앱 'PeakDone'이 정식 서비스를 시작했다.
PeakDone은 테슬라 CEO 엘론 머스크가 활용하는 타임박싱(Time Boxing) 방법론과
하버드 인지과학 연구에서 검증된 집중-휴식 사이클을 결합한 30분 단위 플래너다.

주요 기능:
▶ 30분 단위 타임박스 설계 — 하루 전체를 블록으로 시각화
▶ 미완료 태스크 자동 이월 — 지연 횟수 추적으로 병목 발견
▶ AI 월간 생산성 리포트 — Gemini AI가 나만의 황금 집중 시간대 분석
▶ PWA 오프라인 지원 — 앱 설치 없이 모바일·PC 모두 사용 가능
▶ 무료 제공 — Google 계정으로 로그인 시 전 기기 동기화

서비스 주소: https://peakdone.com/

문의: [이메일 주소]
```

---

## 8. 영어 Press Release 템플릿

```
FOR IMMEDIATE RELEASE

PeakDone Launches Time Boxing Planner Inspired by Elon Musk's Scheduling Method

AI-Powered 30-Minute Timebox App Helps Knowledge Workers Double Productivity

[City, April 8, 2025] — PeakDone, a precision time boxing planner built on
the scheduling principles used by Elon Musk and validated by Harvard cognitive
science research, is now publicly available at https://peakdone.com/.

Unlike traditional to-do apps, PeakDone assigns every task a specific 30-minute
time block on a visual daily schedule. Incomplete tasks automatically carry over
with delay tracking, and Gemini AI delivers monthly productivity reports that
identify each user's peak focus hours.

Key Features:
• 30-minute time boxes with full-day visual layout
• Smart carry-over with procrastination pattern detection  
• Monthly AI productivity digest (powered by Google Gemini)
• Progressive Web App — works offline, no install required
• Free tier — Google Sign-In syncs across all devices

"Time boxing is the single most impactful scheduling habit, but most apps
make it too complicated," said the PeakDone team. "We built PeakDone to make
Elon Musk's 5-minute block system accessible to everyone in 30-minute chunks."

Website: https://peakdone.com/
Media Contact: [email]
```
