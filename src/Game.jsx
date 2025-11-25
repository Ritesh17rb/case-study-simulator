import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { fetchAIResponse, streamAIResponse } from './aiService'

export default function Game({ session }) {
  const [gameSessionId, setGameSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  // 1. Initialize a new game session in Supabase
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
    
    // Trigger initial AI message
    await processTurn([], newSessionId)
    setLoading(false)
  }

  // 2. Handle the Game Loop (User input -> Save -> AI -> Save)
  const processTurn = async (currentHistory, sessionId) => {
    setLoading(true)

    // Stream AI response into UI if possible; else fall back to single response
    let full = ''
    try {
      const stream = streamAIResponse(
        currentHistory.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))
      )
      if (stream && stream[Symbol.asyncIterator]) {
        for await (const partial of stream) {
          full = partial
          // Show partial streaming content in UI
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
      // Show final
      setMessages((prev) => [...prev, { role: 'ai', content: full }])
    } else {
      // Replace temp with final
      setMessages((prev) => {
        const base = prev.filter((x) => x.role !== 'ai-temp')
        return [...base, { role: 'ai', content: full }]
      })
    }

    // Save AI Message to Supabase
    await supabase.from('chat_messages').insert([
      {
        session_id: sessionId,
        role: 'ai',
        content: full,
      },
    ])

    setLoading(false)
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const userText = input
    setInput('')
    
    // Update UI immediately
    const newHistory = [...messages.filter((m) => m.role !== 'ai-temp'), { role: 'user', content: userText }]
    setMessages(newHistory)

    // Save User Message to Supabase
    await supabase.from('chat_messages').insert([
      {
        session_id: gameSessionId,
        role: 'user',
        content: userText,
      },
    ])

    // Trigger AI Turn
    await processTurn(newHistory, gameSessionId)
  }

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="container-fluid min-vh-100 d-flex flex-column bg-body">
      {/* Header */}
      <div className="navbar navbar-expand-lg bg-body-tertiary shadow-sm mb-3">
        <a className="navbar-brand" href="#">Case Study Simulator</a>
        <div className="ms-auto d-flex gap-2 align-items-center">          <div className="bootstrap-dark-theme"></div>
          <button onClick={() => window.dispatchEvent(new CustomEvent("llm:configure"))} className="btn btn-outline-secondary btn-sm">Configure LLM</button>
          <button onClick={() => startNewGame()} disabled={loading} className="btn btn-success btn-sm">New Case</button>
          <button onClick={() => supabase.auth.signOut()} className="btn btn-outline-danger btn-sm">Sign Out</button>
        </div>
      </div>

      {/* Game Area */}
      {!gameSessionId ? (
        <div className="flex-1 d-flex align-items-center justify-content-center">
          <button 
            onClick={startNewGame}
            className="btn btn-primary btn-lg shadow"
          >
            Start New Case Study
          </button>
        </div>
      ) : (
        <>
          {/* Chat Window */}
          <div className="flex-1 overflow-auto card shadow-sm mb-3">
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
          <div className="ms-auto d-flex gap-2 align-items-center">          <div className="bootstrap-dark-theme"></div>
          <button onClick={() => window.dispatchEvent(new CustomEvent("llm:configure"))} className="btn btn-outline-secondary btn-sm">Configure LLM</button>
            <input
              type="text"
              className="form-control form-control-lg"
              placeholder="What is your decision?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={loading}
            />
            <button 
              onClick={handleSend}
              disabled={loading}
              className="btn btn-primary"
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  )
}



