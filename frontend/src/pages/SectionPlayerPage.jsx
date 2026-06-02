import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react'
import LearnerNavbar from '../components/LearnerNavbar'
import CurriculumSidebar from '../components/CurriculumSidebar'
import MarkdownView from '../components/MarkdownView'
import { getCourse } from '../api'
import {
  readProgress, markSectionComplete, markStarted,
  flattenSteps, isStepDone, isStepUnlocked,
} from '../learnProgress'

export default function SectionPlayerPage() {
  const { courseId, sectionId } = useParams()
  const navigate                = useNavigate()
  const [course, setCourse]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [progress, setProgress] = useState(() => readProgress(courseId))

  useEffect(() => {
    getCourse(courseId)
      .then(c => {
        setCourse(c)
        markStarted(courseId)
        setProgress(readProgress(courseId))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [courseId])

  const steps = useMemo(
    () => course ? flattenSteps(course.plan?.modules || [], course.final_assignment) : [],
    [course]
  )
  const currentIndex = steps.findIndex(s => s.id === sectionId)

  // Redirect if section id invalid or locked.
  useEffect(() => {
    if (!course) return
    if (currentIndex === -1) {
      navigate(`/learn/${courseId}`, { replace: true })
      return
    }
    if (!isStepUnlocked(steps, currentIndex, progress)) {
      navigate(`/learn/${courseId}`, { replace: true })
    }
  }, [course, currentIndex, steps, progress, courseId, navigate])

  if (loading) return <div className="flex flex-col h-screen bg-cream"><LearnerNavbar /><p className="text-sm text-gray-500 p-6">Loading…</p></div>
  if (error)   return <div className="flex flex-col h-screen bg-cream"><LearnerNavbar /><p className="text-sm text-red-500 p-6">{error}</p></div>
  if (!course || currentIndex === -1) return null

  const step       = steps[currentIndex]
  const section    = course.sections?.[step.id]
  const done       = isStepDone(step, progress)
  const nextStep   = steps[currentIndex + 1]
  const nextIsQuiz = nextStep?.kind === 'quiz'

  const handleNext = () => {
    const updated = markSectionComplete(courseId, step.id)
    setProgress(updated)
    if (!nextStep) {
      navigate(`/learn/${courseId}`)
      return
    }
    if (nextStep.kind === 'quiz') {
      navigate(`/learn/${courseId}/quiz/${nextStep.moduleNumber}`)
      return
    }
    if (nextStep.kind === 'final') {
      navigate(`/learn/${courseId}/assignment`)
      return
    }
    navigate(`/learn/${courseId}/section/${nextStep.id}`)
  }

  return (
    <div className="flex flex-col h-screen bg-cream">
      <LearnerNavbar />
      <div className="flex flex-1 overflow-hidden">
        <CurriculumSidebar
          course={course}
          steps={steps}
          progress={progress}
          currentId={sectionId}
          courseId={courseId}
        />

        <div className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-8 py-8">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-400">
              MODULE {step.moduleNumber} · SECTION
              {done && (
                <span className="flex items-center gap-1 text-brand-600 normal-case">
                  <CheckCircle size={12} /> Completed
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">{step.title}</h1>

            {section?.content
              ? <MarkdownView content={section.content} />
              : <p className="text-sm text-gray-500">No content available for this section.</p>}

            <div className="mt-10 pt-6 border-t border-gray-200 flex items-center justify-between">
              <Link to={`/learn/${courseId}`}
                className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
                <ArrowLeft size={14} /> Overview
              </Link>
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-lg font-medium
                  hover:bg-brand-700 transition-colors"
              >
                {!nextStep && 'Finish'}
                {nextStep && nextStep.kind === 'quiz'  && `Continue → Module ${nextStep.moduleNumber} quiz`}
                {nextStep && nextStep.kind === 'final' && `Continue → Final assignment`}
                {nextStep && nextStep.kind === 'section' && (
                  <>Continue <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

