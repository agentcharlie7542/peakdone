/**
 * Firebase Cloud Functions — 자동화된 Weekly/Monthly 리포트 생성
 *
 * 배포 가이드:
 * 1. npm install -g firebase-tools
 * 2. firebase login
 * 3. cd functions/ && npm install
 * 4. firebase deploy --only functions
 * 5. Google Cloud Console에서 Cloud Scheduler 설정 (아래 참고)
 *
 * Cloud Scheduler 설정:
 * - Weekly: "0 9 ? * MON" (매주 월요일 9시) → generateWeeklyReport
 * - Monthly: "0 9 1 * ?" (매달 1일 9시) → generateMonthlyReport
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenAI } = require("@google/genai");

admin.initializeApp();

const db = admin.firestore();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

/**
 * 사용자의 일주일 데이터 조회
 */
async function getLastWeekData(userId: string) {
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const docs = await db
    .collection("users")
    .doc(userId)
    .collection("dailyData")
    .where("date", ">=", lastWeek.toISOString().split("T")[0])
    .where("date", "<=", today.toISOString().split("T")[0])
    .get();

  return docs.docs.map((doc: any) => doc.data());
}

/**
 * 사용자의 한 달 데이터 조회
 */
async function getLastMonthData(userId: string) {
  const today = new Date();
  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const docs = await db
    .collection("users")
    .doc(userId)
    .collection("dailyData")
    .where("date", ">=", lastMonth.toISOString().split("T")[0])
    .where("date", "<=", today.toISOString().split("T")[0])
    .get();

  return docs.docs.map((doc: any) => doc.data());
}

/**
 * Gemini API를 통한 리포트 생성
 */
async function generateReportWithGemini(
  periodData: any[],
  periodType: "weekly" | "monthly"
) {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const periodName = periodType === "weekly" ? "주간" : "월간";

  const totalTasks = periodData.reduce((acc: number, day: any) => acc + day.tasks.length, 0);
  const completedTasks = periodData.reduce(
    (acc: number, day: any) => acc + day.tasks.filter((t: any) => t.completed).length,
    0
  );
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const prompt = `
당신은 생산성 분석 전문가입니다. 다음 ${periodName} 데이터를 분석하여 전문적인 피드백을 제공하세요.

[데이터]
- 완성율: ${completionRate}%
- 완료 업무: ${completedTasks}/${totalTasks}
- 분석 기간: ${periodData.length}일

[요청]
1. 주요 성과 (2문장)
2. 강점 3가지
3. 개선점 3가지
4. 다음 주기 목표 1개

답변은 JSON 형식으로:
{
  "summary": "",
  "strengths": [],
  "improvements": [],
  "nextGoal": ""
}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
}

/**
 * 리포트를 Firestore에 저장 및 사용자에게 알림
 */
async function saveReportAndNotify(
  userId: string,
  report: any,
  periodType: "weekly" | "monthly"
) {
  try {
    const timestamp = new Date().toISOString();

    // Firestore에 리포트 저장
    await db
      .collection("users")
      .doc(userId)
      .collection("reports")
      .add({
        type: periodType,
        generatedAt: timestamp,
        summary: report.summary,
        strengths: report.strengths,
        improvements: report.improvements,
        nextGoal: report.nextGoal,
      });

    // 사용자에게 알림 토큰이 있으면 FCM으로 전송
    const userDoc = await db.collection("users").doc(userId).get();
    if (userDoc.exists() && userDoc.data()?.notificationToken) {
      const token = userDoc.data().notificationToken;
      await admin.messaging().send({
        token,
        notification: {
          title: `🎯 ${periodType === "weekly" ? "주간" : "월간"} 성과 분석 리포트 준비됨`,
          body: report.summary?.substring(0, 100) || "리포트를 앱에서 확인하세요",
        },
        webpush: {
          fcmOptions: { link: "/app?tab=reports" },
        },
      });
    }

    console.log(`✅ Report saved for user ${userId}`);
    return true;
  } catch (error) {
    console.error("Error saving report:", error);
    return false;
  }
}

/**
 * ⏰ 주간 리포트 생성 함수
 * Cloud Scheduler: 매주 월요일 9:00
 */
exports.generateWeeklyReport = functions.pubsub
  .schedule("0 9 ? * MON")
  .timeZone("Asia/Seoul")
  .onRun(async (context) => {
    console.log("📊 Starting weekly report generation...");

    try {
      const users = await db.collection("users").get();
      let successCount = 0;
      let errorCount = 0;

      for (const userDoc of users.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        // 알림 선호가 활성화된 사용자만 처리
        if (!userData.reportNotification?.weekly) continue;

        const weekData = await getLastWeekData(userId);
        if (weekData.length === 0) continue;

        const report = await generateReportWithGemini(weekData, "weekly");
        if (!report) {
          errorCount++;
          continue;
        }

        const success = await saveReportAndNotify(userId, report, "weekly");
        if (success) successCount++;
        else errorCount++;
      }

      console.log(`✅ Weekly reports: ${successCount} success, ${errorCount} failed`);
    } catch (error) {
      console.error("Error in weekly report generation:", error);
    }
  });

/**
 * 📊 월간 리포트 생성 함수
 * Cloud Scheduler: 매달 1일 9:00
 */
exports.generateMonthlyReport = functions.pubsub
  .schedule("0 9 1 * ?")
  .timeZone("Asia/Seoul")
  .onRun(async (context) => {
    console.log("📊 Starting monthly report generation...");

    try {
      const users = await db.collection("users").get();
      let successCount = 0;
      let errorCount = 0;

      for (const userDoc of users.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        // 알림 선호가 활성화된 사용자만 처리
        if (!userData.reportNotification?.monthly) continue;

        const monthData = await getLastMonthData(userId);
        if (monthData.length === 0) continue;

        const report = await generateReportWithGemini(monthData, "monthly");
        if (!report) {
          errorCount++;
          continue;
        }

        const success = await saveReportAndNotify(userId, report, "monthly");
        if (success) successCount++;
        else errorCount++;
      }

      console.log(`✅ Monthly reports: ${successCount} success, ${errorCount} failed`);
    } catch (error) {
      console.error("Error in monthly report generation:", error);
    }
  });

/**
 * 📌 HTTP로 수동 트리거 (테스트용)
 * 사용: curl https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/triggerReport?userId=USER_ID&type=weekly
 */
exports.triggerReport = functions.https.onRequest(async (req, res) => {
  const { userId, type } = req.query;

  if (!userId || !type || !["weekly", "monthly"].includes(type)) {
    return res.status(400).json({ error: "Missing or invalid parameters" });
  }

  try {
    const dataGetter = type === "weekly" ? getLastWeekData : getLastMonthData;
    const periodData = await dataGetter(userId as string);

    if (periodData.length === 0) {
      return res.status(404).json({ error: "No data found for this period" });
    }

    const report = await generateReportWithGemini(periodData, type as "weekly" | "monthly");
    if (!report) {
      return res.status(500).json({ error: "Failed to generate report" });
    }

    await saveReportAndNotify(userId as string, report, type as "weekly" | "monthly");

    return res.status(200).json({ success: true, report });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});
