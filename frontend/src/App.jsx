import { useState, useEffect, useRef } from 'react'
import ChatPanel from './components/ChatPanel'
import PlanPanel from './components/PlanPanel'
import Logo from './components/Logo'
import { createSession, sendChat, approvePlan, approveSection, reviseSection, uploadFiles,
         generateAssessments, regenerateQuiz, regenerateAssignment, exportSession } from './api'

const INIT_STATE = {
  state: 'clarifying',
  plan: null,
  sections: {},
  current_section: null,
  brief_index: 0,
  total_briefs: 0,
  uploaded_files: [],
  quizzes: [],
  final_assignment: null,
}

export default function App() {
  const [sessionId, setSessionId]     = useState(null)
  const [messages, setMessages]       = useState([])
  const [sessionData, setSessionData] = useState(INIT_STATE)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const initRef = useRef(false)

  const pushMsg = (role, text, extra = {}) =>
    setMessages(prev => [...prev, { role, text, ...extra, id: Date.now() + Math.random() }])

  const applyResponse = (data) => {
    if (data.reply) pushMsg('assistant', data.reply)
    setSessionData({
      state:           data.state,
      plan:            data.plan,
      sections:        data.sections,
      current_section: data.current_section,
      brief_index:     data.brief_index,
      total_briefs:    data.total_briefs,
      uploaded_files:  data.uploaded_files || [],
      quizzes:          data.quizzes || [],
      final_assignment: data.final_assignment || null,
    })
  }

  const withLoading = async (fn) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fn()
      applyResponse(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    withLoading(async () => {
      const data = await createSession()
      setSessionId(data.session_id)
      return data
    })
  }, [])

  const handleSend = (message) => {
    pushMsg('user', message)
    withLoading(() => sendChat(sessionId, message))
  }

  const handleUpload = (files, message = '') => {
    const names = Array.from(files).map(f => f.name)
    pushMsg('user', message, { files: names })
    withLoading(() => uploadFiles(sessionId, files, message))
  }

  const handleApprovePlan = () => {
    pushMsg('user', 'Approve plan')
    withLoading(() => approvePlan(sessionId))
  }

  const handleApproveSection = () => {
    pushMsg('user', 'Approve section')
    withLoading(() => approveSection(sessionId))
  }

  const handleRevise = (feedback) => {
    pushMsg('user', `Revise: ${feedback}`)
    withLoading(() => reviseSection(sessionId, feedback))
  }

  const handleGenerateAssessments = () => {
    pushMsg('user', 'Generate assessments')
    withLoading(() => generateAssessments(sessionId))
  }

  const handleRegenerateQuiz = (moduleNumber) =>
    withLoading(() => regenerateQuiz(sessionId, moduleNumber))

  const handleRegenerateAssignment = () =>
    withLoading(() => regenerateAssignment(sessionId))

  const handleExport = async () => {
    const data = await exportSession(sessionId)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'course_export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const disabled = !sessionId || loading

  return (
    <div className="flex flex-col h-screen bg-cream">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <span className="font-semibold text-gray-900">CourseBuilder</span>
          {sessionData.state !== 'clarifying' && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium
              bg-brand-50 text-brand-700 border border-brand-100 capitalize">
              {sessionData.state.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs text-red-500 max-w-xs truncate">{error}</span>
          )}
          {sessionData.state === 'done' && (
            <button
              onClick={handleExport}
              className="px-4 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium
                hover:bg-brand-700 transition-colors"
            >
              Export JSON
            </button>
          )}
        </div>
      </nav>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <ChatPanel
          messages={messages}
          loading={loading}
          sessionState={sessionData.state}
          hasPlan={!!sessionData.plan}
          uploadedFiles={sessionData.uploaded_files}
          onSend={handleSend}
          onUpload={handleUpload}
          disabled={disabled}
        />
        <PlanPanel
          sessionData={sessionData}
          loading={loading}
          onApprovePlan={handleApprovePlan}
          onApproveSection={handleApproveSection}
          onRevise={handleRevise}
          onGenerateAssessments={handleGenerateAssessments}
          onRegenerateQuiz={handleRegenerateQuiz}
          onRegenerateAssignment={handleRegenerateAssignment}
        />
      </div>
    </div>
  )
}
