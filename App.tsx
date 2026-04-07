
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Task, TaskType, DailyData, Routine, DailyVision, User } from './types';
import { TIME_SLOTS, DEFAULT_WAKE_ACTIVITIES, DEFAULT_SLEEP_ACTIVITIES, DEFAULT_VISION } from './constants';
import { generateMonthlyFeedback } from './services/geminiService';
import { 
  CheckCircle2, 
  Circle, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  Plus,
  Trash2,
  TrendingUp,
  LayoutDashboard,
  LogIn,
  X,
  Zap,
  Target,
  Edit2,
  Check,
  CloudSync,
  Loader2,
  RefreshCw,
  Smartphone,
  Monitor,
  Sunrise,
  Moon,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Lock,
  Mail,
  Cloud,
  Wifi,
  BarChart3
} from 'lucide-react';

type ViewMode = 'daily' | 'weekly' | 'monthly';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(() => new Date().toLocaleDateString('sv').split('T')[0]);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pd_v3_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(!user);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  const getCloudKey = useCallback((date: string) => `cloud_matrix_${user?.email || 'guest'}_${date}`, [user]);

  const syncWithServer = useCallback(async (action: 'PUSH' | 'PULL', data?: any) => {
    if (!user) return null;
    setIsSyncing(true);
    
    // Simulating network latency (0.5s)
    await new Promise(r => setTimeout(r, 500));
    
    try {
      if (action === 'PUSH' && data) {
        localStorage.setItem(getCloudKey(data.date), JSON.stringify(data));
      } else if (action === 'PULL') {
        const remote = localStorage.getItem(getCloudKey(currentDate));
        return remote ? JSON.parse(remote) : null;
      }
      
      const updatedUser = { ...user, lastSync: new Date().toLocaleTimeString() };
      setUser(updatedUser);
      localStorage.setItem('pd_v3_session', JSON.stringify(updatedUser));
    } finally {
      setIsSyncing(false);
    }
  }, [user, getCloudKey, currentDate]);

  // Priority Sync Logic: Timestamp-based "Last-Write Wins"
  const handleManualSync = useCallback(async () => {
    if (!user || !dailyData) return;
    setIsSyncing(true);
    
    try {
      const cloudKey = getCloudKey(currentDate);
      const cloudRaw = localStorage.getItem(cloudKey);
      
      // Simulating fetching from server
      await new Promise(r => setTimeout(r, 1000));

      if (cloudRaw) {
        const cloudData: DailyData = JSON.parse(cloudRaw);
        const cloudTime = cloudData.updatedAt || 0;
        const localTime = dailyData.updatedAt || 0;
        
        if (cloudTime > localTime) {
          // Cloud data is newer: Apply it to local
          setDailyData(cloudData);
        } else if (localTime > cloudTime) {
          // Local data is newer: Push it to cloud
          const dataToPush = { ...dailyData, updatedAt: Date.now() };
          localStorage.setItem(cloudKey, JSON.stringify(dataToPush));
        }
      } else {
        // No remote data: Initial push
        const dataToPush = { ...dailyData, updatedAt: Date.now() };
        localStorage.setItem(cloudKey, JSON.stringify(dataToPush));
      }
      
      const updatedUser = { ...user, lastSync: new Date().toLocaleTimeString() };
      setUser(updatedUser);
      localStorage.setItem('pd_v3_session', JSON.stringify(updatedUser));
    } finally {
      setIsSyncing(false);
    }
  }, [user, dailyData, currentDate, getCloudKey]);

  const handleLogin = () => {
    if (!authEmail.includes('@') || authPassword.length < 4) {
      alert("올바른 이메일과 4자리 이상의 비밀번호를 입력하세요.");
      return;
    }

    const newUser: User = { 
      email: authEmail, 
      token: btoa(authEmail + authPassword),
      lastSync: new Date().toLocaleTimeString(),
      isLoggedIn: true
    };
    
    setUser(newUser);
    localStorage.setItem('pd_v3_session', JSON.stringify(newUser));
    setIsAuthModalOpen(false);
    window.location.reload(); 
  };

  const handleLogout = () => {
    if(confirm("안전하게 로그아웃 하시겠습니까?")) {
      setUser(null);
      localStorage.removeItem('pd_v3_session');
      window.location.reload();
    }
  };

  const loadDayData = useCallback(async (targetDate: string) => {
    if (!user) return;
    
    let data = await syncWithServer('PULL');
    
    if (!data) {
      data = {
        date: targetDate,
        vision: { text: DEFAULT_VISION },
        wakeRoutine: { id: 'wake', type: 'wake', time: "07:00", activities: DEFAULT_WAKE_ACTIVITIES, completed: false },
        sleepRoutine: { id: 'sleep', type: 'sleep', time: "22:30", activities: DEFAULT_SLEEP_ACTIVITIES, completed: false },
        tasks: [],
        updatedAt: 0
      };
    }

    const today = new Date(targetDate);
    const rolledTasks: Task[] = [];
    for (let i = 1; i <= 7; i++) {
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - i);
      const pastKey = `cloud_matrix_${user.email}_${pastDate.toLocaleDateString('sv').split('T')[0]}`;
      const pastSaved = localStorage.getItem(pastKey);
      
      if (pastSaved) {
        let pastData: DailyData = JSON.parse(pastSaved);
        let updated = false;
        pastData.tasks.filter(t => !t.completed && !t.isArchived).forEach(t => {
          if (!data.tasks.some(ct => ct.content === t.content)) {
            rolledTasks.push({
              ...t,
              id: `roll_${t.id}_${targetDate}`,
              date: targetDate,
              delayDays: Math.floor((today.getTime() - new Date(t.originalDate).getTime()) / (1000 * 3600 * 24))
            });
            t.isArchived = true;
            updated = true;
          }
        });
        if (updated) {
          pastData.updatedAt = Date.now();
          localStorage.setItem(pastKey, JSON.stringify(pastData));
        }
      }
    }

    const finalData = { ...data, tasks: [...rolledTasks, ...data.tasks] };
    setDailyData(finalData);
    localStorage.setItem(getCloudKey(targetDate), JSON.stringify(finalData));
  }, [user, syncWithServer, getCloudKey]);

  useEffect(() => {
    if (user) loadDayData(currentDate);
  }, [currentDate, user, loadDayData]);

  const saveDailyData = async (data: DailyData) => {
    const dataWithTimestamp = { ...data, updatedAt: Date.now() };
    setDailyData(dataWithTimestamp);
    await syncWithServer('PUSH', dataWithTimestamp);
  };

  const updateTaskStatus = (taskId: string) => {
    if (!dailyData) return;
    const newTasks = dailyData.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    saveDailyData({ ...dailyData, tasks: newTasks });
  };

  const handleRoutineToggle = (type: 'wake' | 'sleep') => {
    if (!dailyData) return;
    const updated = type === 'wake' 
      ? { ...dailyData, wakeRoutine: { ...dailyData.wakeRoutine, completed: !dailyData.wakeRoutine.completed } }
      : { ...dailyData, sleepRoutine: { ...dailyData.sleepRoutine, completed: !dailyData.sleepRoutine.completed } };
    saveDailyData(updated);
  };

  const addTask = (type: TaskType, slot?: string) => {
    if (!dailyData) return;
    const content = prompt("할 일을 입력하세요:");
    if (!content) return;
    const newTask: Task = { 
      id: Math.random().toString(36).substr(2, 9), 
      content, type, timeSlot: slot, completed: false, 
      date: dailyData.date, originalDate: dailyData.date, delayDays: 0, isArchived: false
    };
    saveDailyData({ ...dailyData, tasks: [...dailyData.tasks, newTask] });
  };

  const deleteTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dailyData) return;
    saveDailyData({ ...dailyData, tasks: dailyData.tasks.filter(t => t.id !== taskId) });
  };

  const efficiencyData = useMemo(() => {
    const stats = [];
    const today = new Date(currentDate);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString('sv').split('T')[0];
      
      let day: DailyData | null = null;
      if (dateStr === currentDate && dailyData) {
        day = dailyData;
      } else {
        const saved = localStorage.getItem(`cloud_matrix_${user?.email || 'guest'}_${dateStr}`);
        if (saved) day = JSON.parse(saved);
      }

      if (day) {
        const total = day.tasks.length;
        const completed = day.tasks.filter(t => t.completed).length;
        stats.push({ 
          date: dateStr.split('-').slice(1).join('/'), 
          percent: total === 0 ? 0 : Math.round((completed / total) * 100), 
          total 
        });
      } else {
        stats.push({ date: dateStr.split('-').slice(1).join('/'), percent: 0, total: 0 });
      }
    }
    return stats;
  }, [dailyData, currentDate, user]);

  const dashboardData = useMemo(() => {
    if (viewMode === 'daily') return [];
    const days = viewMode === 'weekly' ? 7 : 30;
    const result: DailyData[] = [];
    const today = new Date(currentDate);
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString('sv').split('T')[0];
      if (dateStr === currentDate && dailyData) {
        result.push(dailyData);
      } else {
        const saved = localStorage.getItem(`cloud_matrix_${user?.email || 'guest'}_${dateStr}`);
        if (saved) result.push(JSON.parse(saved));
      }
    }
    return result;
  }, [viewMode, currentDate, user, dailyData]);

  const handleGenerateReport = async () => {
    setIsLoadingFeedback(true);
    setReportFeedback(null);
    try {
      const days = viewMode === 'weekly' ? 7 : 30;
      const dataSet: DailyData[] = [];
      const today = new Date(currentDate);
      for (let i = 0; i < days; i++) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        const saved = localStorage.getItem(`cloud_matrix_${user?.email || 'guest'}_${d.toLocaleDateString('sv').split('T')[0]}`);
        if (saved) dataSet.push(JSON.parse(saved));
      }
      const report = await generateMonthlyFeedback(dataSet, viewMode.toUpperCase());
      setReportFeedback(report);
    } catch (e) {
      setReportFeedback("리포트 생성에 실패했습니다.");
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  if (isAuthModalOpen) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500 blur-[120px] rounded-full animate-pulse" />
           <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500 blur-[120px] rounded-full" />
        </div>
        <div className="bg-white w-full max-w-md rounded-[3rem] p-12 shadow-2xl relative z-10 text-center scale-up-center border border-white/20">
           <div className="bg-indigo-600 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/40 rotate-12">
             <Zap size={48} className="text-white fill-white" />
           </div>
           <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-2">Matrix Access</h2>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10">PeakDone V3 • Cloud Performance Identity</p>
           <div className="space-y-4 mb-8">
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="email" placeholder="Email Address" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
              </div>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="password" placeholder="Master Password" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
              </div>
           </div>
           <button onClick={handleLogin} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
             <Cloud size={16} /> Connect to Matrix DB
           </button>
           <p className="mt-8 text-[9px] font-bold text-slate-300 uppercase leading-relaxed">By connecting, you enable real-time cross-device sync<br/>and precision performance tracking across all platforms.</p>
        </div>
      </div>
    );
  }

  if (!dailyData) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
       <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-indigo-500 mx-auto" size={48} />
          <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">Streaming from Cloud Matrix...</p>
       </div>
    </div>
  );

  return (
    <Layout>
      {/* Header */}
      <header className="bg-[#0F172A] text-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl border border-indigo-500/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600/20 p-3 rounded-2xl"><Zap className="text-indigo-400" size={32} fill="currentColor" /></div>
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase italic bg-gradient-to-r from-orange-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">PeakDone</h1>
              <div className="flex items-center gap-2 mt-1">
                 <p className="text-[8px] md:text-[10px] font-bold text-slate-400 tracking-[0.4em] uppercase">Matrix V3</p>
                 <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <Wifi size={10} className="text-emerald-400" />
                    <span className="text-[8px] font-black text-emerald-400 uppercase">Cloud Online</span>
                 </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-3">
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex flex-col items-end mr-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase">Syncing as</span>
                    <span className="text-[10px] font-black text-indigo-400">{user.email}</span>
                  </div>
                  <button onClick={handleLogout} className="flex items-center gap-2 bg-white/5 hover:bg-red-500/20 hover:border-red-500/30 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 text-slate-400 hover:text-red-400"><LogOut size={14} /> LogOut</button>
                  <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                    <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d.toLocaleDateString('sv').split('T')[0]); }} className="hover:text-indigo-400 transition-colors"><ChevronLeft size={20} /></button>
                    <span className="font-mono text-sm md:text-lg font-black">{currentDate}</span>
                    <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d.toLocaleDateString('sv').split('T')[0]); }} className="hover:text-indigo-400 transition-colors"><ChevronRight size={20} /></button>
                  </div>
                </div>
             </div>
             <div className="flex items-center gap-3 w-full">
               <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 flex-1">
                 {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((mode) => (
                   <button key={mode} onClick={() => setViewMode(mode)} className={`flex-1 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === mode ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>{mode}</button>
                 ))}
               </div>
               {/* Manual Sync Button */}
               <button 
                 onClick={handleManualSync}
                 disabled={isSyncing}
                 className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/10 transition-all active:scale-95 group shrink-0"
               >
                 <RefreshCw size={14} className={`text-indigo-400 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                 <span className="text-[10px] font-black text-white uppercase tracking-widest hidden sm:inline">
                   {isSyncing ? 'Syncing...' : `Last Sync: ${user.lastSync}`}
                 </span>
                 <span className="text-[10px] font-black text-white uppercase tracking-widest sm:hidden">
                   {user.lastSync}
                 </span>
               </button>
             </div>
          </div>
        </div>
      </header>

      {viewMode === 'daily' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
          <div className="lg:col-span-5 space-y-8">
            {/* Real-time Performance Graph */}
            <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden relative">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><BarChart3 className="text-indigo-600" size={18} /> Performance</h3>
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
                      >
                         <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <span className={`text-[8px] font-black uppercase tracking-wider transition-colors ${i === 6 ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {stat.date}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Fixed Life Goal Matrix */}
            <section className="bg-slate-900 p-6 md:p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 blur-[80px] -mr-20 -mt-20" />
               <div className="flex items-center justify-between mb-4 relative z-10">
                 <h3 className="text-[8px] md:text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Life Goal Matrix</h3>
               </div>
               <p className="text-lg md:text-2xl font-black leading-snug italic text-indigo-50 relative z-10">
                 "{DEFAULT_VISION}"
               </p>
            </section>

            {/* Priorities Section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-3"><Clock className="text-indigo-600" /> Priorities</h3>
                <button onClick={() => addTask(TaskType.PRIORITY)} className="bg-indigo-600 text-white w-8 h-8 flex items-center justify-center rounded-lg font-black text-xs shadow-lg hover:bg-indigo-700 hover:scale-110 active:scale-90 transition-all">P</button>
              </div>
              {dailyData.tasks.filter(t => t.type === TaskType.PRIORITY).map(task => (
                <div key={task.id} onClick={() => updateTaskStatus(task.id)} className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-[1.5rem] hover:shadow-xl transition-all cursor-pointer group shadow-lg">
                  <div className="shrink-0">{task.completed ? <CheckCircle2 className="text-emerald-500" size={24} /> : <Circle className="text-slate-200" size={24} />}</div>
                  <div className="flex-1">
                    <p className={`font-black text-sm md:text-lg ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.content}</p>
                    {task.delayDays > 0 && <span className="text-[9px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-lg mt-1 inline-block uppercase">+{task.delayDays}d Delay</span>}
                    {task.timeSlot && <span className="text-[9px] font-black text-indigo-500 uppercase ml-2">Scheduled: {task.timeSlot}</span>}
                  </div>
                  <button onClick={(e) => deleteTask(task.id, e)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18} /></button>
                </div>
              ))}
            </section>

            {/* Focus Goal Section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-3"><Target className="text-orange-500" /> Focus Goal</h3>
                <button onClick={() => addTask(TaskType.GOAL)} className="bg-orange-500 text-white w-8 h-8 flex items-center justify-center rounded-lg font-black text-xs shadow-lg hover:bg-orange-600 hover:scale-110 active:scale-90 transition-all">G</button>
              </div>
              {dailyData.tasks.filter(t => t.type === TaskType.GOAL).map(task => (
                <div key={task.id} onClick={() => updateTaskStatus(task.id)} className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-[1.5rem] hover:shadow-xl transition-all cursor-pointer group shadow-lg">
                  <div className="shrink-0">{task.completed ? <CheckCircle2 className="text-emerald-500" size={24} /> : <Circle className="text-slate-200" size={24} />}</div>
                  <div className="flex-1">
                    <p className={`font-black text-sm md:text-lg ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.content}</p>
                    {task.timeSlot && <span className="text-[9px] font-black text-orange-500 uppercase">Scheduled: {task.timeSlot}</span>}
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
                   <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-indigo-400 animate-spin' : 'bg-emerald-400 animate-pulse'}`}></div>
                   <span className="text-[10px] font-black text-white uppercase tracking-widest">{isSyncing ? 'Syncing...' : `Last Sync: ${user.lastSync}`}</span>
                </div>
              </div>
              
              <div className="divide-y divide-slate-50 max-h-[850px] overflow-y-auto scrollbar-hide bg-slate-50/20">
                <div className="bg-indigo-50/50 p-6 border-b border-indigo-100">
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                         <Sunrise size={20} className="text-indigo-600" />
                         <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em]">07:00 Wake Routine</span>
                      </div>
                      <div onClick={() => handleRoutineToggle('wake')} className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${dailyData.wakeRoutine.completed ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                         <div className={`w-4 h-4 bg-white rounded-full transition-transform ${dailyData.wakeRoutine.completed ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                   </div>
                   <p className={`text-sm font-bold pl-7 ${dailyData.wakeRoutine.completed ? 'text-indigo-700/50 line-through' : 'text-indigo-900'}`}>{dailyData.wakeRoutine.activities}</p>
                </div>

                {TIME_SLOTS.map(slot => {
                  const tasksForSlot = dailyData.tasks.filter(t => t.timeSlot === slot);
                  return (
                    <div key={slot} className="flex min-h-[90px] group/slot transition-colors hover:bg-white">
                      <div className="w-20 shrink-0 p-4 text-[11px] font-black text-slate-400 border-r border-slate-50 flex items-center justify-center bg-white">{slot}</div>
                      <div className="flex-1 p-4">
                        <div className="flex flex-col gap-3">
                          {tasksForSlot.map(task => (
                            <div key={task.id} onClick={() => updateTaskStatus(task.id)} className={`p-5 rounded-2xl border-2 flex items-center gap-4 cursor-pointer transition-all shadow-md group/item relative pr-12 ${task.completed ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-white border-slate-100 text-slate-900 hover:border-indigo-400 hover:-translate-y-1'}`}>
                              <div className="shrink-0">{task.completed ? <CheckCircle2 size={22} className="text-emerald-500" /> : <Circle size={22} className="text-slate-200" />}</div>
                              <div className="flex-1">
                                <span className={`font-black text-sm md:text-base ${task.completed ? 'line-through opacity-50' : ''}`}>{task.content}</span>
                                {task.delayDays > 0 && <div className="text-[9px] font-black text-red-500 uppercase mt-1 tracking-tighter">Delay: +{task.delayDays}d</div>}
                                {task.type !== TaskType.SCHEDULE && <div className={`text-[8px] font-black uppercase mt-1 ${task.type === TaskType.PRIORITY ? 'text-indigo-600' : 'text-orange-500'}`}>{task.type}</div>}
                              </div>
                              <button onClick={(e) => deleteTask(task.id, e)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100"><Trash2 size={16} /></button>
                            </div>
                          ))}
                          <div className="flex items-center gap-3 opacity-0 group-hover/slot:opacity-100 transition-all">
                             <button onClick={() => addTask(TaskType.SCHEDULE, slot)} className="text-[11px] font-black uppercase text-indigo-400 flex items-center gap-2 hover:text-indigo-700 transition-all"><Plus size={16} /> Schedule</button>
                             <div className="h-3 w-px bg-slate-200"></div>
                             <button onClick={() => addTask(TaskType.PRIORITY, slot)} className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm">P</button>
                             <button onClick={() => addTask(TaskType.GOAL, slot)} className="w-6 h-6 rounded bg-orange-50 text-orange-600 text-[10px] font-black hover:bg-orange-600 hover:text-white transition-all shadow-sm">G</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="bg-slate-900 text-white p-6 border-t border-slate-800">
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                         <Moon size={20} className="text-indigo-400" />
                         <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">22:30 Sleep Routine</span>
                      </div>
                      <div onClick={() => handleRoutineToggle('sleep')} className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${dailyData.sleepRoutine.completed ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                         <div className={`w-4 h-4 bg-white rounded-full transition-transform ${dailyData.sleepRoutine.completed ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                   </div>
                   <p className={`text-sm font-bold pl-7 ${dailyData.sleepRoutine.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{dailyData.sleepRoutine.activities}</p>
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
           <div className="h-px w-16 bg-slate-300"></div>
           <Smartphone size={20} className="text-slate-400" />
        </div>
      </footer>
    </Layout>
  );
};

export default App;
