import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Clock, Layers, CheckCircle, Lock, Play } from 'lucide-react'
import Logo from '../components/Logo'
import { getCourse } from '../api'
import { readProgress, flattenSteps, firstIncomplete } from '../learnProgress'

export default function CourseOverviewPage() {
  const { courseId }            = useParams()
  const navigate                = useNavigate()
  const [course, setCourse]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [progress, setProgress] = useState(readProgress(courseId))

  useEffect(() => {
    getCourse(courseId)
      .then(setCourse)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [courseId])

  useEffect(() => {
    setProgress(readProgress(courseId))
  }, [courseId])

  if (loading) {
    return (
      <Shell><p className="text-sm text-gray-500">Loading…</p></Shell>
    )
  }
  if (error) {
    return (
      <Shell><p className="text-sm text-red-500">{error}</p></Shell>
    )
  }
  if (!course) return null

  const modules         = course.plan?.modules || []
  const totalSubmodules = modules.reduce((acc, m) => acc + (m.submodules?.length || 0), 0)
  const completedCount  = (progress.completed_sections || []).length
  const ctaLabel        = progress.started ? 'Continue course' : 'Start course'
  const steps    = flattenSteps(modules, course.final_assignment)
  const next     = firstIncomplete(steps, progress)
  const finished = !next

  const handleStart = () => {
    // When finished, "Review" jumps back to the first section so the user can revisit anything.
    if (finished) {
      const firstSection = steps.find(s => s.kind === 'section')
      if (firstSection) navigate(`/learn/${courseId}/section/${firstSection.id}`)
      return
    }
    if (!next) return
    if (next.step.kind === 'section') {
      navigate(`/learn/${courseId}/section/${next.step.id}`)
    } else if (next.step.kind === 'quiz') {
      navigate(`/learn/${courseId}/quiz/${next.step.moduleNumber}`)
    } else if (next.step.kind === 'final') {
      navigate(`/learn/${courseId}/assignment`)
    }
  }

  return (
    <Shell>
      <Link to="/learn"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={14} /> Back to Library
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 p-7 mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-7 right-7 h-1 bg-gradient-to-r from-brand-400 to-brand-600 rounded-b-full" />

        {finished && (
          <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-1
            rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <CheckCircle size={12} /> Completed
          </span>
        )}

        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100
            flex items-center justify-center shrink-0">
            <BookOpen size={22} className="text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 leading-tight">{course.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              {course.total_duration_hours > 0 && (
                <span className="flex items-center gap-1 font-medium text-gray-600">
                  <Clock size={12} /> {course.total_duration_hours}h total
                </span>
              )}
              <span className="flex items-center gap-1">
                <Layers size={12} /> {modules.length} module{modules.length === 1 ? '' : 's'} · {totalSubmodules} section{totalSubmodules === 1 ? '' : 's'}
              </span>
              {progress.started && totalSubmodules > 0 && (
                <span className="text-brand-700 font-medium">
                  {completedCount}/{totalSubmodules} completed
                </span>
              )}
            </div>
          </div>
        </div>

        {course.description && (
          <p className="text-sm text-gray-700 leading-relaxed mb-5">{course.description}</p>
        )}

        <button
          onClick={handleStart}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-lg font-medium
            hover:bg-brand-700 transition-colors"
        >
          <Play size={16} /> {finished ? 'Review course' : ctaLabel}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-7">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Curriculum</h2>
        <ol className="space-y-5">
          {modules.map((m, mi) => {
            const moduleSubs = m.submodules || []
            const prevDone = mi === 0 || isModuleComplete(modules[mi - 1], progress)
            return (
              <li key={mi} className="border-l-2 pl-4 border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-400">MODULE {m.number}</span>
                  {!prevDone && <Lock size={12} className="text-gray-400" />}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{m.title}</h3>
                <ul className="space-y-1.5">
                  {moduleSubs.map((s, si) => {
                    const sid = `m${m.number}_s${si}`
                    const done = (progress.completed_sections || []).includes(sid)
                    const unlocked = prevDone && (si === 0 || (progress.completed_sections || [])
                      .includes(`m${m.number}_s${si - 1}`))
                    return (
                      <CurriculumRow
                        key={si}
                        to={unlocked ? `/learn/${courseId}/section/${sid}` : null}
                        done={done}
                        unlocked={unlocked}
                        label={s.title}
                      />
                    )
                  })}
                  {(() => {
                    const quizDone     = (progress.completed_quizzes || []).includes(m.number)
                    const quizUnlocked = isModuleSectionsDone(m, progress)
                    return (
                      <CurriculumRow
                        to={quizUnlocked ? `/learn/${courseId}/quiz/${m.number}` : null}
                        done={quizDone}
                        unlocked={quizUnlocked}
                        label={`Module ${m.number} quiz`}
                        italic
                      />
                    )
                  })()}
                </ul>
              </li>
            )
          })}
          {course.final_assignment?.title && (
            <li className="border-l-2 pl-4 border-gray-200">
              <div className="text-xs font-semibold text-gray-400 mb-2">FINAL ASSIGNMENT</div>
              <ul>
                <CurriculumRow
                  to={isCourseComplete(modules, progress) ? `/learn/${courseId}/assignment` : null}
                  done={!!progress.viewed_final}
                  unlocked={isCourseComplete(modules, progress)}
                  label={course.final_assignment.title}
                />
              </ul>
            </li>
          )}
        </ol>
      </div>
    </Shell>
  )
}

function CurriculumRow({ to, done, unlocked, label, italic = false }) {
  const icon = done
    ? <CheckCircle size={14} className="text-brand-600 shrink-0" />
    : unlocked
      ? <span className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0" />
      : <Lock size={14} className="text-gray-400 shrink-0" />

  const baseText = italic ? 'italic text-gray-500' : 'text-gray-700'
  const labelClass = done ? `${baseText} line-through opacity-70` : baseText

  const content = (
    <span className="flex items-center gap-2 text-sm">
      {icon}
      <span className={labelClass}>{label}</span>
    </span>
  )

  if (to) {
    return (
      <li>
        <Link to={to} className="block py-0.5 px-1 -mx-1 rounded hover:bg-brand-50/60 transition-colors">
          {content}
        </Link>
      </li>
    )
  }
  return <li className="py-0.5 px-1">{content}</li>
}

function isModuleSectionsDone(module_, progress) {
  const subs = module_.submodules || []
  if (subs.length === 0) return false
  return subs.every((_, si) =>
    (progress.completed_sections || []).includes(`m${module_.number}_s${si}`))
}

function isModuleComplete(module_, progress) {
  return isModuleSectionsDone(module_, progress)
    && (progress.completed_quizzes || []).includes(module_.number)
}

function isCourseComplete(modules, progress) {
  return modules.length > 0 && modules.every(m => isModuleComplete(m, progress))
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-cream">
      <nav className="bg-white border-b border-gray-200 px-6 h-14 flex items-center">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <span className="font-semibold text-gray-900">CourseBuilder</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium
            bg-brand-50 text-brand-700 border border-brand-100">
            Library
          </span>
        </div>
      </nav>
      <main className="max-w-4xl pl-8 pr-6 py-6">{children}</main>
    </div>
  )
}
