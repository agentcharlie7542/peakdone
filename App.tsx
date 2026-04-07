
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User as FBUser, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './services/firebase';
import {
  getUserProfile, createUserProfile, subscribeToUserProfile,
  subscribeToDailyData, getDailyData, persistDailyData,
  migrateFromLocalStorage,
} from './services/firestoreService';
import { Layout }           from './components/Layout';
import { Dashboard }        from './components/Dashboard';
import { OnboardingModal }  from './components/OnboardingModal';
import { Task, TaskType, DailyData, UserProfile } from './types';
import { TIME_SLOTS }       from './constants';
import { generateMonthlyFeedback } from './services/geminiService';
import {
  CheckCircle2, Circle, ChevronLeft, ChevronRight, Clock,
  Plus, Trash2, TrendingUp, LayoutDashboard, Zap, Target,
  Loader2, Smartphone, Monitor, Sunrise, Moon, LogOut,
  Lock, Mail, Cloud, Wifi, BarChart3, Edit2,
} from 'lucide-react';

type ViewMode = 'daily' | 'weekly' | 'monthly';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = () => new Date().toLocaleDateString('sv').split('T')[0];

const emptyDay = (date: string): DailyData => ({
  date,
  tasks: [],
  wakeCompleted: false,
  sleepCompleted: false,
  updatedAt: 0,
});

// ─── App ──────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  // Firebase auth
  const [firebaseUser,  setFirebaseUser]  = useState<FBUser | null | undefined>(undefined); // undefined = initializing
  const [userProfile,   setUserProfile]   = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // App data
  const [currentDate, setCurrentDate] = useState(today);
  const [dailyData,   setDailyData]   = useState<DailyData | null>(null);
  const [dataCache,   setDataCache]   = useState<Record<string, DailyData>>({});
  const [viewMode,    setViewMode]    = useState<ViewMode>('daily');

  // Report
  const [reportFeedback,    setReportFeedback]    = useState<string | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  // UI
  const [isSyncing,     setIsSyncing]     = useState(false);
  const [authEmail,     setAuthEmail]     = useState('');
  const [authPassword,  setAuthPassword]  = useState('');
  const [authError,     setAuthError]     = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // ── 1. Firebase Auth 상태 감지 ────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        try {
          // 프로필 로드 또는 신규 생성
          let profile = await getUserProfile(fbUser.uid);
          if (!profile) {
            profile = await createUserProfile(fbUser.uid, fbUser.email!);
          }
          // localStorage 마이그레이션 (기존 데이터가 있을 경우)
          await migrateFromLocalStorage(fbUser.uid, fbUser.email!);
          setUserProfile(profile);
        } catch (e) {
          console.error('프로필 로드 실패:', e);
          // 실패해도 앱이 멈추지 않도록 빈 프로필로 진행
          setUserProfile(null);
        } finally {
          setProfileLoaded(true);
        }
      } else {
        setFirebaseUser(null);
        setUserProfile(null);
        setDailyData(null);
        setDataCache({});
        setProfileLoaded(true);
      }
    });
    return unsubscribe;
  }, []);

  // ── 2. 프로필 실시간 구독 (다른 기기에서 루틴/목표 변경 시 반영) ─────────

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubscribe = subscribeToUserProfile(firebaseUser.uid, (profile) => {
      if (profile) setUserProfile(profile);
    });
    return unsubscribe;
  }, [firebaseUser?.uid]);

  // ── 3. 날짜별 데이터 실시간 구독 (onSnapshot) ────────────────────────────

  useEffect(() => {
    if (!firebaseUser || !userProfile?.isOnboarded) return;

    setDailyData(null); // 날짜 전환 시 로딩 표시

    const unsubscribe = subscribeToDailyData(firebaseUser.uid, currentDate, (data) => {
      const resolved = data ?? emptyDay(currentDate);
      setDailyData(resolved);
      setDataCache((prev) => ({ ...prev, [currentDate]: resolved }));
    });

    return unsubscribe;
  }, [firebaseUser?.uid, currentDate, userProfile?.isOnboarded]);

  // ── 4. 주간/월간 뷰에 필요한 과거 날짜 데이터 패치 ──────────────────────

  useEffect(() => {
    if (!firebaseUser) return;
    const days = viewMode === 'monthly' ? 30 : 7;
    const dates: string[] = [];
    const base = new Date(currentDate);
    for (let i = 1; i < days; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      dates.push(d.toLocaleDateString('sv').split('T')[0]);
    }
    const missing = dates.filter((d) => !dataCache[d]);
    if (!missing.length) return;

    Promise.all(missing.map((d) => getDailyData(firebaseUser.uid, d))).then((results) => {
      const updates: Record<string, DailyData> = {};
      missing.forEach((d, i) => { if (results[i]) updates[d] = results[i]!; });
      setDataCache((prev) => ({ ...prev, ...updates }));
    });
  }, [currentDate, viewMode, firebaseUser?.uid]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!authEmail.includes('@') || authPassword.length < 6) {
      setAuthError('올바른 이메일과 6자 이상의 비밀번호를 입력해주세요.');
      return;
    }
    setIsAuthLoading(true);
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
      // onAuthStateChanged가 이후 처리
    } catch (e: any) {
      // 계정이 없으면 신규 등록 시도
      if (['auth/user-not-found', 'auth/invalid-credential', 'auth/wrong-password'].includes(e.code)) {
        try {
          await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        } catch (regError: any) {
          if (regError.code === 'auth/email-already-in-use') {
            setAuthError('비밀번호가 올바르지 않습니다.');
          } else if (regError.code === 'auth/weak-password') {
            setAuthError('비밀번호는 6자 이상이어야 합니다.');
          } else {
            setAuthError('로그인에 실패했습니다. 다시 시도해주세요.');
          }
        }
      } else {
        setAuthError('로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // onAuthStateChanged가 이후 처리
    } catch (e: any) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setAuthError('Google 로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('안전하게 로그아웃 하시겠습니까?')) {
      await signOut(auth);
    }
  };

  // ── 데이터 저장 (Firestore write + Optimistic UI) ────────────────────────

  const saveDailyData = useCallback(async (data: DailyData) => {
    if (!firebaseUser) return;
    const updated = { ...data, updatedAt: Date.now() };
    setDailyData(updated);
    setDataCache((prev) => ({ ...prev, [data.date]: updated }));
    setIsSyncing(true);
    try {
      await persistDailyData(firebaseUser.uid, updated);
    } finally {
      setIsSyncing(false);
    }
  }, [firebaseUser]);

  // ── Task 핸들러 ───────────────────────────────────────────────────────────

  const updateTaskStatus = (taskId: string) => {
    if (!dailyData) return;
    saveDailyData({
      ...dailyData,
      tasks: dailyData.tasks.map((t) => t.id === taskId ? { ...t, completed: !t.completed } : t),
    });
  };

  const addTask = (type: TaskType, slot?: string) => {
    if (!dailyData) return;
    const content = prompt('할 일을 입력하세요:');
    if (!content) return;
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      content, type, timeSlot: slot, completed: false,
      date: dailyData.date, originalDate: dailyData.date, delayDays: 0, isArchived: false,
    };
    saveDailyData({ ...dailyData, tasks: [...dailyData.tasks, newTask] });
  };

  const deleteTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dailyData) return;
    saveDailyData({ ...dailyData, tasks: dailyData.tasks.filter((t) => t.id !== taskId) });
  };

  const handleRoutineToggle = (type: 'wake' | 'sleep') => {
    if (!dailyData) return;
    saveDailyData(
      type === 'wake'
        ? { ...dailyData, wakeCompleted: !dailyData.wakeCompleted }
        : { ...dailyData, sleepCompleted: !dailyData.sleepCompleted },
    );
  };

  // ── Derived data for charts ───────────────────────────────────────────────

  const efficiencyData = useMemo(() => {
    const stats = [];
    const base = new Date(currentDate);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const dateStr = d.toLocaleDateString('sv').split('T')[0];
      const day = dateStr === currentDate ? dailyData : (dataCache[dateStr] ?? null);
      if (day) {
        const total     = day.tasks.length;
        const completed = day.tasks.filter((t) => t.completed).length;
        stats.push({
          date:    dateStr.split('-').slice(1).join('/'),
          percent: total === 0 ? 0 : Math.round((completed / total) * 100),
          total,
        });
      } else {
        stats.push({ date: dateStr.split('-').slice(1).join('/'), percent: 0, total: 0 });
      }
    }
    return stats;
  }, [dailyData, currentDate, dataCache]);

  const dashboardData = useMemo((): DailyData[] => {
    if (viewMode === 'daily') return [];
    const days   = viewMode === 'weekly' ? 7 : 30;
    const result: DailyData[] = [];
    const base   = new Date(currentDate);
    for (let i = 0; i < days; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const dateStr = d.toLocaleDateString('sv').split('T')[0];
      const day = dateStr === currentDate ? dailyData : (dataCache[dateStr] ?? null);
      if (day) result.push(day);
    }
    return result;
  }, [viewMode, currentDate, dailyData, dataCache]);

  // ── AI Report ─────────────────────────────────────────────────────────────

  const handleGenerateReport = async () => {
    setIsLoadingFeedback(true);
    setReportFeedback(null);
    try {
      const days = viewMode === 'weekly' ? 7 : 30;
      const dataSet = Object.values(dataCache)
        .filter(Boolean)
        .slice(0, days);
      const report = await generateMonthlyFeedback(dataSet as any, viewMode.toUpperCase());
      setReportFeedback(report);
    } catch {
      setReportFeedback('리포트 생성에 실패했습니다.');
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────────────────

  // Firebase 초기화 중
  if (firebaseUser === undefined || (firebaseUser && !profileLoaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-indigo-500 mx-auto" size={48} />
          <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">Connecting to Matrix...</p>
        </div>
      </div>
    );
  }

  // 로그인 화면
  if (!firebaseUser) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500 blur-[120px] rounded-full" />
        </div>
        <div className="bg-white w-full max-w-md rounded-[3rem] p-12 shadow-2xl relative z-10 text-center border border-white/20">
          <div className="bg-indigo-600 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/40 rotate-12">
            <Zap size={48} className="text-white fill-white" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-2">Matrix Access</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10">PeakDone V3 • Cloud Performance Identity</p>
          <div className="space-y-4 mb-4">
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input
                type="email" placeholder="Email Address"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300"
                value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input
                type="password" placeholder="Password (6자 이상)"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300"
                value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>
          {authError && (
            <p className="text-xs font-bold text-red-500 mb-4 bg-red-50 px-4 py-3 rounded-2xl text-left">{authError}</p>
          )}
          <button
            onClick={handleLogin} disabled={isAuthLoading}
            className="w-full bg-indigo-600 disabled:opacity-60 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {isAuthLoading ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
            {isAuthLoading ? 'Connecting...' : 'Connect to Matrix DB'}
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <button
            onClick={handleGoogleLogin} disabled={isAuthLoading}
            className="w-full bg-white border-2 border-slate-100 hover:border-slate-200 hover:shadow-md text-slate-700 py-4 rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google로 계속하기
          </button>

          <p className="mt-6 text-[9px] font-bold text-slate-300 uppercase leading-relaxed">
            계정이 없으면 자동으로 가입됩니다<br/>By connecting, you enable real-time cross-device sync
          </p>
        </div>
      </div>
    );
  }

  // 최초 로그인 온보딩
  if (!userProfile?.isOnboarded) {
    return (
      <OnboardingModal
        uid={firebaseUser.uid}
        email={firebaseUser.email!}
        onComplete={() => {/* subscribeToUserProfile가 자동 반영 */}}
      />
    );
  }

  // 데이터 로딩 중
  if (!dailyData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-indigo-500 mx-auto" size={48} />
          <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">Streaming from Cloud Matrix...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main App
  // ─────────────────────────────────────────────────────────────────────────

  const { wakeRoutine, sleepRoutine, lifeGoalMatrix } = userProfile;

  return (
    <Layout>
      {/* Header */}
      <header className="bg-[#0F172A] text-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl border border-indigo-500/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600/20 p-3 rounded-2xl">
              <Zap className="text-indigo-400" size={32} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase italic bg-gradient-to-r from-orange-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">PeakDone</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[8px] md:text-[10px] font-bold text-slate-400 tracking-[0.4em] uppercase">Matrix V3</p>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <Wifi size={10} className={`${isSyncing ? 'text-yellow-400' : 'text-emerald-400'}`} />
                  <span className={`text-[8px] font-black uppercase ${isSyncing ? 'text-yellow-400' : 'text-emerald-400'}`}>
                    {isSyncing ? 'Syncing...' : 'Live Sync'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-[9px] font-black text-slate-500 uppercase">Syncing as</span>
                <span className="text-[10px] font-black text-indigo-400">{firebaseUser.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-white/5 hover:bg-red-500/20 hover:border-red-500/30 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 text-slate-400 hover:text-red-400"
              >
                <LogOut size={14} /> LogOut
              </button>
              <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                <button
                  onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d.toLocaleDateString('sv').split('T')[0]); }}
                  className="hover:text-indigo-400 transition-colors"
                ><ChevronLeft size={20} /></button>
                <span className="font-mono text-sm md:text-lg font-black">{currentDate}</span>
                <button
                  onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d.toLocaleDateString('sv').split('T')[0]); }}
                  className="hover:text-indigo-400 transition-colors"
                ><ChevronRight size={20} /></button>
              </div>
            </div>

            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-full">
              {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((mode) => (
                <button
                  key={mode} onClick={() => setViewMode(mode)}
                  className={`flex-1 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === mode ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >{mode}</button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {viewMode === 'daily' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
          <div className="lg:col-span-5 space-y-8">
            {/* Performance Graph (7-day bar) */}
            <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden relative">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <BarChart3 className="text-indigo-600" size={18} /> Performance
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase">Real-time Reactive Matrix</span>
              </div>
              <div className="flex items-end justify-between h-48 gap-4 px-2">
                {efficiencyData.map((stat, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative">
                    <div className="flex flex-col items-center mb-1">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase transition-all ${stat.total > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {stat.total}T
                      </span>
                      <span className={`text-[10px] font-black mt-1 ${stat.percent >= 80 ? 'text-emerald-500' : stat.percent >= 40 ? 'text-indigo-500' : 'text-slate-300'}`}>
                        {stat.percent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-50 rounded-2xl relative overflow-hidden flex flex-col justify-end h-32 border border-slate-100/50 shadow-inner">
                      <div
                        className={`w-full transition-all duration-700 ease-out rounded-xl ${stat.percent === 100 ? 'bg-emerald-500' : 'bg-gradient-to-t from-indigo-600 to-indigo-400'}`}
                        style={{ height: `${stat.percent || 2}%` }}
                      />
                    </div>
                    <span className={`text-[8px] font-black uppercase tracking-wider ${i === 6 ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {stat.date}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Life Goal Matrix */}
            <section className="bg-slate-900 p-6 md:p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 blur-[80px] -mr-20 -mt-20" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-[8px] md:text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Life Goal Matrix</h3>
              </div>
              <p className="text-lg md:text-2xl font-black leading-snug italic text-indigo-50 relative z-10">
                "{lifeGoalMatrix.text || '목표를 설정하세요'}"
              </p>
            </section>

            {/* Priorities */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-3"><Clock className="text-indigo-600" /> Priorities</h3>
                <button onClick={() => addTask(TaskType.PRIORITY)} className="bg-indigo-600 text-white w-8 h-8 flex items-center justify-center rounded-lg font-black text-xs shadow-lg hover:bg-indigo-700 hover:scale-110 active:scale-90 transition-all">P</button>
              </div>
              {dailyData.tasks.filter((t) => t.type === TaskType.PRIORITY).map((task) => (
                <div key={task.id} onClick={() => updateTaskStatus(task.id)} className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-[1.5rem] hover:shadow-xl transition-all cursor-pointer group shadow-lg">
                  <div className="shrink-0">{task.completed ? <CheckCircle2 className="text-emerald-500" size={24} /> : <Circle className="text-slate-200" size={24} />}</div>
                  <div className="flex-1">
                    <p className={`font-black text-sm md:text-lg ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.content}</p>
                    {task.delayDays > 0 && <span className="text-[9px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-lg mt-1 inline-block uppercase">+{task.delayDays}d Delay</span>}
                  </div>
                  <button onClick={(e) => deleteTask(task.id, e)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18} /></button>
                </div>
              ))}
            </section>

            {/* Focus Goal */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-3"><Target className="text-orange-500" /> Focus Goal</h3>
                <button onClick={() => addTask(TaskType.GOAL)} className="bg-orange-500 text-white w-8 h-8 flex items-center justify-center rounded-lg font-black text-xs shadow-lg hover:bg-orange-600 hover:scale-110 active:scale-90 transition-all">G</button>
              </div>
              {dailyData.tasks.filter((t) => t.type === TaskType.GOAL).map((task) => (
                <div key={task.id} onClick={() => updateTaskStatus(task.id)} className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-[1.5rem] hover:shadow-xl transition-all cursor-pointer group shadow-lg">
                  <div className="shrink-0">{task.completed ? <CheckCircle2 className="text-emerald-500" size={24} /> : <Circle className="text-slate-200" size={24} />}</div>
                  <div className="flex-1">
                    <p className={`font-black text-sm md:text-lg ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.content}</p>
                  </div>
                  <button onClick={(e) => deleteTask(task.id, e)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18} /></button>
                </div>
              ))}
            </section>
          </div>

          {/* Time Box */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden h-fit lg:sticky lg:top-8">
              <div className="bg-[#0F172A] p-6 flex items-center justify-between">
                <h3 className="font-black text-white text-lg uppercase tracking-widest flex items-center gap-3"><LayoutDashboard className="text-indigo-400" /> Time Box</h3>
                <div className="flex gap-2 items-center">
                  <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{isSyncing ? 'Syncing...' : 'Live'}</span>
                </div>
              </div>

              <div className="divide-y divide-slate-50 max-h-[850px] overflow-y-auto scrollbar-hide bg-slate-50/20">
                {/* Wake Routine */}
                <div className="bg-indigo-50/50 p-6 border-b border-indigo-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sunrise size={20} className="text-indigo-600" />
                      <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em]">{wakeRoutine.time} Wake Routine</span>
                    </div>
                    <div
                      onClick={() => handleRoutineToggle('wake')}
                      className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${dailyData.wakeCompleted ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${dailyData.wakeCompleted ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>
                  <p className={`text-sm font-bold pl-7 ${dailyData.wakeCompleted ? 'text-indigo-700/50 line-through' : 'text-indigo-900'}`}>
                    {wakeRoutine.activities}
                  </p>
                </div>

                {/* Time Slots */}
                {TIME_SLOTS.map((slot) => {
                  const tasksForSlot = dailyData.tasks.filter((t) => t.timeSlot === slot);
                  return (
                    <div key={slot} className="flex min-h-[90px] group/slot transition-colors hover:bg-white">
                      <div className="w-20 shrink-0 p-4 text-[11px] font-black text-slate-400 border-r border-slate-50 flex items-center justify-center bg-white">{slot}</div>
                      <div className="flex-1 p-4">
                        <div className="flex flex-col gap-3">
                          {tasksForSlot.map((task) => (
                            <div
                              key={task.id} onClick={() => updateTaskStatus(task.id)}
                              className={`p-5 rounded-2xl border-2 flex items-center gap-4 cursor-pointer transition-all shadow-md group/item relative pr-12 ${task.completed ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-white border-slate-100 text-slate-900 hover:border-indigo-400 hover:-translate-y-1'}`}
                            >
                              <div className="shrink-0">{task.completed ? <CheckCircle2 size={22} className="text-emerald-500" /> : <Circle size={22} className="text-slate-200" />}</div>
                              <div className="flex-1">
                                <span className={`font-black text-sm md:text-base ${task.completed ? 'line-through opacity-50' : ''}`}>{task.content}</span>
                                {task.delayDays > 0 && <div className="text-[9px] font-black text-red-500 uppercase mt-1 tracking-tighter">Delay: +{task.delayDays}d</div>}
                                {task.type !== TaskType.SCHEDULE && (
                                  <div className={`text-[8px] font-black uppercase mt-1 ${task.type === TaskType.PRIORITY ? 'text-indigo-600' : 'text-orange-500'}`}>{task.type}</div>
                                )}
                              </div>
                              <button onClick={(e) => deleteTask(task.id, e)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          <div className="flex items-center gap-3 opacity-0 group-hover/slot:opacity-100 transition-all">
                            <button onClick={() => addTask(TaskType.SCHEDULE, slot)} className="text-[11px] font-black uppercase text-indigo-400 flex items-center gap-2 hover:text-indigo-700 transition-all"><Plus size={16} /> Schedule</button>
                            <div className="h-3 w-px bg-slate-200" />
                            <button onClick={() => addTask(TaskType.PRIORITY, slot)} className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm">P</button>
                            <button onClick={() => addTask(TaskType.GOAL, slot)} className="w-6 h-6 rounded bg-orange-50 text-orange-600 text-[10px] font-black hover:bg-orange-600 hover:text-white transition-all shadow-sm">G</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Sleep Routine */}
                <div className="bg-slate-900 text-white p-6 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Moon size={20} className="text-indigo-400" />
                      <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">{sleepRoutine.time} Sleep Routine</span>
                    </div>
                    <div
                      onClick={() => handleRoutineToggle('sleep')}
                      className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${dailyData.sleepCompleted ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${dailyData.sleepCompleted ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>
                  <p className={`text-sm font-bold pl-7 ${dailyData.sleepCompleted ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                    {sleepRoutine.activities}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Dashboard
          data={dashboardData}
          viewMode={viewMode as 'weekly' | 'monthly'}
          reportFeedback={reportFeedback}
          isLoadingFeedback={isLoadingFeedback}
          onGenerateReport={handleGenerateReport}
          onCloseReport={() => setReportFeedback(null)}
        />
      )}

      <footer className="pt-24 pb-16 text-center flex flex-col items-center gap-4">
        <Zap className="text-indigo-500/10" size={64} fill="currentColor" />
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Precision Performance • PeakDone V3 Matrix</p>
        <div className="flex items-center gap-6 mt-4 opacity-30">
          <Monitor size={20} className="text-slate-400" />
          <div className="h-px w-16 bg-slate-300" />
          <Smartphone size={20} className="text-slate-400" />
        </div>
      </footer>
    </Layout>
  );
};

export default App;
