
import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { DailyData, TaskType } from '../types';
import {
  Flame, TrendingUp, CheckCircle2, Sparkles,
  Loader2, RefreshCw, X, Sunrise, Moon, Award
} from 'lucide-react';

interface DashboardProps {
  data: DailyData[];
  viewMode: 'weekly' | 'monthly';
  reportFeedback: string | null;
  isLoadingFeedback: boolean;
  onGenerateReport: () => void;
  onCloseReport: () => void;
}

const CATEGORY_META = [
  { type: TaskType.PRIORITY, name: 'Priority', color: '#6366f1' },
  { type: TaskType.GOAL,     name: 'Goal',     color: '#f97316' },
  { type: TaskType.SCHEDULE, name: 'Schedule', color: '#06b6d4' },
  { type: TaskType.ROUTINE,  name: 'Routine',  color: '#10b981' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-xs">
      <p className="font-black mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color || '#a5b4fc' }} className="font-bold">
          {entry.name}: {entry.value}{entry.name === '완료율' ? '%' : '건'}
        </p>
      ))}
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  viewMode,
  reportFeedback,
  isLoadingFeedback,
  onGenerateReport,
  onCloseReport,
}) => {
  const stats = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

    // Per-day stats
    const dailyStats = sorted.map(day => {
      const total = day.tasks.length;
      const completed = day.tasks.filter(t => t.completed).length;
      return {
        date: day.date.slice(5).replace('-', '/'),
        fullDate: day.date,
        total,
        completed,
        incomplete: total - completed,
        rate: total === 0 ? 0 : Math.round((completed / total) * 100),
      };
    });

    // Weekly aggregation for monthly view
    const weeklyStats: { label: string; total: number; completed: number; incomplete: number; rate: number }[] = [];
    for (let i = 0; i < dailyStats.length; i += 7) {
      const chunk = dailyStats.slice(i, i + 7);
      const total = chunk.reduce((s, d) => s + d.total, 0);
      const completed = chunk.reduce((s, d) => s + d.completed, 0);
      weeklyStats.push({
        label: `W${Math.floor(i / 7) + 1}`,
        total,
        completed,
        incomplete: total - completed,
        rate: total === 0 ? 0 : Math.round((completed / total) * 100),
      });
    }

    // Category breakdown
    const allTasks = sorted.flatMap(d => d.tasks);
    const categoryStats = CATEGORY_META.map(cat => ({
      name: cat.name,
      color: cat.color,
      total: allTasks.filter(t => t.type === cat.type).length,
      completed: allTasks.filter(t => t.type === cat.type && t.completed).length,
      value: allTasks.filter(t => t.type === cat.type).length,
    })).filter(c => c.total > 0);

    // KPIs
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.completed).length;
    const avgRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const bestDay = dailyStats.length
      ? dailyStats.reduce((best, d) => (d.rate > best.rate ? d : best), dailyStats[0])
      : { rate: 0, date: '-' };

    // Consecutive days with ≥50% completion (from most recent)
    let streak = 0;
    for (let i = dailyStats.length - 1; i >= 0; i--) {
      if (dailyStats[i].rate >= 50) streak++;
      else break;
    }

    // Routine adherence
    const wakeAdherence = sorted.length === 0 ? 0
      : Math.round((sorted.filter(d => d.wakeRoutine?.completed).length / sorted.length) * 100);
    const sleepAdherence = sorted.length === 0 ? 0
      : Math.round((sorted.filter(d => d.sleepRoutine?.completed).length / sorted.length) * 100);

    return {
      dailyStats,
      weeklyStats,
      categoryStats,
      totalTasks,
      completedTasks,
      avgRate,
      bestDay,
      streak,
      wakeAdherence,
      sleepAdherence,
    };
  }, [data]);

  // Chart data source: daily for weekly view, weekly aggregated for monthly
  const barData = viewMode === 'monthly'
    ? stats.weeklyStats.map(w => ({ ...w, date: w.label, '완료율': w.rate, '완료': w.completed, '미완료': w.incomplete }))
    : stats.dailyStats.map(d => ({ ...d, '완료율': d.rate, '완료': d.completed, '미완료': d.incomplete }));

  const areaData = stats.dailyStats.map(d => ({ ...d, '완료율': d.rate }));

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-6">
        <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center">
          <TrendingUp className="text-indigo-300" size={40} />
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">기록 없음</h3>
          <p className="text-slate-400 text-sm mt-2 font-bold">이 기간에 저장된 데이터가 없습니다.</p>
          <p className="text-slate-300 text-xs mt-1">Daily 뷰에서 할 일을 추가하면 여기서 분석됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-[1.5rem] shadow-lg border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Tasks</p>
          <p className="text-3xl font-black text-slate-900">{stats.totalTasks}</p>
          <p className="text-[10px] text-emerald-500 font-bold mt-1">{stats.completedTasks}건 완료</p>
        </div>

        <div className="bg-indigo-600 p-5 rounded-[1.5rem] shadow-lg shadow-indigo-500/25">
          <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-2">Avg Completion</p>
          <p className="text-3xl font-black text-white">{stats.avgRate}%</p>
          <div className="mt-2 bg-indigo-500/40 rounded-full h-1.5">
            <div className="bg-white rounded-full h-1.5 transition-all duration-700" style={{ width: `${stats.avgRate}%` }} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-[1.5rem] shadow-lg border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Best Day</p>
          <p className="text-3xl font-black text-emerald-500">{stats.bestDay.rate}%</p>
          <p className="text-[10px] text-slate-400 font-bold mt-1">{stats.bestDay.date}</p>
        </div>

        <div className="bg-slate-900 p-5 rounded-[1.5rem] shadow-lg">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Streak</p>
          <div className="flex items-center gap-2">
            <Flame className="text-orange-400" size={26} />
            <p className="text-3xl font-black text-white">{stats.streak}</p>
          </div>
          <p className="text-[10px] text-slate-500 font-bold mt-1">연속 달성일</p>
        </div>
      </div>

      {/* ── Completion Rate Bar Chart ── */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-lg border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
            {viewMode === 'weekly' ? '7일 완료율' : '주간 완료율'}
          </h3>
          <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
            {viewMode === 'weekly' ? 'Daily' : 'Weekly Avg'}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} barSize={viewMode === 'weekly' ? 36 : 24} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="완료율" radius={[8, 8, 0, 0]}>
              {barData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry['완료율'] >= 80 ? '#10b981'
                    : entry['완료율'] >= 50 ? '#6366f1'
                    : '#e2e8f0'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Task Volume + Category Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Stacked bar: completed vs incomplete */}
        <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6">업무량 분포</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barSize={viewMode === 'weekly' ? 30 : 18} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="완료" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
              <Bar dataKey="미완료" stackId="a" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie: category breakdown */}
        <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6">카테고리 분석</h3>
          {stats.categoryStats.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.categoryStats}
                      cx="50%" cy="50%"
                      innerRadius={42} outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      startAngle={90} endAngle={-270}
                    >
                      {stats.categoryStats.map((entry, i) => (
                        <Cell key={i} fill={entry.color} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v}건`, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {stats.categoryStats.map((cat, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-[10px] font-black text-slate-600 uppercase">{cat.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-900">
                        {cat.completed}/{cat.total}
                        <span className="text-slate-400 font-bold ml-1">
                          ({cat.total === 0 ? 0 : Math.round((cat.completed / cat.total) * 100)}%)
                        </span>
                      </span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-1">
                      <div
                        className="rounded-full h-1 transition-all duration-700"
                        style={{
                          width: `${cat.total === 0 ? 0 : Math.round((cat.completed / cat.total) * 100)}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-slate-300">
              <p className="text-xs font-bold">태스크 없음</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 30-Day Area Trend (monthly only) ── */}
      {viewMode === 'monthly' && (
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-lg border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">30일 완료율 트렌드</h3>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Daily Trend</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={areaData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 8, fill: '#94a3b8' }}
                axisLine={false} tickLine={false}
                interval={4}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="완료율"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#rateGradient)"
                dot={false}
                activeDot={{ r: 5, fill: '#6366f1' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Routine Adherence ── */}
      <div className="bg-slate-900 p-6 md:p-8 rounded-[2rem] shadow-lg">
        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-6">루틴 달성률</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sunrise size={16} className="text-indigo-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wake Routine</span>
              </div>
              <span className="text-sm font-black text-white">{stats.wakeAdherence}%</span>
            </div>
            <div className="bg-slate-800 rounded-full h-2">
              <div
                className="bg-indigo-500 rounded-full h-2 transition-all duration-700"
                style={{ width: `${stats.wakeAdherence}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-600 font-bold mt-1.5 uppercase">
              {data.filter(d => d.wakeRoutine?.completed).length}/{data.length}일 완료
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Moon size={16} className="text-emerald-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sleep Routine</span>
              </div>
              <span className="text-sm font-black text-white">{stats.sleepAdherence}%</span>
            </div>
            <div className="bg-slate-800 rounded-full h-2">
              <div
                className="bg-emerald-500 rounded-full h-2 transition-all duration-700"
                style={{ width: `${stats.sleepAdherence}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-600 font-bold mt-1.5 uppercase">
              {data.filter(d => d.sleepRoutine?.completed).length}/{data.length}일 완료
            </p>
          </div>
        </div>
      </div>

      {/* ── Activity Heatmap (monthly only) ── */}
      {viewMode === 'monthly' && (
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-lg border border-slate-100">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6">활동 히트맵</h3>
          <div className="grid grid-cols-7 gap-1.5 mb-3">
            {['월', '화', '수', '목', '금', '토', '일'].map(d => (
              <div key={d} className="text-center text-[9px] font-black text-slate-400 pb-1">{d}</div>
            ))}
            {Array.from({ length: 30 }).map((_, i) => {
              const dayData = stats.dailyStats[i];
              const rate = dayData?.rate ?? 0;
              const hasTasks = (dayData?.total ?? 0) > 0;
              const bg = !hasTasks
                ? 'bg-slate-100'
                : rate < 30 ? 'bg-red-200'
                : rate < 60 ? 'bg-indigo-200'
                : rate < 85 ? 'bg-indigo-500'
                : 'bg-emerald-500';
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-lg ${bg} flex items-center justify-center group relative cursor-default transition-transform hover:scale-110`}
                  title={dayData ? `${dayData.date}: ${rate}% (${dayData.completed}/${dayData.total})` : '데이터 없음'}
                >
                  <span className="text-[7px] font-black text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {rate > 0 ? `${rate}%` : ''}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 justify-end mt-3">
            <span className="text-[8px] text-slate-400 font-bold">낮음</span>
            {['bg-slate-100', 'bg-red-200', 'bg-indigo-200', 'bg-indigo-500', 'bg-emerald-500'].map((c, i) => (
              <div key={i} className={`w-3.5 h-3.5 rounded ${c}`} />
            ))}
            <span className="text-[8px] text-slate-400 font-bold">높음</span>
          </div>
        </div>
      )}

      {/* ── AI Report Section ── */}
      <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden">
        {reportFeedback ? (
          <div className="p-6 md:p-10">
            <div className="flex items-start justify-between mb-8 border-b border-slate-100 pb-6 gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Sparkles className="text-indigo-600" size={16} />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">AI 성과 분석 리포트</h3>
                </div>
                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.3em] pl-11">
                  Gemini AI · {viewMode === 'weekly' ? '주간' : '월간'} Matrix Analysis
                </p>
              </div>
              <button onClick={onCloseReport} className="text-slate-300 hover:text-slate-700 transition-colors shrink-0 mt-1">
                <X size={22} />
              </button>
            </div>
            <div className="prose prose-slate max-w-none whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
              {reportFeedback}
            </div>
            <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
              <button
                onClick={onGenerateReport}
                className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all active:scale-95 shadow-lg"
              >
                <RefreshCw size={14} /> 재생성
              </button>
            </div>
          </div>
        ) : (
          <div className="p-7 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
                <Sparkles className="text-indigo-600" size={22} />
              </div>
              <div>
                <p className="font-black text-slate-900 text-sm">AI 성과 분석 리포트</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                  Gemini AI가 업무 패턴·루틴·생산성 병목을 분석합니다
                </p>
              </div>
            </div>
            <button
              onClick={onGenerateReport}
              disabled={isLoadingFeedback}
              className="shrink-0 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:bg-slate-200 disabled:shadow-none active:scale-95 flex items-center gap-3"
            >
              {isLoadingFeedback ? (
                <><Loader2 className="animate-spin" size={16} /> 분석 중...</>
              ) : (
                <><Sparkles size={16} /> 리포트 생성</>
              )}
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
