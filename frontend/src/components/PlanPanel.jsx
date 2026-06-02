import { useState } from 'react'
import { CheckCircle, XCircle, ChevronDown, ChevronRight, BookOpen, Clock, Users, RotateCcw, Check } from 'lucide-react'
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
    <div className="flex flex-col h-full">
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

function SectionReview({ currentSection, briefIndex, totalBriefs, loading, onApproveSection, onRevise }) {
  const [revising, setRevising]   = useState(false)
  const [reviseNote, setReviseNote] = useState('')
  const progress = totalBriefs > 0 ? ((briefIndex) / totalBriefs) * 100 : 0

  const submitRevise = () => {
    if (!reviseNote.trim()) return
    onRevise(reviseNote.trim())
    setRevising(false)
    setReviseNote('')
  }

  return (
    <div className="flex flex-col h-full">
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
        <>
          {/* Section meta */}
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-brand-600 font-medium uppercase tracking-wide mb-0.5">
              Section {briefIndex + 1} of {totalBriefs} · Module {currentSection.module_number}
            </p>
            <h3 className="text-base font-bold text-gray-900">{currentSection.title}</h3>
            <div className="mt-2">
              <CriticReport critic={currentSection.critic} />
            </div>
          </div>

          {/* Section content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <MarkdownView content={currentSection.content} />
          </div>

          {/* Actions */}
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
                  placeholder="Describe what to change…"
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
        </>
      )}
    </div>
  )
}

// ── Course view (done state) ──────────────────────────────────────────────────

function CourseView({ plan, sections }) {
  // Build module → section mapping from the plan + sections store
  const allSections = Object.values(sections)
  const [selectedId, setSelectedId] = useState(allSections[0]?.id || null)
  const selected = sections[selectedId]

  // Group by module
  const modules = (plan?.modules || []).map(mod => ({
    ...mod,
    sectionItems: allSections.filter(s => s.module_number === mod.number),
  }))

  return (
    <div className="flex h-full">
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
              {mod.sectionItems.map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setSelectedId(sec.id)}
                  className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors
                    ${selectedId === sec.id
                      ? 'bg-brand-50 text-brand-700 border-r-2 border-brand-600'
                      : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <CheckCircle size={12} className="text-green-500 shrink-0" />
                  <span className="truncate">{sec.title}</span>
                </button>
              ))}
              {mod.sectionItems.length === 0 && (
                <p className="px-4 py-1 text-xs text-gray-400 italic">No sections generated</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      {selected ? (
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-3xl">
            <p className="text-xs text-brand-600 font-medium mb-1">
              Module {selected.module_number}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{selected.title}</h2>
            {selected.critic && <CriticReport critic={selected.critic} />}
            <div className="mt-5">
              <MarkdownView content={selected.content} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Select a section to read
        </div>
      )}
    </div>
  )
}

// ── Root PlanPanel ────────────────────────────────────────────────────────────

export default function PlanPanel({ sessionData, loading, onApprovePlan, onApproveSection, onRevise }) {
  const { state, plan, sections, current_section, brief_index, total_briefs } = sessionData
  const [contentTab, setContentTab] = useState('section')

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {state === 'done' ? (
        <>
          <div className="px-5 py-3 border-b border-gray-100 bg-green-50 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            <span className="text-sm font-medium text-green-700">
              Course complete — {Object.keys(sections).length} sections approved
            </span>
          </div>
          <CourseView plan={plan} sections={sections} />
        </>
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
              briefIndex={brief_index}
              totalBriefs={total_briefs}
              loading={loading}
              onApproveSection={onApproveSection}
              onRevise={onRevise}
            />
          ) : (
            <div className="flex-1 overflow-y-auto">
              <PlanView plan={plan} loading={false} onApprovePlan={null} readOnly />
            </div>
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
