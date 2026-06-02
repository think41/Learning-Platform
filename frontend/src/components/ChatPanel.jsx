import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip } from 'lucide-react'

function TypingDots() {
  return (
    <div className="flex items-end gap-1 px-4 py-3">
      <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
        AI
      </div>
      <div className="ml-2 bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
        <span className="w-2 h-2 bg-gray-400 rounded-full dot-1 inline-block" />
        <span className="w-2 h-2 bg-gray-400 rounded-full dot-2 inline-block" />
        <span className="w-2 h-2 bg-gray-400 rounded-full dot-3 inline-block" />
      </div>
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-1">
        <div className="max-w-[80%] bg-brand-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
          {msg.text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 px-4 py-1">
      <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
        AI
      </div>
      <div className="max-w-[80%] bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
        {msg.text}
      </div>
    </div>
  )
}

export default function ChatPanel({ messages, loading, sessionState, hasPlan, onSend, onUpload, disabled }) {
  const [input, setInput]   = useState('')
  const bottomRef           = useRef(null)
  const fileRef             = useRef(null)
  const textareaRef         = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const submit = () => {
    const msg = input.trim()
    if (!msg || disabled) return
    setInput('')
    onSend(msg)
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    e.target.value = ''
  }

  const inContent = sessionState === 'content'
  const isDone    = sessionState === 'done'

  return (
    <div className="w-[42%] min-w-[320px] flex flex-col border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-medium text-gray-700">Chat with AI</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {inContent
            ? 'Review sections using the panel →'
            : isDone
            ? 'Course complete — view it on the right'
            : 'Describe your course idea, upload references, then approve the plan'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 text-gray-400">
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mb-3">
              <span className="text-2xl">🎓</span>
            </div>
            <p className="text-sm">Start a conversation to build your course</p>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        {loading && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3 space-y-2">
        {/* Hint when in content phase */}
        {inContent && hasPlan && (
          <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
            Use <strong>Approve</strong> or <strong>Revise</strong> on the right panel, or type here to chat.
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* File upload */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            title="Upload reference file (PDF, DOCX, PPTX, TXT)"
            className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Paperclip size={18} />
          </button>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.pptx,.txt,.md" onChange={onFile} />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={disabled && !loading ? 'Connecting...' : 'Type a message…'}
            disabled={disabled}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
              disabled:bg-gray-50 disabled:cursor-not-allowed
              max-h-32 overflow-y-auto leading-relaxed"
            style={{ minHeight: '38px' }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
            }}
          />

          {/* Send */}
          <button
            onClick={submit}
            disabled={disabled || !input.trim()}
            className="p-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
