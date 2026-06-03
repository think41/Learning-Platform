import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import LearnerNavbar from '../components/LearnerNavbar'
import CurriculumSidebar from '../components/CurriculumSidebar'
import { getCourse } from '../api'
import {
  readProgress, markQuizComplete,
  flattenSteps, isStepUnlocked,
} from '../learnProgress'

export default function QuizPlayerPage() {
  const { courseId, moduleNumber } = useParams()
  const modNum                     = Number(moduleNumber)
  const navigate                   = useNavigate()
  const [course, setCourse]        = useState(null)
  const [loading, setLoading]      = useState(true)
  const [error, setError]          = useState(null)
  const [progress, setProgress]    = useState(() => readProgress(courseId))

  useEffect(() => {
    getCourse(courseId)
      .then(setCourse)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [courseId])

  const steps        = useMemo(() => course ? flattenSteps(course.plan?.modules || [], course.final_assignment) : [], [course])
  const quizStepId   = `quiz_m${modNum}`
  const quizIndex    = steps.findIndex(s => s.id === quizStepId)
  const quiz         = (course?.quizzes || []).find(q => q.module_number === modNum)
  const alreadyDone  = (progress.completed_quizzes || []).includes(modNum)

  // Per-question state. Initialize as "revealed" if quiz already done so revisits show feedback.
  const [answers, setAnswers] = useState({})
  useEffect(() => {
    if (!quiz) return
    if (alreadyDone) {
      const init = {}
      quiz.questions.forEach((q, i) => {
        init[i] = {
          selected: q.type === 'multiple_choice' ? q.answer : null,
          shortText: q.type === 'short_answer' ? '' : null,
          revealed: true,
        }
      })
      setAnswers(init)
    } else {
      setAnswers({})
    }
  }, [quiz, alreadyDone])

  // Bounce if the quiz isn't unlocked yet or quiz doesn't exist.
  useEffect(() => {
    if (!course) return
    if (quizIndex === -1 || !quiz) {
      navigate(`/learn/${courseId}`, { replace: true })
      return
    }
    if (!alreadyDone && !isStepUnlocked(steps, quizIndex, progress)) {
      navigate(`/learn/${courseId}`, { replace: true })
    }
  }, [course, quiz, quizIndex, steps, progress, alreadyDone, courseId, navigate])

  if (loading) return <Frame><p className="text-sm text-gray-500 p-6">Loading…</p></Frame>
  if (error)   return <Frame><p className="text-sm text-red-500 p-6">{error}</p></Frame>
  if (!course || !quiz) return null

  const questions   = quiz.questions || []
  const totalQs     = questions.length
  const answeredQs  = Object.values(answers).filter(a => a?.revealed).length
  const allAnswered = totalQs > 0 && answeredQs === totalQs

  const handleSelectMC = (qi, optionText) => {
    if (answers[qi]?.revealed) return
    setAnswers(prev => ({
      ...prev,
      [qi]: { selected: optionText, revealed: true },
    }))
  }

  const handleRevealShort = (qi) => {
    setAnswers(prev => ({
      ...prev,
      [qi]: { ...(prev[qi] || {}), revealed: true },
    }))
  }

  const handleShortChange = (qi, v) => {
    setAnswers(prev => ({
      ...prev,
      [qi]: { ...(prev[qi] || {}), shortText: v },
    }))
  }

  const handleFinish = () => {
    const updated = markQuizComplete(courseId, modNum)
    setProgress(updated)
    const nextStep = steps[quizIndex + 1]
    if (!nextStep) {
      navigate(`/learn/${courseId}`)
      return
    }
    if (nextStep.kind === 'section') {
      navigate(`/learn/${courseId}/section/${nextStep.id}`)
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
    navigate(`/learn/${courseId}`)
  }

  return (
    <Frame>
      <CurriculumSidebar
        course={course}
        steps={steps}
        progress={progress}
        currentId={quizStepId}
        courseId={courseId}
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-400">
            MODULE {modNum} · QUIZ
            {alreadyDone && (
              <span className="flex items-center gap-1 text-brand-600 normal-case">
                <CheckCircle size={12} /> Completed
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            {quiz.module_title || `Module ${modNum} quiz`}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            {totalQs} question{totalQs === 1 ? '' : 's'}.
            Pick an answer for each — you'll see the correct answer right after.
          </p>

          {quiz.validated === false && (quiz.validation_issues || []).length > 0 && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800
              flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold mb-1">This quiz was auto-generated and didn't fully pass validation.</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {quiz.validation_issues.slice(0, 4).map((iss, i) => <li key={i}>{iss}</li>)}
                </ul>
              </div>
            </div>
          )}

          <ol className="space-y-6">
            {questions.map((q, qi) => (
              <QuestionCard
                key={qi}
                index={qi}
                question={q}
                state={answers[qi]}
                onSelectMC={(opt) => handleSelectMC(qi, opt)}
                onShortChange={(v) => handleShortChange(qi, v)}
                onRevealShort={() => handleRevealShort(qi)}
              />
            ))}
          </ol>

          <div className="mt-10 pt-6 border-t border-gray-200 flex items-center justify-between">
            <Link to={`/learn/${courseId}`}
              className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
              <ArrowLeft size={14} /> Overview
            </Link>
            <button
              onClick={handleFinish}
              disabled={!allAnswered}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-lg font-medium
                hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!allAnswered
                ? `Answer all ${totalQs} to continue (${answeredQs}/${totalQs})`
                : <>Continue <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      </div>
    </Frame>
  )
}

function QuestionCard({ index, question, state, onSelectMC, onShortChange, onRevealShort }) {
  const revealed = !!state?.revealed
  const isMC     = question.type === 'multiple_choice'

  return (
    <li className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-7 h-7 rounded-full bg-brand-50 border border-brand-100 text-brand-700
          font-semibold text-sm flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <p className="text-sm font-medium text-gray-900 flex-1 leading-relaxed">{question.question}</p>
      </div>

      {isMC && (
        <div className="space-y-2">
          {(question.options || []).map((opt, oi) => {
            const isSelected = state?.selected === opt
            const isCorrect  = opt === question.answer
            let style = 'border-gray-200 hover:border-brand-300 hover:bg-brand-50/40'
            if (revealed) {
              if (isCorrect)            style = 'border-green-300 bg-green-50 text-green-900'
              else if (isSelected)      style = 'border-red-300 bg-red-50 text-red-900'
              else                      style = 'border-gray-200 text-gray-500'
            }
            return (
              <button
                key={oi}
                onClick={() => onSelectMC(opt)}
                disabled={revealed}
                className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors
                  flex items-center justify-between gap-3
                  ${style}
                  ${revealed ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span>{opt}</span>
                {revealed && isCorrect && <CheckCircle size={16} className="text-green-600 shrink-0" />}
                {revealed && isSelected && !isCorrect && <XCircle size={16} className="text-red-600 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}

      {!isMC && (
        <div>
          <textarea
            rows={3}
            value={state?.shortText || ''}
            onChange={(e) => onShortChange(e.target.value)}
            disabled={revealed}
            placeholder="Type your answer…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
              focus:outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-200
              disabled:bg-gray-50 disabled:text-gray-500"
          />
          {!revealed && (
            <button
              onClick={onRevealShort}
              className="mt-2 text-sm text-brand-700 hover:text-brand-800 font-medium"
            >
              Reveal model answer →
            </button>
          )}
          {revealed && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              <div className="text-xs font-semibold text-green-700 mb-1">MODEL ANSWER</div>
              <div className="whitespace-pre-wrap">{question.answer}</div>
            </div>
          )}
        </div>
      )}

      {revealed && question.explanation && (
        <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700">
          <div className="text-xs font-semibold text-gray-500 mb-1">EXPLANATION</div>
          {question.explanation}
        </div>
      )}
    </li>
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
