import { DailyData } from "../types";

/**
 * Google Gemini API (Fetch)를 통한 성과 분석 리포트 생성 (Weekly / Monthly)
 * 브라우저 환경에서 직접 작동
 *
 * 사용 방법:
 * const report = await generateFeedback(weeklyData, "weekly");
 */

export const generateFeedback = async (
  periodData: DailyData[],
  periodType: "weekly" | "monthly" = "monthly"
): Promise<string> => {
  // API 키 — Cloudflare Pages 환경변수에서 주입 (절대 코드에 직접 넣지 마세요)
  const apiKey =
    (typeof __GEMINI_API_KEY__ !== 'undefined' && __GEMINI_API_KEY__) ||
    import.meta.env?.VITE_GEMINI_API_KEY ||
    '';


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
당신은 세계 최고의 생산성 코치이자 성과 분석 전문가입니다.
사용자의 업무 데이터를 깊이 있게 분석하여 전문적이고 영감을 주는 PeakDone 성과 리포트를 작성합니다.

[📊 분석 데이터]
- 기간: ${periodName} (${periodData.length}일)
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

[상세 업무 로그]
${JSON.stringify(tasksByDate, null, 2)}

[📋 리포트 작성 요청사항]

이하 내용을 포함하여 1500자 이상의 상세 분석 리포트를 작성해주세요:

1. **💪 성과 요약** (250자)
   - 이번 ${periodName} 완성율을 평가
   - 가장 높은 생산성을 보인 날 분석
   - 지연 업무 발생 패턴

2. **📈 강점 & 약점 분석** (400자)
   - 사용자가 가장 잘하는 업무 유형 3가지
   - 개선이 필요한 영역 3가지
   - 각각에 대한 데이터 기반 인사이트

3. **⚡ 성과 향상 전략** (350자)
   다음 ${periodName}에 즉시 적용 가능한 3가지 구체적 전략:
   - 시간 배치 전략
   - 우선순위 재정렬 방안
   - 집중력 유지 팁

4. **🎯 황금 시간대 & 최적 업무 배치** (250자)
   - 당신의 최고 생산성 시간대는?
   - 이 시간에 우선순위가 높은 업무를 배치하는 구체적 방법

5. **🏆 종합 코칭 코멘트** (150자)
   - 긍정적 독려
   - 다음 목표 제시
   - 5줄 이내 영감주는 메시지

[📝 출력 형식]
- Markdown 형식 사용
- 이모지와 시각적 구분 활용 (# ##, **굵게** 등)
- 차트: [████████░░] 80% 형식
- 전문적이고 설득력 있는, 따뜻한 톤
`;

  try {
    console.log("🚀 Gemini API 호출 시작...");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Gemini API 에러:", response.status, errorData);
      throw new Error(
        `Gemini API 오류 (${response.status}):\n${
          errorData.error?.message || JSON.stringify(errorData)
        }`
      );
    }

    const data = await response.json();
    console.log("✅ Gemini API 응답 성공");

    // Gemini 응답에서 텍스트 추출
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error("Gemini API 응답에서 텍스트를 찾을 수 없습니다.");
    }

    return responseText;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ 리포트 생성 중 오류:", msg);
    throw error; // 원본 에러를 그대로 전달 (App.tsx에서 메시지 표시)
  }
};

// 호환성 함수 — periodName이 "주간"이면 weekly, 나머지는 monthly
export const generateMonthlyFeedback = async (
  data: DailyData[],
  periodName?: string
) => {
  const type = periodName === "주간" ? "weekly" : "monthly";
  return generateFeedback(data, type);
};

export const generateWeeklyFeedback = async (weeklyData: DailyData[]) => {
  return generateFeedback(weeklyData, "weekly");
};
