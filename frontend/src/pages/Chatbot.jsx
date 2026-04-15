import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import JarvisToggle from "../components/JarvisToggle"

const INITIAL_BOT_MESSAGE = {
  sender: "bot",
  text: "Hi! I am **Resume AI**. I can now give personalized advice using your resume, ATS analysis, and selected job description.",
}

export default function Chatbot({ inline = false }) {
  const [openChat, setOpenChat] = useState(inline)
  const [messages, setMessages] = useState([INITIAL_BOT_MESSAGE])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const endRef = useRef(null)

  const API_BASE =
    import.meta.env.MODE === "development"
      ? ""
      : (import.meta.env.VITE_API_URL || "").replace(/\/$/, "")

  const CHAT_URL = `${API_BASE}/api/chat`

  useEffect(() => {
    if (inline) {
      setOpenChat(true)
    }
  }, [inline])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, openChat])

  const resetConversation = () => {
    setMessages([INITIAL_BOT_MESSAGE])
    setInput("")
    setError("")
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    setError("")
    setInput("")
    setSending(true)

    setMessages((prev) => [...prev, { sender: "user", text }])

    try {
      const resumeContext =
        localStorage.getItem("generatedResume") ||
        localStorage.getItem("importedResumeText") ||
        ""

      const atsContext = localStorage.getItem("atsAnalysis") || ""
      const resumeDbId = localStorage.getItem("resumeDbId") || ""
      const jobDescription =
        localStorage.getItem("importedJobDesc") ||
        sessionStorage.getItem("jobDesc") ||
        ""

      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          resumeContext,
          atsContext,
          resumeDbId,
          jobDescription,
        }),
      })

      const raw = await res.text()
      let data = {}
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        data = {}
      }

      if (!res.ok) {
        const msg = data?.error?.message || data?.error || raw || `HTTP ${res.status}`
        throw new Error(msg)
      }

      const reply =
        data?.reply ??
        data?.message ??
        data?.text ??
        "I received your request, but no reply text was returned."

      setMessages((prev) => [...prev, { sender: "bot", text: reply }])
    } catch (e) {
      setError(e?.message || "Failed to fetch")
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Connection lost. Please check backend status and try again.",
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const containerStyle = inline
    ? { position: "static", width: "100%", zIndex: "auto" }
    : undefined

  const windowStyle = inline
    ? {
        position: "relative",
        bottom: "auto",
        right: "auto",
        width: "100%",
        maxWidth: "100%",
        height: "560px",
      }
    : undefined

  return (
    <div className="chatbot-container" style={containerStyle}>
      {inline || openChat ? (
        <div className="chatbot-window" style={windowStyle}>
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar-dot" />
              <div>
                <div className="chatbot-title">Resume AI</div>
                <div className="chatbot-subtitle">Personalized Career Intelligence</div>
              </div>
            </div>

            {inline ? (
              <button
                type="button"
                aria-label="Reset chat"
                className="chatbot-close-btn"
                onClick={resetConversation}
                title="Reset conversation"
              >
                reset
              </button>
            ) : (
              <button
                type="button"
                aria-label="Close chat"
                className="chatbot-close-btn"
                onClick={() => setOpenChat(false)}
              >
                x
              </button>
            )}
          </div>

          <div className="chatbot-body">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble-wrapper ${msg.sender}`}>
                {msg.sender === "bot" && <div className="chat-avatar bot-avatar">AI</div>}
                <div className={`chat-bubble ${msg.sender}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                </div>
                {msg.sender === "user" && <div className="chat-avatar user-avatar">You</div>}
              </div>
            ))}

            {sending && (
              <div className="chat-bubble-wrapper bot">
                <div className="chat-avatar bot-avatar">AI</div>
                <div className="chat-bubble bot typing-bubble">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {error && <div className="chatbot-error">{error}</div>}

          <div className="chatbot-input">
            <input
              type="text"
              placeholder={sending ? "Resume AI is thinking..." : "Ask for detailed improvements..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="chatbot-send-btn"
            >
              {sending ? (
                <span className="send-spinner" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="chatbot-tooltip">
            Chat with <strong>Resume AI</strong>
          </div>
          <JarvisToggle onClick={() => setOpenChat(true)} />
        </>
      )}
    </div>
  )
}
