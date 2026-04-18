
import React, { useState, useMemo } from 'react';
import { Zap, Target, Sunrise, Moon, ChevronRight, Check } from 'lucide-react';
import { RoutineConfig, LifeGoalMatrix } from '../types';
import { completeOnboarding } from '../services/firestoreService';

interface Props {
  uid: string;
  email: string;
  onComplete: () => void;
}

type Step = 'age' | 'goal' | 'wake' | 'sleep';

const STEPS: Step[] = ['age', 'goal', 'wake', 'sleep'];

const GOAL_PLACEHOLDERS_TEEN = [
  "예) 2026년 수능에서 수학 1등급을 받아 연세대 경영학과에 입학한다",
  "예) 이번 기말고사에서 전 과목 평균 90점 이상을 받아 장학금을 받는다",
  "예) 2025년 내신 1등급을 유지해 원하는 특기자 전형으로 SKY 대학에 합격한다",
  "예) 매일 3시간 집중 학습으로 모의고사 성적을 3개월 안에 두 등급 올린다",
  "예) 영어·수학 취약 단원을 완전히 정복해 2학기 중간고사에서 반 1등을 달성한다",
];

const GOAL_PLACEHOLDERS_ADULT = [
  "예) 2032년까지 순자산 100억 원을 달성하여, 배우자와 매달 수익의 20%를 사회에 기부하며 여유롭게 살아가는 자산가",
  "예) 2027년까지 체지방률 15%를 유지하고, 자녀와 함께 제주도 철인 3종 경기를 완주하는 강인한 부모",
  "예) 2030년까지 근교에 부모님과 온 가족이 함께 거주할 수 있는 3층 규모의 단독 주택을 완공하여 입주하기",
  "예) 2029년까지 매년 1개국씩 총 10개국에서 가족과 한 달 살기를 실천하며 여행 에세이를 출간하는 작가",
  "예) 2033년까지 개인 브랜드로 연 매출 10억 원을 달성하고, 사랑하는 가족과 매년 전 세계 휴양지 5곳을 비즈니스석으로 여행하는 가장",
];

const randomPick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export const OnboardingModal: React.FC<Props> = ({ uid, email, onComplete }) => {
  const [step, setStep]     = useState<Step>('age');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const [age, setAge] = useState('');

  const goalPlaceholder = useMemo(
    () => Number(age) <= 19
      ? randomPick(GOAL_PLACEHOLDERS_TEEN)
      : randomPick(GOAL_PLACEHOLDERS_ADULT),
    [age]
  );

  const [goalText,        setGoalText]        = useState('');
  const [wakeTime,        setWakeTime]        = useState('07:00');
  const [wakeActivities,  setWakeActivities]  = useState('');
  const [sleepTime,       setSleepTime]       = useState('22:30');
  const [sleepActivities, setSleepActivities] = useState('');

  const stepIndex = STEPS.indexOf(step);

  const next = () => {
    if (step === 'age')   { setStep('goal');  return; }
    if (step === 'goal')  { setStep('wake');  return; }
    if (step === 'wake')  { setStep('sleep'); return; }
  };

  const handleComplete = async () => {
    setSaving(true);
    setError('');
    try {
      const wakeRoutine:    RoutineConfig  = { time: wakeTime,  activities: wakeActivities };
      const sleepRoutine:   RoutineConfig  = { time: sleepTime, activities: sleepActivities };
      const lifeGoalMatrix: LifeGoalMatrix = { text: goalText };
      await completeOnboarding(uid, wakeRoutine, sleepRoutine, lifeGoalMatrix);
      onComplete();
    } catch (e: any) {
      console.error('온보딩 저장 실패:', e);
      setError('저장에 실패했습니다. Firestore 보안 규칙을 확인하거나 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const canNext = () => {
    if (step === 'age')   return age.trim().length > 0 && Number(age) >= 1 && Number(age) <= 100;
    if (step === 'goal')  return goalText.trim().length > 0;
    if (step === 'wake')  return wakeActivities.trim().length > 0;
    return sleepActivities.trim().length > 0;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900 overflow-y-auto">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden">
        {/* Top bar */}
        <div className="bg-[#0F172A] px-8 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-600 w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Zap size={20} className="text-white fill-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg uppercase tracking-tight">Peak Setup</h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{email}</p>
            </div>
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-black transition-all ${
                    i < stepIndex
                      ? 'bg-emerald-500 text-white'
                      : i === stepIndex
                      ? 'bg-indigo-500 text-white ring-2 ring-indigo-400/40'
                      : 'bg-white/10 text-slate-500'
                  }`}
                >
                  {i < stepIndex ? <Check size={12} /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full transition-all ${i < stepIndex ? 'bg-emerald-500' : 'bg-white/10'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {step === 'age' && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <span className="text-indigo-500 text-lg font-black">🎂</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">나이를 알려주세요</h3>
                  <p className="text-slate-400 text-xs font-bold mt-0.5">나에게 맞는 목표 예시를 보여드릴게요</p>
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={100}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                placeholder="예) 17"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </>
          )}

          {step === 'goal' && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center">
                  <Target size={20} className="text-orange-500" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Life Goal Matrix</h3>
                  <p className="text-slate-400 text-xs font-bold mt-0.5">나의 최종 목표를 한 문장으로</p>
                </div>
              </div>
              <textarea
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-slate-300 leading-relaxed"
                rows={4}
                placeholder={goalPlaceholder}
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
              />
            </>
          )}

          {step === 'wake' && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <Sunrise size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Wake Routine</h3>
                  <p className="text-slate-400 text-xs font-bold mt-0.5">기상 시간과 아침 루틴 활동</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">기상 시간</label>
                  <input
                    type="time"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:border-indigo-500 outline-none transition-all"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">루틴 활동 <span className="text-slate-300">(쉼표로 구분)</span></label>
                  <textarea
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-slate-300 leading-relaxed"
                    rows={3}
                    placeholder="예) 물 한잔, 양치질, 롱블랙, 잠자리 정리"
                    value={wakeActivities}
                    onChange={(e) => setWakeActivities(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {step === 'sleep' && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-800 rounded-2xl flex items-center justify-center">
                  <Moon size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Sleep Routine</h3>
                  <p className="text-slate-400 text-xs font-bold mt-0.5">취침 시간과 저녁 루틴 활동</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">취침 시간</label>
                  <input
                    type="time"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:border-indigo-500 outline-none transition-all"
                    value={sleepTime}
                    onChange={(e) => setSleepTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">루틴 활동 <span className="text-slate-300">(쉼표로 구분)</span></label>
                  <textarea
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-slate-300 leading-relaxed"
                    rows={3}
                    placeholder="예) 약 챙겨 먹기, 푸쉬업 40개, 10분 명상"
                    value={sleepActivities}
                    onChange={(e) => setSleepActivities(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Error message */}
          {error && (
            <p className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 px-4 py-3 rounded-2xl">{error}</p>
          )}

          {/* Action button */}
          {step !== 'sleep' ? (
            <button
              onClick={next}
              disabled={!canNext()}
              className="w-full bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              다음 <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={!canNext() || saving}
              className="w-full bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {saving ? '저장 중...' : '시작하기 →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
