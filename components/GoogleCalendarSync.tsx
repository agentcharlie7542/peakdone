import React, { useState, useEffect } from 'react';
import { CalendarDays, RefreshCw, Unlink, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  requestCalendarAccess,
  syncTasksToCalendar,
  disconnectCalendar,
  getCalendarStatus,
} from '../services/googleCalendarService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Task } from '../types';

interface Props {
  uid: string
  isGoogleUser: boolean   // providerData에 google.com 있으면 true
  tasks: Task[]
  currentDate: string
}

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export const GoogleCalendarSync: React.FC<Props> = ({
  uid,
  isGoogleUser,
  tasks,
  currentDate,
}) => {
  const [connected,  setConnected]  = useState(false)
  const [status,     setStatus]     = useState<SyncStatus>('idle')
  const [message,    setMessage]    = useState('')
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    getCalendarStatus(uid).then(setConnected)
  }, [uid])

  // Google 로그인 유저가 아니면 표시하지 않음
  if (!isGoogleUser) return null;

  const handleConnect = async () => {
    setConnecting(true)
    setMessage('')
    try {
      await requestCalendarAccess()
      setConnected(true)
      setMessage('Google Calendar 연동 완료!')
    } catch (e: any) {
      setMessage('연동에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setConnecting(false)
    }
  }

  const handleSync = async () => {
    setStatus('syncing')
    setMessage('')
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      const token = snap.data()?.googleCalendarToken
      if (!token) throw new Error('토큰 없음')

      const scheduledTasks = tasks.filter((t) => t.timeSlot && !t.isArchived)
      if (scheduledTasks.length === 0) {
        setStatus('idle')
        setMessage('시간이 지정된 태스크가 없습니다.')
        return
      }

      const { success, failed } = await syncTasksToCalendar(tasks, currentDate, token)
      setStatus('success')
      setMessage(`${success}개 등록 완료${failed > 0 ? ` (${failed}개 실패)` : ''}`)
    } catch (e: any) {
      // 토큰 만료 시 재연동 유도
      if (e.message?.includes('401') || e.message?.includes('토큰')) {
        setConnected(false)
        setMessage('토큰이 만료됐습니다. 재연동해주세요.')
      } else {
        setMessage('동기화에 실패했습니다.')
      }
      setStatus('error')
    }
  }

  const handleDisconnect = async () => {
    await disconnectCalendar(uid)
    setConnected(false)
    setMessage('')
    setStatus('idle')
  }

  return (
    <div className="flex items-center gap-2">
      {!connected ? (
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 active:scale-95 transition-all disabled:opacity-60 whitespace-nowrap"
        >
          <CalendarDays size={11} className="text-indigo-400" />
          {connecting ? 'Connecting...' : 'Google Calendar Sync'}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={status === 'syncing'}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600/80 border border-indigo-500/40 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-200 hover:bg-indigo-600 active:scale-95 transition-all disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw size={11} className={status === 'syncing' ? 'animate-spin' : ''} />
            {status === 'syncing' ? 'Syncing...' : 'Google Calendar Sync'}
          </button>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-400 hover:text-red-500 hover:border-red-200 transition-all"
            title="연동 해제"
          >
            <Unlink size={13} />
          </button>
        </div>
      )}

      {/* 상태 메시지 */}
      {message && (
        <span className={`flex items-center gap-1 text-[11px] font-bold ${
          status === 'success' ? 'text-emerald-500' :
          status === 'error'   ? 'text-red-500' : 'text-slate-400'
        }`}>
          {status === 'success' && <CheckCircle2 size={12} />}
          {status === 'error'   && <AlertCircle size={12} />}
          {message}
        </span>
      )}
    </div>
  )
}
