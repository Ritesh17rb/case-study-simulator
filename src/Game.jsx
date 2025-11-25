import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { fetchAIResponse, streamAIResponse } from './aiService'

export default function Game({ session }) {
  const [gameSessionId, setGameSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  // Profile / history
  const [showProfile, setShowProfile] = useState(false)
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedMessages, setSelectedMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const openProfile = async () => {
    setShowProfile(true)
    setSelectedSession(null)
    setSelectedMessages([])
    setLoadingSessions(true)
    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (!error && data) setSessions(data)
    setLoadingSessions(false)
  }

  const viewSession = async (sess) => {
    setSelectedSession(sess)
    setLoadingMessages(true)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sess.id)
      .order('created_at', { ascending: true })
    if (!error && data) setSelectedMessages(data)
    setLoadingMessages(false)
  }

  const closeProfile = () => setShowProfile(false)

  // Start a new game session
  const startNewGame = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('game_sessions')
      .insert([{ user_id: session.user.id }])
      .select()

    if (error) {
      console.error('Error creating session:', error)
      setLoading(false)
      return
    }

    const newSessionId = data[0].id
    setGameSessionId(newSessionId)
    setMessages([])

    await processTurn([], newSessionId)
    setLoading(false)
  }

  // Game loop: stream AI, then persist
  const processTurn = async (currentHistory, sessionId) => {
    setLoading(true)

    let full = ''
    try {
      const stream = streamAIResponse(
        currentHistory.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))
      )
      if (stream && stream[Symbol.asyncIterator]) {
        for await (const partial of stream) {
          full = partial
          setMessages((prev) => {
            const base = prev.filter((x) => x.role !== 'ai-temp')
            return [...base, { role: 'ai-temp', content: partial }]
          })
        }
      }
    } catch {}

    if (!full) {
      full = await fetchAIResponse(
        currentHistory.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))
      )
      setMessages((prev) => [...prev, { role: 'ai', content: full }])
    } else {
      setMessages((prev) => {
        const base = prev.filter((x) => x.role !== 'ai-temp')
        return [...base, { role: 'ai', content: full }]
      })
    }

    await supabase.from('chat_messages').insert([
      { session_id: sessionId, role: 'ai', content: full },
    ])

    setLoading(false)
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const userText = input
    setInput('')

    const newHistory = [...messages.filter((m) => m.role !== 'ai-temp'), { role: 'user', content: userText }]
    setMessages(newHistory)

    await supabase.from('chat_messages').insert([
      { session_id: gameSessionId, role: 'user', content: userText },
    ])

    await processTurn(newHistory, gameSessionId)
  }

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="container-fluid min-vh-100 d-flex flex-column bg-body">
      {/* Header */}
      <div className="navbar navbar-expand-lg bg-body-tertiary shadow-sm mb-3">
        <a className="navbar-brand" href="#">Case Study Simulator</a>
        <div className="ms-auto d-flex gap-2 align-items-center">
          <div className="bootstrap-dark-theme"></div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('llm:configure'))} className="btn btn-outline-secondary btn-sm">Configure LLM</button>
          <button onClick={() => startNewGame()} disabled={loading} className="btn btn-success btn-sm">New Case</button>
          <button onClick={openProfile} className="btn btn-outline-primary btn-sm">Profile</button>
          <button onClick={() => supabase.auth.signOut()} className="btn btn-outline-danger btn-sm">Sign Out</button>
        </div>
      </div>

      {/* Game Area */}
      {!gameSessionId ? (
        <div className="flex-1 d-flex align-items-center justify-content-center">
          <button onClick={startNewGame} className="btn btn-primary btn-lg shadow">Start New Case Study</button>
        </div>
      ) : (
        <>
          {/* Chat Window */}
          <div className="flex-1 overflow-auto card shadow-sm mb-3 p-3">
            {messages.map((msg, i) => (
              <div key={i} className={`mb-2 d-flex ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
                <div className={`p-2 rounded ${msg.role === 'user' ? 'bg-primary text-white' : (msg.role === 'ai-temp' ? 'bg-light text-secondary' : 'bg-light text-dark')}`} style={{ maxWidth: '80%' }}>
                  <strong>{msg.role === 'ai' || msg.role === 'ai-temp' ? 'Advisor' : 'You'}: </strong>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && <div className="text-muted small">Analyzing market data...</div>}
            <div ref={bottomRef}></div>
          </div>

          {/* Input Area */}
          <div className="ms-auto d-flex gap-2 align-items-center">
            <div className="bootstrap-dark-theme"></div>
            <button onClick={() => window.dispatchEvent(new CustomEvent('llm:configure'))} className="btn btn-outline-secondary btn-sm">Configure LLM</button>
            <input
              type="text"
              className="form-control form-control-lg"
              placeholder="What is your decision?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={loading}
            />
            <button onClick={handleSend} disabled={loading} className="btn btn-primary">Send</button>
          </div>
        </>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <div>
          <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,.4)' }}>
            <div className="modal-dialog modal-dialog-scrollable modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Your Sessions</h5>
                  <button type="button" className="btn-close" onClick={closeProfile}></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-5">
                      <div className="list-group small">
                        {loadingSessions && <div className="text-muted">Loading sessions?</div>}
                        {!loadingSessions && sessions.length === 0 && (
                          <div className="text-muted">No sessions found</div>
                        )}
                        {sessions.map((s) => (
                          <button
                            key={s.id}
                            className={`list-group-item list-group-item-action ${selectedSession?.id === s.id ? 'active' : ''}`}
                            onClick={() => viewSession(s)}
                          >
                            <div className="d-flex justify-content-between">
                              <div>Session {String(s.id).slice(0, 8)}</div>
                              <small>{s.created_at ? new Date(s.created_at).toLocaleString() : ''}</small>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="col-7">
                      {!selectedSession && <div className="text-muted">Select a session to view transcript</div>}
                      {selectedSession && (
                        <div className="border rounded p-2" style={{ maxHeight: 400, overflow: 'auto' }}>
                          {loadingMessages && <div className="text-muted">Loading transcript?</div>}
                          {!loadingMessages && selectedMessages.map((m, i) => (
                            <div key={i} className="mb-2">
                              <strong>{m.role === 'ai' ? 'Advisor' : 'You'}:</strong> {m.content}
                              <div className="text-muted" style={{ fontSize: '0.75rem' }}>{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={closeProfile}>Close</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </div>
      )}
    </div>
  )
}
