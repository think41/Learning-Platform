import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, FileText, X } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Logo from './Logo'

const EXAMPLES = [
  'Intro to Python for absolute beginners',
  'JavaScript fundamentals for web development',
  'Build REST APIs with Node.js and Express',
  'Git and GitHub essentials for developers',
]

// Compact markdown styling tuned for chat bubbles
const chatComponents = {
  p:      ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em:     ({ children }) => <em className="italic">{children}</em>,
  // Render list items as compact "boxes" — nice for clarifying-question lists
  ul:     ({ children }) => <ul className="my-2 space-y-1.5 list-none">{children}</ul>,
  ol:     ({ children, start }) => <ol className="my-2 space-y-1.5 list-none" start={start}>{children}</ol>,
  li:     ({ children }) => (
    <li className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">{children}</li>
  ),
  code:   ({ children }) => <code className="bg-gray-100 text-brand-700 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
  a:      ({ children, href }) => <a href={href} className="text-brand-600 underline" target="_blank" rel="noreferrer">{children}</a>,
  h1:     ({ children }) => <p className="font-semibold text-gray-900 mb-1">{children}</p>,
  h2:     ({ children }) => <p className="font-semibold text-gray-900 mb-1">{children}</p>,
  h3:     ({ children }) => <p className="font-semibold text-gray-900 mb-1">{children}</p>,
}

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
        <div className="max-w-[80%] flex flex-col items-end gap-1.5">
          {msg.files?.map((name, i) => (
            <div key={i} className="flex items-center gap-2 bg-brand-700 text-white rounded-xl px-3 py-2 text-xs">
              <FileText size={14} className="shrink-0" />
              <span className="truncate max-w-[180px]">{name}</span>
            </div>
          ))}
          {msg.text && (
            <div className="bg-brand-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
              {msg.text}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 px-4 py-1">
      <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
        AI
      </div>
      <div className="max-w-[80%] bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm text-sm text-gray-800 leading-relaxed">
        <Markdown remarkPlugins={[remarkGfm]} components={chatComponents}>
          {msg.text}
        </Markdown>
      </div>
    </div>
  )
}

export default function ChatPanel({ messages, loading, sessionState, hasPlan, uploadedFiles = [], onSend, onUpload, disabled }) {
  const [input, setInput]               = useState('')
  const [pendingFiles, setPendingFiles] = useState([])
  const bottomRef           = useRef(null)
  const fileRef             = useRef(null)
  const textareaRef         = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const submit = () => {
    if (disabled) return
    const msg = input.trim()
    if (pendingFiles.length) {
      // Send the attached files together with whatever text was typed
      onUpload(pendingFiles, msg)
      setPendingFiles([])
      setInput('')
    } else if (msg) {
      onSend(msg)
      setInput('')
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const onFile = (e) => {
    const picked = Array.from(e.target.files || [])
    if (picked.length) {
      // stage them — don't send until the user hits send; de-dupe by name+size
      setPendingFiles(prev => {
        const seen = new Set(prev.map(f => f.name + f.size))
        return [...prev, ...picked.filter(f => !seen.has(f.name + f.size))]
      })
    }
    e.target.value = ''
  }

  const removeFile = (idx) => setPendingFiles(prev => prev.filter((_, i) => i !== idx))

  const canSend = !disabled && (!!input.trim() || pendingFiles.length > 0)

  const inContent = sessionState === 'content'
  const isDone    = sessionState === 'done'
  const started   = messages.some(m => m.role === 'user')

  return (
    <div className="w-[42%] min-w-[320px] flex flex-col border-r border-gray-200 bg-cream">
      {/* Header — only once the conversation has started */}
      {started && (
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-700">Chat with AI</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {inContent
              ? 'Review sections using the panel →'
              : isDone
              ? 'Course complete — view it on the right'
              : 'Describe your course idea, upload references, then approve the plan'}
          </p>

          {/* Persistent uploaded sources */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-xs text-gray-400">Sources:</span>
              {uploadedFiles.map((name, i) => (
                <span
                  key={i}
                  title={name}
                  className="flex items-center gap-1 bg-gray-100 text-gray-600 rounded-md px-2 py-0.5 text-xs"
                >
                  <FileText size={11} className="text-brand-500 shrink-0" />
                  <span className="truncate max-w-[120px]">{name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages / Hero */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1">
        {!started ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <Logo size={48} />
            <h1 className="mt-5 text-3xl font-bold text-gray-900 tracking-tight">
              What will you teach?
            </h1>
            <p className="text-gray-500 mt-2 text-sm max-w-sm">
              Describe your course and the AI will plan it out — you can refine it as you go.
            </p>

            <div className="mt-7 w-full max-w-sm">
              <p className="text-xs font-medium text-gray-400 mb-2">Try an example</p>
              <div className="flex flex-col gap-2">
                {EXAMPLES.map(ex => (
                  <button
                    key={ex}
                    onClick={() => !disabled && onSend(ex)}
                    disabled={disabled}
                    className="text-left px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600
                      hover:border-brand-300 hover:text-brand-700 hover:shadow-sm transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            {loading && <TypingDots />}
          </>
        )}
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

        {/* Pending attachment chips */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 max-w-full">
                <FileText size={15} className="text-brand-600 shrink-0" />
                <span className="text-xs text-gray-700 truncate max-w-[160px]">{f.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-gray-400 hover:text-gray-700 shrink-0"
                  title="Remove attachment"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* File upload */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            title="Attach reference file (PDF, DOCX, PPTX, TXT)"
            className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Paperclip size={18} />
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.docx,.pptx,.txt,.md" onChange={onFile} />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={disabled && !loading ? 'Connecting...' : pendingFiles.length ? 'Add a message about these files…' : !started ? 'Describe your course idea, CourseBuilder will bring it to life…' : 'Type a message…'}
            disabled={disabled}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm
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
            disabled={!canSend}
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
