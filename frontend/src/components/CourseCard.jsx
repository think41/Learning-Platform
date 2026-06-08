import { Link } from 'react-router-dom'
import { BookOpen, Clock, CheckCircle, Share2 } from 'lucide-react'

export default function CourseCard({ course, to, completed = false, onShare, showOpenHint = true }) {
  const inner = (
    <>
      <div className="absolute top-0 left-6 right-6 h-1 bg-gradient-to-r from-brand-400 to-brand-600
        rounded-b-full" />

      {completed && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5
          rounded-full text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200">
          <CheckCircle size={11} /> Completed
        </span>
      )}

      <div className={`flex items-center gap-3 mb-3 ${completed ? 'pr-28' : ''}`}>
        <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100
          flex items-center justify-center shrink-0">
          <BookOpen size={18} className="text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2">
            {course.title}
          </h3>
        </div>
      </div>

      {course.description && (
        <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed mb-4">
          {course.description}
        </p>
      )}

      <div className="mt-auto pt-4 border-t border-gray-100
        flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          {course.total_duration_hours > 0 && (
            <span className="flex items-center gap-1 font-medium text-gray-600">
              <Clock size={12} /> {course.total_duration_hours}h
            </span>
          )}
          <span className="text-gray-400">
            {new Date(course.created_at).toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </span>
        </div>
        {to && showOpenHint && (
          <span className="text-brand-600 font-medium opacity-0 group-hover:opacity-100
            transition-opacity">
            Open →
          </span>
        )}
        {onShare && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onShare(course) }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
              text-brand-700 bg-brand-50 border border-brand-100
              hover:bg-brand-100 transition-colors"
          >
            <Share2 size={12} /> Share
          </button>
        )}
      </div>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="group relative bg-white rounded-2xl border border-gray-200 p-6 min-h-[240px]
          flex flex-col cursor-pointer no-underline
          hover:border-brand-300 hover:shadow-lg hover:-translate-y-0.5
          transition-all duration-200"
      >
        {inner}
      </Link>
    )
  }

  return (
    <div className="relative bg-white rounded-2xl border border-gray-200 p-6 min-h-[240px]
      flex flex-col">
      {inner}
    </div>
  )
}
