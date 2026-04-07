
import { GoogleGenAI } from "@google/genai";
import { DailyData } from "../types";

export const generateMonthlyFeedback = async (monthlyData: DailyData[], periodName: string = "Monthly") => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 데이터 요약 계산
  const totalTasks = monthlyData.reduce((acc, day) => acc + day.tasks.length, 0);
  const completedTasks = monthlyData.reduce((acc, day) => acc + day.tasks.filter(t => t.completed).length, 0);
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // 날짜별 업무 요약 (Gemini 전달용)
  const tasksByDate = monthlyData.map(day => ({
    date: day.date,
    items: day.tasks.map(t => ({
      content: t.content,
      completed: t.completed,
      type: t.type
    }))
  }));

  const prompt = `
    당신은 세계 최고의 비즈니스 생산성 코치이자 영양 전문 코치입니다. 사용자의 ${periodName} 업무 데이터를 깊이 있게 분석하여 전문적인 Peak Done 리포트를 작성하세요.
    
    [데이터셋]
    - 분석 기간: ${periodName} (${monthlyData.length}일간의 데이터)
    - 전체 업무: ${totalTasks}건
    - 완료 업무: ${completedTasks}건 (완성율: ${completionRate}%)
    - 상세 로그: ${JSON.stringify(tasksByDate)}

    [리포트 구성 요청 사항]
    1. **업무 성격 및 특징 분류**: 업무 내용을 분석하여 [전략기획, 운영관리, 루틴/건강, 자기계발, 행정] 등으로 자동 분류하고, 각 카테고리별 성취도를 요약하세요.
    2. **생산성 패턴 분석**: 완성율과 업무 분포를 바탕으로 사용자의 생산성 강점과 약점을 데이터 기반으로 추론하세요.
    3. **식단 및 칼로리 케어**: 업무 내용 중 음식, 식사, 메뉴와 관련된 키워드가 있다면 해당 식단의 대략적인 칼로리를 계산하고, Peak Performance를 위한 식단 조언을 포함하세요. (음식 키워드가 없더라도 일반적인 권장 식단을 간략히 제공)
    4. **종합 코치 코멘트**: 사용자를 독려하면서도 다음 기간에 적용할 수 있는 구체적인 전략 3가지를 제시하세요.

    [출력 가이드]
    - Markdown 형식을 사용하여 시각적으로 구조화된 리포트를 작성하세요.
    - 직관적인 이모지와 텍스트 기반 차트(예: [====---] 60%)를 활용하세요.
    - 언어: 한국어.
    - 톤: 설득력 있고 전문적인 비즈니스 코칭 톤.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 16000 }
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "분석 리포트를 생성하는 중 오류가 발생했습니다. API 키를 확인하거나 나중에 다시 시도해주세요.";
  }
};
