import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Clock, Plus } from 'lucide-react'
import Logo from '../components/Logo'
import { listCourses } from '../api'

export default function GeneratedCoursesPage() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    listCourses()
      .then(d => setCourses(d.courses || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-cream">
      <nav className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <span className="font-semibold text-gray-900">CourseBuilder</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium
            bg-brand-50 text-brand-700 border border-brand-100">
            Generated Courses
          </span>
        </div>
        <Link
          to="/course-builder"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium
            hover:bg-brand-700 transition-colors"
        >
          <Plus size={14} /> New Course
        </Link>
      </nav>

      <main className="max-w-5xl pl-8 pr-6 py-6">
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && courses.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <BookOpen size={32} className="mx-auto text-gray-400 mb-3" />
            <h2 className="text-lg font-semibold text-gray-800 mb-1">No published courses yet</h2>
            <p className="text-sm text-gray-500 mb-4">Build a course and click <strong>Publish</strong> to make it appear here.</p>
            <Link
              to="/course-builder"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium
                hover:bg-brand-700 transition-colors"
            >
              <Plus size={14} /> Build a course
            </Link>
          </div>
        )}

        {!loading && courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {courses.map(c => (
              <div
                key={c.id}
                className="relative bg-white rounded-2xl border border-gray-200 p-6 min-h-[240px]
                  flex flex-col"
              >
                <div className="absolute top-0 left-6 right-6 h-1 bg-gradient-to-r from-brand-400 to-brand-600
                  rounded-b-full" />

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100
                    flex items-center justify-center shrink-0">
                    <BookOpen size={18} className="text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2">
                      {c.title}
                    </h3>
                  </div>
                </div>

                {c.description && (
                  <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed mb-4">
                    {c.description}
                  </p>
                )}

                <div className="mt-auto pt-4 border-t border-gray-100
                  flex items-center gap-3 text-xs text-gray-500">
                  {c.total_duration_hours > 0 && (
                    <span className="flex items-center gap-1 font-medium text-gray-600">
                      <Clock size={12} /> {c.total_duration_hours}h
                    </span>
                  )}
                  <span className="text-gray-400">
                    {new Date(c.created_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
