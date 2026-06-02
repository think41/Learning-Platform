import { useState } from 'react'
import { CheckCircle, XCircle, ChevronDown, ChevronRight, BookOpen, Clock, Users, RotateCcw, Check,
         FileQuestion, ClipboardList, Sparkles, RefreshCw } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

// ── Markdown renderer ─────────────────────────────────────────────────────────

function MarkdownView({ content }) {
  return (
    <div className="prose text-sm">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }) {
            const lang = /language-(\w+)/.exec(className || '')?.[1]
            return !inline && lang ? (
              <SyntaxHighlighter style={oneLight} language={lang} PreTag="div" {...props}>
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className="bg-gray-100 text-blue-700 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}

// ── Skill badge ───────────────────────────────────────────────────────────────

function SkillBadge({ level }) {
  const map = {
    beginner:     'bg-green-50 text-green-700 border-green-200',
    intermediate: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    advanced:     'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${map[level] || map.beginner}`}>
      {level}
    </span>
  )
}

// ── Critic badge ──────────────────────────────────────────────────────────────

function CriticReport({ critic }) {
  const [open, setOpen] = useState(false)
  if (!critic) return null
  const issues = [
    ...critic.flagged_claims.map(c => ({ type: 'claim', text: c })),
    ...critic.out_of_order_concepts.map(c => ({ type: 'order', text: c })),
    ...critic.style_violations.map(c => ({ type: 'style', text: c })),
  ]
  return (
    <div className={`rounded-lg border text-xs ${critic.passed
      ? 'bg-green-50 border-green-200'
      : 'bg-amber-50 border-amber-200'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 font-medium"
      >
        <span className={`flex items-center gap-1.5 ${critic.passed ? 'text-green-700' : 'text-amber-700'}`}>
          {critic.passed
            ? <CheckCircle size={14} />
            : <XCircle size={14} />}
          Critic review — {critic.passed ? 'Passed' : 'Needs attention'}
        </span>
        {issues.length > 0 && (open
          ? <ChevronDown size={13} className="text-gray-400" />
          : <ChevronRight size={13} className="text-gray-400" />)}
      </button>
      {open && issues.length > 0 && (
        <ul className="px-3 pb-2 space-y-1">
          {issues.map((i, idx) => (
            <li key={idx} className="flex gap-1.5 text-gray-600">
              <span className="text-amber-500 mt-0.5">•</span>
              <span>[{i.type}] {i.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Empty placeholder ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-10 text-gray-400">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
        <BookOpen size={28} className="text-brand-500" />
      </div>
      <p className="text-base font-medium text-gray-600 mb-2">Your course plan will appear here</p>
      <p className="text-sm leading-relaxed">
        Chat with the AI to describe your course topic, target audience,
        and any reference materials. The plan will render live as you chat.
      </p>
    </div>
  )
}

// ── Plan view (plan_drafted) ──────────────────────────────────────────────────

function Module({ mod, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const mins = mod.duration_minutes
  const hrs  = mins >= 60 ? `${(mins / 60).toFixed(1)}h` : `${mins}m`

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {mod.number}
          </span>
          <span className="text-sm font-medium text-gray-800">{mod.title}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0 ml-3">
          <Clock size={12} />
          <span>{hrs}</span>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {open && (
        <ul className="divide-y divide-gray-100">
          {(mod.submodules || []).map((sub, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{sub.title}</p>
                {sub.learning_objectives?.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {sub.learning_objectives.map((o, j) => (
                      <li key={j} className="text-xs text-gray-500 flex gap-1">
                        <span>→</span><span>{o}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {sub.duration_minutes > 0 && (
                <span className="text-xs text-gray-400 shrink-0">{sub.duration_minutes}m</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PlanView({ plan, loading, onApprovePlan, readOnly = false }) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-xs font-medium text-brand-600 uppercase tracking-wide mb-1">Course Plan</p>
        <h2 className="text-lg font-bold text-gray-900">{plan.title}</h2>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {plan.skill_level && <SkillBadge level={plan.skill_level} />}
          {plan.total_duration_hours > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={12} />{plan.total_duration_hours}h total
            </span>
          )}
          {plan.target_audience && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Users size={12} />{plan.target_audience}
            </span>
          )}
        </div>
        {plan.version > 1 && (
          <span className="text-xs text-gray-400 mt-1 inline-block">v{plan.version}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {plan.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{plan.description}</p>
        )}

        {plan.learning_objectives?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              What you'll learn
            </p>
            <ul className="space-y-1.5">
              {plan.learning_objectives.map((obj, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                  {obj}
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan.modules?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {plan.modules.length} Module{plan.modules.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-2">
              {plan.modules.map((mod, i) => (
                <Module key={i} mod={mod} defaultOpen={i === 0} />
              ))}
            </div>
          </div>
        )}
      </div>

      {!readOnly && (
      <div className="px-5 py-4 border-t border-gray-100">
        <button
          onClick={onApprovePlan}
          disabled={loading}
          className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm
            hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating first section…' : 'Approve Plan & Generate Content →'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          Or keep chatting to refine the plan first
        </p>
      </div>
      )}
    </div>
  )
}

// ── Section review (content state) ───────────────────────────────────────────

function SectionReview({ currentSection, sections, briefIndex, totalBriefs, loading, onApproveSection, onRevise }) {
  const [revising, setRevising]     = useState(false)
  const [reviseNote, setReviseNote] = useState('')
  const [viewingId, setViewingId]   = useState(null)   // null = the section under review
  const progress = totalBriefs > 0 ? ((briefIndex) / totalBriefs) * 100 : 0

  const approved   = Object.values(sections || {})
  const onCurrent  = !viewingId
  const viewing    = onCurrent ? currentSection : (sections[viewingId] || currentSection)

  const submitRevise = () => {
    if (!reviseNote.trim()) return
    onRevise(reviseNote.trim())
    setRevising(false)
    setReviseNote('')
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Progress */}
      <div className="px-5 py-3 border-b border-gray-100 space-y-2">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span className="font-medium">Content generation</span>
          <span>{briefIndex}/{totalBriefs} sections approved</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-brand-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {!currentSection && loading && (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Generating section…</p>
        </div>
      )}

      {currentSection && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Top section nav */}
          <div className="flex gap-2 px-4 py-2.5 border-b border-gray-100 overflow-x-auto bg-gray-50 shrink-0">
            {approved.map((sec, i) => (
              <button
                key={sec.id}
                onClick={() => { setViewingId(sec.id); setRevising(false) }}
                title={sec.title}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                  whitespace-nowrap shrink-0 border transition-colors
                  ${viewingId === sec.id
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}
              >
                <CheckCircle size={12} className={viewingId === sec.id ? 'text-white' : 'text-green-500'} />
                <span className="max-w-[120px] truncate">{i + 1}. {sec.title}</span>
              </button>
            ))}
            {/* Current (under review) */}
            <button
              onClick={() => { setViewingId(null); setRevising(false) }}
              title={currentSection.title}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                whitespace-nowrap shrink-0 border transition-colors
                ${onCurrent
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}
            >
              <RotateCcw size={12} className={onCurrent ? 'text-white' : 'text-amber-500'} />
              <span className="max-w-[120px] truncate">{approved.length + 1}. {currentSection.title}</span>
            </button>
          </div>

          {/* Main content */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Section meta */}
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-xs text-brand-600 font-medium uppercase tracking-wide">
                  Module {viewing.module_number}
                </p>
                {onCurrent ? (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-medium">
                    Under review
                  </span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200 font-medium">
                    Approved · read-only
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-gray-900">{viewing.title}</h3>
              <div className="mt-2">
                <CriticReport critic={viewing.critic} />
              </div>
            </div>

            {/* Section content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <MarkdownView content={viewing.content} />
            </div>

            {/* Actions — only for the section under review */}
            {onCurrent ? (
              <div className="px-5 py-4 border-t border-gray-100 space-y-2">
                {!revising ? (
                  <div className="flex gap-2">
                    <button
                      onClick={onApproveSection}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white
                        rounded-xl font-medium text-sm hover:bg-green-700 transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check size={15} />
                      Approve Section
                    </button>
                    <button
                      onClick={() => setRevising(true)}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 text-gray-700
                        rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCcw size={14} />
                      Revise
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={reviseNote}
                      onChange={e => setReviseNote(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          submitRevise()
                        }
                      }}
                      placeholder="Describe what to change… (Enter to submit, Shift+Enter for new line)"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none
                        focus:outline-none focus:ring-2 focus:ring-brand-500"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={submitRevise}
                        disabled={!reviseNote.trim() || loading}
                        className="flex-1 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium
                          hover:bg-brand-700 transition-colors disabled:opacity-50"
                      >
                        Submit Revision
                      </button>
                      <button
                        onClick={() => { setRevising(false); setReviseNote('') }}
                        className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">This section is approved and locked.</span>
                <button
                  onClick={() => setViewingId(null)}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Back to current section →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Quiz renderer ─────────────────────────────────────────────────────────────

function QuizView({ quiz, onRegenerate, loading }) {
  const [revealed, setRevealed] = useState({})
  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs text-brand-600 font-medium mb-1">Module {quiz.module_number} · Quiz</p>
          <h2 className="text-2xl font-bold text-gray-900">{quiz.module_title}</h2>
          <p className="text-sm text-gray-500 mt-1">{quiz.questions.length} questions</p>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg
              text-xs font-medium hover:bg-gray-50 disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={13} /> Regenerate
          </button>
        )}
      </div>

      <div className="space-y-4">
        {quiz.questions.map((q, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{q.question}</p>
                <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                  {q.type === 'multiple_choice' ? 'Multiple choice' : 'Short answer'}
                </span>
              </div>
            </div>

            {q.options?.length > 0 && (
              <ul className="mt-3 ml-8 space-y-1.5">
                {q.options.map((opt, j) => {
                  const isAnswer = revealed[i] && opt === q.answer
                  return (
                    <li key={j}
                      className={`text-sm px-3 py-1.5 rounded-lg border
                        ${isAnswer
                          ? 'bg-green-50 border-green-300 text-green-800 font-medium'
                          : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      {String.fromCharCode(65 + j)}. {opt}
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="ml-8 mt-3">
              <button
                onClick={() => setRevealed(r => ({ ...r, [i]: !r[i] }))}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                {revealed[i] ? 'Hide answer' : 'Show answer'}
              </button>
              {revealed[i] && (
                <div className="mt-2 text-sm bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800"><strong>Answer:</strong> {q.answer}</p>
                  {q.explanation && <p className="text-gray-600 mt-1 text-xs">{q.explanation}</p>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Final assignment renderer ──────────────────────────────────────────────────

function AssignmentView({ assignment, onRegenerate, loading }) {
  const Section = ({ title, items }) => items?.length > 0 && (
    <div className="mb-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-700">
            <span className="text-brand-400 mt-0.5">•</span>{it}
          </li>
        ))}
      </ul>
    </div>
  )
  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs text-brand-600 font-medium mb-1">Final Assignment · Capstone</p>
          <h2 className="text-2xl font-bold text-gray-900">{assignment.title}</h2>
          {assignment.estimated_hours > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <Clock size={12} />~{assignment.estimated_hours}h
            </span>
          )}
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg
              text-xs font-medium hover:bg-gray-50 disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={13} /> Regenerate
          </button>
        )}
      </div>

      {assignment.overview && (
        <p className="text-sm text-gray-600 leading-relaxed mb-5">{assignment.overview}</p>
      )}
      <Section title="Tasks" items={assignment.tasks} />
      <Section title="Deliverables" items={assignment.deliverables} />
      <Section title="Evaluation criteria" items={assignment.evaluation_criteria} />
    </div>
  )
}

// ── Course view (done state) ──────────────────────────────────────────────────

function CourseView({ plan, sections, quizzes, finalAssignment, loading, onRegenerateQuiz, onRegenerateAssignment }) {
  const allSections = Object.values(sections)
  const quizByModule = Object.fromEntries((quizzes || []).map(q => [q.module_number, q]))
  const [selectedId, setSelectedId] = useState(allSections[0]?.id || null)

  const modules = (plan?.modules || []).map(mod => ({
    ...mod,
    sectionItems: allSections.filter(s => s.module_number === mod.number),
  }))

  // Resolve what to render based on the selected key
  let body = null
  if (selectedId === 'assignment' && finalAssignment) {
    body = <AssignmentView assignment={finalAssignment} loading={loading} onRegenerate={onRegenerateAssignment} />
  } else if (typeof selectedId === 'string' && selectedId.startsWith('quiz-')) {
    const n = Number(selectedId.slice(5))
    const quiz = quizByModule[n]
    body = quiz ? <QuizView quiz={quiz} loading={loading} onRegenerate={() => onRegenerateQuiz?.(n)} /> : null
  } else if (sections[selectedId]) {
    const sel = sections[selectedId]
    body = (
      <>
        <p className="text-xs text-brand-600 font-medium mb-1">Module {sel.module_number}</p>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{sel.title}</h2>
        {sel.critic && <CriticReport critic={sel.critic} />}
        <div className="mt-5"><MarkdownView content={sel.content} /></div>
      </>
    )
  }

  const navItem = (key, label, icon, color) => (
    <button
      key={key}
      onClick={() => setSelectedId(key)}
      className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors
        ${selectedId === key
          ? 'bg-brand-50 text-brand-700 border-r-2 border-brand-600'
          : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )

  return (
    <div className="flex flex-1 min-h-0">
      {/* Sidebar nav */}
      <div className="w-56 border-r border-gray-200 overflow-y-auto shrink-0 bg-gray-50">
        <div className="p-4 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Course Content</p>
          <p className="text-sm font-bold text-gray-900 mt-1 leading-tight">{plan?.title}</p>
        </div>
        <div className="py-2">
          {modules.map(mod => (
            <div key={mod.number} className="mb-1">
              <p className="px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Module {mod.number}: {mod.title}
              </p>
              {mod.sectionItems.map(sec =>
                navItem(sec.id, sec.title, <CheckCircle size={12} className="text-green-500 shrink-0" />)
              )}
              {quizByModule[mod.number] &&
                navItem(`quiz-${mod.number}`, 'Quiz',
                  <FileQuestion size={12} className="text-purple-500 shrink-0" />)}
            </div>
          ))}

          {finalAssignment && (
            <div className="mt-2 border-t border-gray-200 pt-2">
              {navItem('assignment', 'Final Assignment',
                <ClipboardList size={12} className="text-amber-500 shrink-0" />)}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {body ? (
        <div className="flex-1 overflow-y-auto px-8 py-6">{body}</div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Select an item to view
        </div>
      )}
    </div>
  )
}

// ── Assessment gate (assessment state) ─────────────────────────────────────────

function AssessmentGate({ loading, onGenerate }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center px-10">
      <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
        <Sparkles size={28} className="text-purple-500" />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">All content is ready</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-sm">
        Generate the assessments next — one quiz per module plus a single capstone
        final assignment covering the whole course.
      </p>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="px-6 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm
          hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center gap-2"
      >
        {loading
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
          : <><Sparkles size={16} /> Generate Assessments</>}
      </button>
    </div>
  )
}

// ── Root PlanPanel ────────────────────────────────────────────────────────────

export default function PlanPanel({ sessionData, loading, onApprovePlan, onApproveSection, onRevise,
                                    onGenerateAssessments, onRegenerateQuiz, onRegenerateAssignment }) {
  const { state, plan, sections, current_section, brief_index, total_briefs, quizzes, final_assignment } = sessionData
  const [contentTab, setContentTab] = useState('section')

  return (
    <div className="flex-1 flex flex-col bg-cream overflow-hidden">
      {state === 'done' ? (
        <>
          <div className="px-5 py-3 border-b border-gray-100 bg-green-50 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            <span className="text-sm font-medium text-green-700">
              Course complete — {Object.keys(sections).length} sections, {(quizzes || []).length} quizzes
            </span>
          </div>
          <CourseView
            plan={plan}
            sections={sections}
            quizzes={quizzes}
            finalAssignment={final_assignment}
            loading={loading}
            onRegenerateQuiz={onRegenerateQuiz}
            onRegenerateAssignment={onRegenerateAssignment}
          />
        </>
      ) : state === 'assessment' ? (
        <AssessmentGate loading={loading} onGenerate={onGenerateAssessments} />
      ) : state === 'content' ? (
        <>
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 shrink-0">
            <button
              onClick={() => setContentTab('section')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors
                ${contentTab === 'section'
                  ? 'text-brand-600 border-b-2 border-brand-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              Current Section
            </button>
            <button
              onClick={() => setContentTab('plan')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors
                ${contentTab === 'plan'
                  ? 'text-brand-600 border-b-2 border-brand-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              View Plan
            </button>
          </div>

          {contentTab === 'section' ? (
            <SectionReview
              currentSection={current_section}
              sections={sections}
              briefIndex={brief_index}
              totalBriefs={total_briefs}
              loading={loading}
              onApproveSection={onApproveSection}
              onRevise={onRevise}
            />
          ) : (
            <PlanView plan={plan} loading={false} onApprovePlan={null} readOnly />
          )}
        </>
      ) : plan ? (
        <PlanView plan={plan} loading={loading} onApprovePlan={onApprovePlan} />
      ) : (
        <EmptyState />
      )}
    </div>
  )
}
