import Anthropic from "@anthropic-ai/sdk";
import { DailyData } from "../types";

/**
 * Claude API를 통한 성과 분석 리포트 생성 (Weekly / Monthly)
 *
 * 사용 방법:
 * const report = await generateFeedback(weeklyData, "weekly");
 */

export const generateFeedback = async (
  periodData: DailyData[],
  periodType: "weekly" | "monthly" = "monthly"
): Promise<string> => {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "❌ Claude API 키가 설정되지 않았습니다.\n" +
      "해결 방법:\n" +
      "1. Claude API 키 발급: https://console.anthropic.com/\n" +
      "2. .env.local 파일에 VITE_CLAUDE_API_KEY=YOUR_API_KEY 추가\n" +
      "3. 개발 서버 재시작: npm run dev"
    );
  }

  const client = new Anthropic({ apiKey });
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

  const systemPrompt = `당신은 세계 최고의 생산성 코치이자 성과 분석 전문가입니다.
사용자의 업무 데이터를 깊이 있게 분석하여 전문적이고 영감을 주는 PeakDone 성과 리포트를 작성합니다.

리포트 언어: 한국어
톤: 전문적이면서도 따뜻하고 동기부여적
목표: 사용자가 다음 기간에 실행할 수 있는 구체적인 개선 전략 제시`;

  const userPrompt = `
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
    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    // Claude 응답 추출
    const responseText = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as any).text)
      .join("\n");

    return responseText;
  } catch (error) {
    console.error("Claude API Error:", error);
    throw new Error(
      `분석 리포트 생성 중 오류가 발생했습니다.\n\n` +
      `오류: ${error instanceof Error ? error.message : "Unknown error"}\n\n` +
      `해결 방법:\n` +
      `1. API 키가 올바른지 확인\n` +
      `2. Claude API 할당량 확인: https://console.anthropic.com/\n` +
      `3. 개발자 콘솔에서 상세 오류 메시지 확인`
    );
  }
};

// 호환성 함수
export const generateMonthlyFeedback = async (
  monthlyData: DailyData[],
  _periodName?: string
) => {
  return generateFeedback(monthlyData, "monthly");
};

export const generateWeeklyFeedback = async (weeklyData: DailyData[]) => {
  return generateFeedback(weeklyData, "weekly");
};
