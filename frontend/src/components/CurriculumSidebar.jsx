import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle, Lock, FileQuestion, Trophy } from 'lucide-react'
import { isStepDone, isStepUnlocked } from '../learnProgress'

export default function CurriculumSidebar({ course, steps, progress, currentId, courseId }) {
  const grouped    = []
  const finalSteps = []
  for (const s of steps) {
    if (s.kind === 'final') { finalSteps.push(s); continue }
    const last = grouped[grouped.length - 1]
    if (!last || last.moduleNumber !== s.moduleNumber) {
      grouped.push({ moduleNumber: s.moduleNumber, items: [s] })
    } else {
      last.items.push(s)
    }
  }

  const linkFor = (step) => {
    if (step.kind === 'section') return `/learn/${courseId}/section/${step.id}`
    if (step.kind === 'quiz')    return `/learn/${courseId}/quiz/${step.moduleNumber}`
    if (step.kind === 'final')   return `/learn/${courseId}/assignment`
    return null
  }

  const renderRow = (it) => {
    const idx       = steps.findIndex(s => s.id === it.id)
    const unlocked  = isStepUnlocked(steps, idx, progress)
    const done      = isStepDone(it, progress)
    const isCurrent = it.id === currentId
    const Icon      = it.kind === 'quiz'  ? FileQuestion
                    : it.kind === 'final' ? Trophy
                    : null
    const url       = linkFor(it)

    const inner = (
      <span className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm
        ${isCurrent
          ? 'bg-brand-50 text-brand-700 font-medium'
          : unlocked
            ? 'text-gray-700 hover:bg-gray-50'
            : 'text-gray-400'}`}>
        {done
          ? <CheckCircle size={14} className="text-brand-600 shrink-0" />
          : unlocked
            ? <span className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0" />
            : <Lock size={14} className="shrink-0" />}
        {Icon && <Icon size={12} className="shrink-0 opacity-70" />}
        <span className="truncate">{it.title}</span>
      </span>
    )

    if (unlocked && url) {
      return <li key={it.id}><Link to={url} className="block">{inner}</Link></li>
    }
    return <li key={it.id}>{inner}</li>
  }

  return (
    <aside className="w-72 shrink-0 bg-white border-r border-gray-200 overflow-auto">
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={14} className="text-brand-600" />
          <span className="text-xs font-semibold text-gray-400">COURSE</span>
        </div>
        <Link to={`/learn/${courseId}`}
          className="text-sm font-semibold text-gray-900 hover:text-brand-700 line-clamp-2">
          {course.title}
        </Link>
      </div>

      <nav className="p-3">
        {grouped.map(g => (
          <div key={g.moduleNumber} className="mb-4">
            <div className="px-2 mb-1 text-[10px] font-bold tracking-wider text-gray-400">
              MODULE {g.moduleNumber}
            </div>
            <ul>{g.items.map(renderRow)}</ul>
          </div>
        ))}
        {finalSteps.length > 0 && (
          <div className="mb-4">
            <div className="px-2 mb-1 text-[10px] font-bold tracking-wider text-gray-400">
              FINAL ASSIGNMENT
            </div>
            <ul>{finalSteps.map(renderRow)}</ul>
          </div>
        )}
      </nav>
    </aside>
  )
}
