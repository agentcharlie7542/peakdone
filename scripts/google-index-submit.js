/**
 * Google Indexing API — URL 즉시 색인 요청 스크립트
 *
 * ─ 준비 사항 ──────────────────────────────────────────────────────────────
 * 1. Google Cloud Console에서 "Indexing API" 활성화
 *    https://console.cloud.google.com/apis/library/indexing.googleapis.com
 *
 * 2. 서비스 계정 생성 후 JSON 키 다운로드
 *    → scripts/service-account.json 으로 저장 (절대 Git에 커밋하지 마세요!)
 *
 * 3. Google Search Console에서 해당 서비스 계정을 소유자(Owner)로 등록
 *
 * 4. 패키지 설치
 *    npm install googleapis
 *
 * ─ 실행 ───────────────────────────────────────────────────────────────────
 *    node scripts/google-index-submit.js
 *
 * ─ 주의 ───────────────────────────────────────────────────────────────────
 * - 하루 최대 200 URL 색인 요청 가능
 * - 색인 결과 반영까지 수 시간~수 일 소요
 */

import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 색인 요청할 URL 목록 ────────────────────────────────────────────────────
const URLS_TO_INDEX = [
  'https://peakdone.app/',
  'https://peakdone.app/en/',
  'https://peakdone.app/timebox-planner',
  'https://peakdone.app/en/timebox-planner',
  'https://peakdone.app/blog/harvard-study-method',
  'https://peakdone.app/blog/elon-musk-time-boxing',
  'https://peakdone.app/en/blog/harvard-study-method',
  'https://peakdone.app/en/blog/elon-musk-time-boxing',
];

// ── 인증 ────────────────────────────────────────────────────────────────────
async function getAuthClient() {
  const keyFile = path.join(__dirname, 'service-account.json');
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });
  return auth.getClient();
}

// ── 단일 URL 색인 요청 ──────────────────────────────────────────────────────
async function notifyGoogle(authClient, url) {
  const indexing = google.indexing({ version: 'v3', auth: authClient });
  try {
    const res = await indexing.urlNotifications.publish({
      requestBody: {
        url,
        type: 'URL_UPDATED', // 신규 또는 업데이트된 URL
      },
    });
    console.log(`✅ [${res.status}] ${url}`);
    return res;
  } catch (err) {
    console.error(`❌ [ERROR] ${url}`, err.message);
    return null;
  }
}

// ── 메인 실행 ────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Google Indexing API — URL 색인 요청 시작\n');

  let authClient;
  try {
    authClient = await getAuthClient();
  } catch (e) {
    console.error('🔑 인증 실패: scripts/service-account.json 파일을 확인하세요.');
    console.error(e.message);
    process.exit(1);
  }

  let success = 0;
  let failed = 0;

  for (const url of URLS_TO_INDEX) {
    const result = await notifyGoogle(authClient, url);
    if (result) success++;
    else failed++;

    // Rate limit 방지: 요청 사이 500ms 대기
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n📊 결과: 성공 ${success} / 실패 ${failed} / 총 ${URLS_TO_INDEX.length}`);
  console.log('ℹ️  색인 반영은 수 시간~수 일이 소요됩니다. Google Search Console에서 확인하세요.');
}

main();
