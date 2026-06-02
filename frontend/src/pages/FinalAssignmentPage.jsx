import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trophy, CheckCircle, ClipboardList, Package, Scale, Clock } from 'lucide-react'
import LearnerNavbar from '../components/LearnerNavbar'
import CurriculumSidebar from '../components/CurriculumSidebar'
import { getCourse } from '../api'
import {
  readProgress, markFinalViewed,
  flattenSteps, isStepUnlocked,
} from '../learnProgress'

export default function FinalAssignmentPage() {
  const { courseId }            = useParams()
  const navigate                = useNavigate()
  const [course, setCourse]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [progress, setProgress] = useState(() => readProgress(courseId))

  useEffect(() => {
    getCourse(courseId)
      .then(setCourse)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [courseId])

  const steps      = useMemo(
    () => course ? flattenSteps(course.plan?.modules || [], course.final_assignment) : [],
    [course],
  )
  const finalIndex = steps.findIndex(s => s.kind === 'final')

  // Bounce out if no final or not unlocked. Otherwise mark as viewed.
  useEffect(() => {
    if (!course) return
    if (finalIndex === -1) {
      navigate(`/learn/${courseId}`, { replace: true })
      return
    }
    if (!isStepUnlocked(steps, finalIndex, progress)) {
      navigate(`/learn/${courseId}`, { replace: true })
      return
    }
    if (!progress.viewed_final) {
      setProgress(markFinalViewed(courseId))
    }
  }, [course, finalIndex, steps, progress, courseId, navigate])

  if (loading) return <Frame><p className="text-sm text-gray-500 p-6">Loading…</p></Frame>
  if (error)   return <Frame><p className="text-sm text-red-500 p-6">{error}</p></Frame>
  if (!course || finalIndex === -1) return null

  const fa = course.final_assignment || {}

  return (
    <Frame>
      <CurriculumSidebar
        course={course}
        steps={steps}
        progress={progress}
        currentId="final"
        courseId={courseId}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-400">
            FINAL ASSIGNMENT
            <span className="flex items-center gap-1 text-brand-600 normal-case">
              <CheckCircle size={12} /> Course complete
            </span>
          </div>

          <div className="flex items-start gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100
              flex items-center justify-center shrink-0">
              <Trophy size={22} className="text-brand-600" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-2xl font-semibold text-gray-900 leading-tight">
                {fa.title || 'Final assignment'}
              </h1>
              {fa.estimated_hours > 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                  <Clock size={12} /> ~{fa.estimated_hours}h estimated
                </div>
              )}
            </div>
          </div>

          {fa.overview && (
            <Section icon={null} title="Overview">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{fa.overview}</p>
            </Section>
          )}

          {Array.isArray(fa.tasks) && fa.tasks.length > 0 && (
            <Section icon={ClipboardList} title="Tasks">
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700">
                {fa.tasks.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </Section>
          )}

          {Array.isArray(fa.deliverables) && fa.deliverables.length > 0 && (
            <Section icon={Package} title="Deliverables">
              <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-700">
                {fa.deliverables.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </Section>
          )}

          {Array.isArray(fa.evaluation_criteria) && fa.evaluation_criteria.length > 0 && (
            <Section icon={Scale} title="Evaluation criteria">
              <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-700">
                {fa.evaluation_criteria.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </Section>
          )}

          {!fa.title && (
            <p className="text-sm text-gray-500">No final assignment was generated for this course.</p>
          )}

          <div className="mt-10 pt-6 border-t border-gray-200">
            <Link to={`/learn/${courseId}`}
              className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
              <ArrowLeft size={14} /> Back to overview
            </Link>
          </div>
        </div>
      </div>
    </Frame>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={14} className="text-brand-600" />}
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Frame({ children }) {
  return (
    <div className="flex flex-col h-screen bg-cream">
      <LearnerNavbar />
      <div className="flex flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
