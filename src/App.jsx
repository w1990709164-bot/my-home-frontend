import { useState, useEffect, useRef } from 'react'
import {
  getSessions, createSession, deleteSession, renameSession,
  getMessages, sendMessage,
  getMemories,
  getDiary, createDiary,
  getSchedules, createSchedule, updateSchedule, deleteSchedule,
  getSettings, updateSettings
} from './api'

const MODELS = ['claude-sonnet-4-5', 'claude-haiku-4-5', 'deepseek-chat']
function MessageBubble({ message: m, style: s }) {
  console.log('MessageBubble rendered', m.role)
  const [translation, setTranslation] = useState('')
  const [translating, setTranslating] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)

  async function handleTranslate() {
    if (showTranslation) { setShowTranslation(false); return }
    if (translation) { setShowTranslation(true); return }
    setTranslating(true)
    try {
      const res = await fetch('https://my-home-backend-f0ct.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 0,
          message: `请把以下内容翻译成中文，只输出翻译结果，不要任何解释：\n${m.content}`,
          model: 'deepseek-chat'
        })
      })
      const data = await res.json()
      setTranslation(data.reply)
      setShowTranslation(true)
    } catch (e) {
      setTranslation('翻译失败')
      setShowTranslation(true)
    }
    setTranslating(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
      <div style={s.bubble(m.role)}>{m.content}</div>
      {m.role === 'assistant' && (
        <button onClick={handleTranslate} style={{ alignSelf: 'flex-start', marginTop: 4, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '2px 4px' }}>
          {translating ? '翻译中…' : showTranslation ? '收起' : '翻译'}
        </button>
      )}
      {showTranslation && translation && (
        <div style={{ marginTop: 4, padding: '8px 12px', background: 'rgba(107,127,158,0.15)', borderRadius: '0 12px 12px 12px', fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, border: '0.5px solid rgba(107,127,158,0.2)' }}>
          {translation}
        </div>
      )}
    </div>
  )
}
export default function App() {
  const [page, setPage] = useState('home')
  const [sessions, setSessions] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState(() => localStorage.getItem('model') || MODELS[0])
  const [memories, setMemories] = useState([])
  const [diary, setDiary] = useState([])
  const [diaryInput, setDiaryInput] = useState('')
  const [diaryMood, setDiaryMood] = useState('平静')
  const [schedules, setSchedules] = useState([])
  const [scheduleInput, setScheduleInput] = useState('')
  const [settings, setSettings] = useState({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  const [weather, setWeather] = useState({ temp: '--', desc: '获取中' })
  const [calPage, setCalPage] = useState('week')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    updateClock()
    const t = setInterval(updateClock, 1000)
    fetchWeather()
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  function updateClock() {
    const now = new Date()
    const h = String(now.getHours()).padStart(2, '0')
    const m = String(now.getMinutes()).padStart(2, '0')
    setTime(`${h}:${m}`)
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    setDate(`${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · ${days[now.getDay()]}`)
  }

  async function fetchWeather() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude: lat, longitude: lon } = pos.coords
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
        const data = await r.json()
        const w = data.current_weather
        const temp = Math.round(w.temperature)
        const code = w.weathercode
        let desc = '晴', icon = '☀'
        if (code >= 1 && code <= 3) { desc = '多云'; icon = '⛅' }
        if (code >= 45 && code <= 48) { desc = '雾'; icon = '🌫' }
        if (code >= 51 && code <= 67) { desc = '有雨'; icon = '🌧' }
        if (code >= 71 && code <= 77) { desc = '有雪'; icon = '❄' }
        if (code >= 80 && code <= 82) { desc = '阵雨'; icon = '🌦' }
        if (code >= 95) { desc = '雷雨'; icon = '⛈' }
        setWeather({ temp: `${icon} ${temp}°C`, desc })
      } catch (e) {
        setWeather({ temp: '--°C', desc: '无法获取' })
      }
    }, () => setWeather({ temp: '--°C', desc: '需要定位' }))
  }

  async function openChat() {
    setPage('chat')
    const res = await getSessions()
    setSessions(res.data)
    if (res.data.length === 0) {
      const s = await createSession('新对话')
      setSessions([s.data])
      loadSession(s.data)
    } else {
      loadSession(res.data[0])
    }
  }

  async function loadSession(session) {
    setCurrentSession(session)
    setSidebarOpen(false)
    const res = await getMessages(session.id)
    setMessages(res.data)
  }

  async function handleSend() {
    if (!input.trim() || loading || !currentSession) return
    const msg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res = await sendMessage(currentSession.id, msg, model)
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }])
      const sessions = await getSessions()
      setSessions(sessions.data)
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '出错了，请稍后再试。' }])
    }
    setLoading(false)
  }

  async function handleNewSession() {
    const s = await createSession('新对话')
    setSessions(prev => [s.data, ...prev])
    loadSession(s.data)
  }

  async function handleDeleteSession(id) {
    await deleteSession(id)
    const res = await getSessions()
    setSessions(res.data)
    if (res.data.length > 0) loadSession(res.data[0])
    else { setCurrentSession(null); setMessages([]) }
  }

  async function openMemory() {
    setPage('memory')
    const res = await getMemories()
    setMemories(res.data)
  }

  async function openDiary() {
    setPage('diary')
    const res = await getDiary()
    setDiary(res.data)
  }

  async function handleAddDiary() {
    if (!diaryInput.trim()) return
    await createDiary(diaryInput, diaryMood)
    setDiaryInput('')
    const res = await getDiary()
    setDiary(res.data)
  }

  async function openCalendar() {
    setPage('calendar')
    const res = await getSchedules()
    setSchedules(res.data)
  }

  async function handleAddSchedule() {
    if (!scheduleInput.trim()) return
    await createSchedule(scheduleInput, null, 'pending')
    setScheduleInput('')
    const res = await getSchedules()
    setSchedules(res.data)
  }

  async function handleToggleSchedule(s) {
    await updateSchedule(s.id, { tag: s.tag === 'done' ? 'pending' : 'done' })
    const res = await getSchedules()
    setSchedules(res.data)
  }

  async function handleDeleteSchedule(id) {
    await deleteSchedule(id)
    const res = await getSchedules()
    setSchedules(res.data)
  }

  async function openSettings() {
    setPage('settings')
    const res = await getSettings()
    setSettings(res.data)
  }

  async function handleSaveSettings() {
    await updateSettings(settings)
    alert('保存成功')
  }

  function changeModel(m) {
    setModel(m)
    localStorage.setItem('model', m)
  }

  // 本周日期
  function getWeekDays() {
    const now = new Date()
    const today = now.getDay()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(now.getDate() - today + i)
      return { day: ['日','一','二','三','四','五','六'][i], date: d.getDate(), isToday: i === today }
    })
  }

  // 本月日期
  function getMonthDays() {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), 1).getDay()
    const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return { first, total, today: now.getDate() }
  }

  const s = {
    phone: { width: '100%', maxWidth: 390, height: '100vh', position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg,#1c1c1e 0%,#2a2a2e 40%,#1a1a1c 100%)' },
    musicBar: { margin: '12px 14px 0', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 },
    glassBox: { background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 16 },
    iconBox: { width: 62, height: 62, borderRadius: 18, background: 'rgba(255,255,255,0.09)', backdropFilter: 'blur(20px)', border: '0.5px solid rgba(255,255,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, cursor: 'pointer' },
    innerPage: { position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', background: 'rgba(18,18,20,0.97)', backdropFilter: 'blur(30px)' },
    innerTop: { padding: '16px 18px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '0.5px solid rgba(255,255,255,0.08)', flexShrink: 0 },
    innerTitle: { fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)', flex: 1 },
    backBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer', padding: 2 },
    bubble: (role) => ({ padding: '10px 14px', fontSize: 14, lineHeight: 1.65, borderRadius: role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: role === 'user' ? 'rgba(107,127,158,0.55)' : 'rgba(255,255,255,0.07)', color: role === 'user' ? '#fff' : 'rgba(255,255,255,0.85)', border: role === 'user' ? '0.5px solid rgba(107,127,158,0.4)' : '0.5px solid rgba(255,255,255,0.08)', maxWidth: '80%', alignSelf: role === 'user' ? 'flex-end' : 'flex-start' }),
    input: { flex: 1, background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '10px 16px', fontSize: 14, color: 'rgba(255,255,255,0.85)', outline: 'none' },
    sendBtn: { width: 36, height: 36, borderRadius: '50%', background: 'rgba(107,127,158,0.6)', border: 'none', cursor: 'pointer', color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    card: { background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', marginBottom: 10 },
    setRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 8, border: '0.5px solid rgba(255,255,255,0.06)' },
  }

  const weekDays = getWeekDays()
  const { first, total, today: todayDate } = getMonthDays()

  return (
    <div style={s.phone}>
      {/* 主桌面 */}
      {page === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* 音乐栏 */}
          <div style={s.musicBar}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>💿</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>我怀念的</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>孙燕姿</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 18, cursor: 'pointer' }}>▶</button>
              <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer' }}>♪</button>
            </div>
          </div>

          {/* 时钟+天气 */}
          <div style={{ padding: '14px 20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 62, fontWeight: 300, color: 'rgba(255,255,255,0.92)', letterSpacing: -2, lineHeight: 1 }}>{time}</div>
              <div style={{ textAlign: 'right', paddingTop: 8 }}>
                <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.85)', fontWeight: 300 }}>{weather.temp}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{weather.desc}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 5 }}>{date}</div>
          </div>

          {/* 本周日历条 */}
          <div style={{ ...s.glassBox, margin: '12px 14px 0', padding: '12px 14px', cursor: 'pointer' }} onClick={openCalendar}>
            <div style={{ display: 'flex' }}>
              {weekDays.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{d.day}</div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, background: d.isToday ? 'rgba(107,127,158,0.45)' : 'transparent', color: d.isToday ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)', fontWeight: d.isToday ? 500 : 400 }}>{d.date}</div>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'transparent' }}></div>
                </div>
              ))}
            </div>
          </div>

          {/* 图标区 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 0 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0 24px' }}>
              {[
                { icon: '🔖', label: '记忆', action: openMemory },
                { icon: '📓', label: '日记', action: openDiary },
                { icon: '💬', label: '对话', action: openChat },
                { icon: '⚙️', label: '设置', action: openSettings },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, cursor: 'pointer' }} onClick={item.action}>
                  <div style={s.iconBox}>{item.icon}</div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 对话页 */}
      {page === 'chat' && (
        <div style={s.innerPage}>
          {/* 侧边栏 */}
          {sidebarOpen && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setSidebarOpen(false)} />
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 260, background: 'rgba(28,28,30,0.97)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', padding: '48px 0 24px' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', padding: '0 20px', marginBottom: 14 }}>对话</div>
                <button onClick={handleNewSession} style={{ margin: '0 16px 18px', padding: '9px 14px', background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 20, fontSize: 13, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>＋ 新建对话</button>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                {sessions.map(sess => (
  <div key={sess.id} style={{ padding: '11px 20px', cursor: 'pointer', fontSize: 13, color: currentSession?.id === sess.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)', background: currentSession?.id === sess.id ? 'rgba(107,127,158,0.2)' : 'transparent', borderLeft: currentSession?.id === sess.id ? '2px solid rgba(107,127,158,0.8)' : '2px solid transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => loadSession(sess)}>
    <span>{sess.name}</span>
    <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(sess.id) }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14 }}>×</button>
  </div>
))}
                </div>
              </div>
            </div>
          )}
          <div style={s.innerTop}>
            <button style={s.backBtn} onClick={() => setSidebarOpen(true)}>☰</button>
            <div style={s.innerTitle}>对话</div>
            <select value={model} onChange={e => changeModel(e.target.value)} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '3px 8px' }}>
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button style={s.backBtn} onClick={() => setPage('home')}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((m, i) => (
  <MessageBubble key={i} message={m} style={s} />
))}
            {loading && <div style={{ ...s.bubble('assistant'), opacity: 0.6 }}>···</div>}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ padding: '10px 14px 24px', borderTop: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="说点什么…" style={{ ...s.input }} />
            <button onClick={handleSend} style={s.sendBtn} disabled={loading}>↑</button>
          </div>
        </div>
      )}

      {/* 记忆页 */}
      {page === 'memory' && (
        <div style={s.innerPage}>
          <div style={s.innerTop}>
            <button style={s.backBtn} onClick={() => setPage('home')}>←</button>
            <div style={s.innerTitle}>记忆</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>我记得的事</div>
            {memories.length === 0 && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40 }}>还没有记忆，多聊聊吧</div>}
            {memories.map(m => (
              <div key={m.id} style={s.card}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>{new Date(m.timestamp).toLocaleDateString('zh-CN')} · 来自对话</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>{m.summary}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 日记页 */}
      {page === 'diary' && (
        <div style={s.innerPage}>
          <div style={s.innerTop}>
            <button style={s.backBtn} onClick={() => setPage('home')}>←</button>
            <div style={s.innerTitle}>日记</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px' }}>
            <div style={{ marginBottom: 20 }}>
              <textarea value={diaryInput} onChange={e => setDiaryInput(e.target.value)} placeholder="今天…" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: 'rgba(255,255,255,0.85)', minHeight: 80, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                {['平静', '开心', '难过', '放松', '焦虑'].map(mood => (
                  <button key={mood} onClick={() => setDiaryMood(mood)} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.15)', background: diaryMood === mood ? 'rgba(107,127,158,0.4)' : 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>{mood}</button>
                ))}
                <button onClick={handleAddDiary} style={{ marginLeft: 'auto', background: 'rgba(107,127,158,0.6)', border: 'none', borderRadius: 10, padding: '4px 14px', color: '#fff', fontSize: 13, cursor: 'pointer' }}>记下</button>
              </div>
            </div>
            {diary.map(d => (
              <div key={d.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)', paddingBottom: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>{new Date(d.created_at).toLocaleString('zh-CN')}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>{d.content}</div>
                {d.mood && <span style={{ display: 'inline-block', fontSize: 11, color: 'rgba(140,160,200,0.9)', background: 'rgba(107,127,158,0.2)', borderRadius: 10, padding: '2px 8px', marginTop: 6 }}>{d.mood}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 日历+日程页 */}
      {page === 'calendar' && (
        <div style={s.innerPage}>
          <div style={s.innerTop}>
            <button style={s.backBtn} onClick={() => setPage('home')}>←</button>
            <div style={s.innerTitle}>日历 · 日程</div>
            <button onClick={() => { const name = prompt('日程名称'); if (name) handleAddSchedule(name) }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>＋</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px' }}>
            {/* 月历 */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: 14 }}>{new Date().getFullYear()}年{new Date().getMonth() + 1}月</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                {['日','一','二','三','四','五','六'].map(d => <div key={d} style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '6px 0' }}>{d}</div>)}
                {Array.from({ length: first }, (_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: total }, (_, i) => (
                  <div key={i} style={{ fontSize: 13, color: i + 1 === todayDate ? 'rgba(140,165,210,1)' : 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '8px 0', borderRadius: 8, background: i + 1 === todayDate ? 'rgba(107,127,158,0.3)' : 'transparent', fontWeight: i + 1 === todayDate ? 500 : 400 }}>{i + 1}</div>
                ))}
              </div>
            </div>
            {/* 日程 */}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', marginBottom: 10 }}>日程</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input value={scheduleInput} onChange={e => setScheduleInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSchedule()} placeholder="添加日程…" style={{ ...s.input, flex: 1 }} />
              <button onClick={handleAddSchedule} style={s.sendBtn}>＋</button>
            </div>
            {schedules.map(sc => (
              <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 8, border: '0.5px solid rgba(255,255,255,0.06)' }}>
                <div onClick={() => handleToggleSchedule(sc)} style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)', background: sc.tag === 'done' ? 'rgba(107,127,158,0.6)' : 'transparent', cursor: 'pointer', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: sc.tag === 'done' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)', textDecoration: sc.tag === 'done' ? 'line-through' : 'none', flex: 1 }}>{sc.name}</span>
                <button onClick={() => handleDeleteSchedule(sc.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 设置页 */}
      {page === 'settings' && (
        <div style={s.innerPage}>
          <div style={s.innerTop}>
            <button style={s.backBtn} onClick={() => setPage('home')}>←</button>
            <div style={s.innerTitle}>设置</div>
            <button onClick={handleSaveSettings} style={{ background: 'rgba(107,127,158,0.5)', border: 'none', borderRadius: 10, padding: '4px 12px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>保存</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8, letterSpacing: '0.06em' }}>人格</div>
            <textarea value={settings.system_prompt || ''} onChange={e => setSettings({ ...settings, system_prompt: e.target.value })} placeholder="系统提示词…" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: 'rgba(255,255,255,0.85)', minHeight: 100, outline: 'none', marginBottom: 16 }} />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8, letterSpacing: '0.06em' }}>模型参数</div>
            {[
              { label: '温度', key: 'temperature', type: 'number' },
              { label: '上下文轮数', key: 'max_context_rounds', type: 'number' },
              { label: '压缩阈值（字符数）', key: 'compress_threshold', type: 'number' },
              { label: '压缩后保留轮数', key: 'compress_keep_rounds', type: 'number' },
              { label: '最大回复 token', key: 'max_reply_tokens', type: 'number' },
            ].map(({ label, key, type }) => (
              <div key={key} style={s.setRow}>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>{label}</span>
                <input type={type} value={settings[key] || ''} onChange={e => setSettings({ ...settings, [key]: type === 'number' ? Number(e.target.value) : e.target.value })} style={{ width: 80, background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 8px', fontSize: 13, color: 'rgba(255,255,255,0.85)', outline: 'none', textAlign: 'right' }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}