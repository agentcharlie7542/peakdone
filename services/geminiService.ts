
import { GoogleGenAI } from "@google/genai";
import { DailyData } from "../types";

/**
 * 성과 분석 리포트 생성기 (Weekly / Monthly)
 * Google Gemini API를 통한 지능형 분석
 *
 * 사용 방법:
 * const report = await generateFeedback(weeklyData, "weekly");
 */

export const generateFeedback = async (
  periodData: DailyData[],
  periodType: "weekly" | "monthly" = "monthly"
) => {
  // import.meta.env.VITE_GEMINI_API_KEY 사용 (Vite 환경 변수)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "❌ Gemini API 키가 설정되지 않았습니다.\n" +
      "해결 방법:\n" +
      "1. .env.local 파일에 VITE_GEMINI_API_KEY=YOUR_API_KEY 추가\n" +
      "2. 또는 vite.config.ts의 define 설정 확인\n" +
      "3. 개발 서버 재시작: npm run dev"
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const periodName = periodType === "weekly" ? "주간" : "월간";

  // 데이터 요약 계산
  const totalTasks = periodData.reduce((acc, day) => acc + day.tasks.length, 0);
  const completedTasks = periodData.reduce(
    (acc, day) => acc + day.tasks.filter((t) => t.completed).length,
    0
  );
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // 카테고리별 분석
  const tasksByCategory = periodData.reduce(
    (acc, day) => {
      day.tasks.forEach((task) => {
        const type = task.type || "기타";
        if (!acc[type]) acc[type] = { total: 0, completed: 0 };
        acc[type].total++;
        if (task.completed) acc[type].completed++;
      });
      return acc;
    },
    {} as Record<string, { total: number; completed: number }>
  );

  // 날짜별 업무 요약
  const tasksByDate = periodData.map((day) => ({
    date: day.date,
    items: day.tasks.map((t) => ({
      content: t.content,
      completed: t.completed,
      type: t.type,
      delayed: t.delayed || false,
    })),
  }));

  // 지연 분석
  const delayedTasks = periodData.flatMap((day) =>
    day.tasks.filter((t) => t.delayed).map((t) => ({ date: day.date, task: t.content }))
  );

  const prompt = `
당신은 세계 최고의 생산성 코치이자 성과 분석 전문가입니다. 사용자의 ${periodName} 업무 데이터를 깊이 있게 분석하여 전문적인 PeakDone 성과 리포트를 작성하세요.

[📊 데이터셋]
- 분석 기간: ${periodName} (${periodData.length}일)
- 설정된 업무: ${totalTasks}건
- 완료 업무: ${completedTasks}건 (완성율: ${completionRate}%)
- 지연된 업무: ${delayedTasks.length}건

[카테고리별 성취도]
${Object.entries(tasksByCategory)
  .map(
    ([category, stats]) =>
      `- ${category}: ${stats.completed}/${stats.total} 완료 (${Math.round((stats.completed / stats.total) * 100)}%)`
  )
  .join("\n")}

[상세 로그]
${JSON.stringify(tasksByDate, null, 2)}

[📋 리포트 구성 요청 사항]

1. **💪 성과 요약**:
   - 완성율을 바탕으로 이번 ${periodName} 성과를 평가
   - 가장 높은 생산성을 보인 날과 날씨(패턴) 분석
   - 지연 업무 패턴 발견 (시간대, 요일, 업무 유형별 분석)

2. **📈 강점 & 약점 분석**:
   - 사용자가 가장 잘하는 업무 유형 3가지
   - 개선이 필요한 영역 3가지
   - 데이터 기반 인사이트

3. **⚡ 성과 향상 전략** (다음 ${periodName}에 적용할 수 있는 구체적인 3가지):
   - 시간 배치 전략
   - 업무 우선순위 재정렬 방안
   - 집중력 유지 팁

4. **🎯 황금 시간대 발견**:
   - 당신의 최고 생산성 시간대는 언제인가?
   - 이 시간에 우선순위가 높은 업무를 배치하는 방법

5. **🏆 종합 코칭 코멘트**:
   - 긍정적 독려
   - 다음 목표 제시
   - 5줄 이내로 영감주는 메시지

[📝 출력 가이드]
- Markdown 형식 사용
- 이모지와 시각적 구분 활용
- 차트: [████████░░] 80% 형식
- 한국어, 전문적이고 설득력 있는 톤
- 총 1500자 이상 상세 분석
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `분석 리포트를 생성하는 중 오류가 발생했습니다. API 키를 확인하거나 나중에 다시 시도해주세요.\n\n오류: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};

// 하위 호환성 함수
export const generateMonthlyFeedback = async (
  monthlyData: DailyData[],
  periodName: string = "Monthly"
) => {
  return generateFeedback(monthlyData, "monthly");
};

export const generateWeeklyFeedback = async (weeklyData: DailyData[]) => {
  return generateFeedback(weeklyData, "weekly");
};
