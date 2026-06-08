import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Sparkles } from 'lucide-react'
import Logo from '../components/Logo'
import CourseCard from '../components/CourseCard'
import { listCourses } from '../api'
import { readProgress } from '../learnProgress'

export default function CourseLibraryPage() {
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
            Library
          </span>
        </div>
        <Link
          to="/course-builder"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium
            hover:bg-brand-700 transition-colors"
        >
          <Sparkles size={14} /> Build a course
        </Link>
      </nav>

      <main className="max-w-5xl pl-8 pr-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Library</h1>
          <p className="text-sm text-gray-500 mt-1">Pick a course to start learning.</p>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && !error && courses.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <BookOpen size={32} className="mx-auto text-gray-400 mb-3" />
            <h2 className="text-lg font-semibold text-gray-800 mb-1">No courses published yet</h2>
            <p className="text-sm text-gray-500">Check back once a course has been published.</p>
          </div>
        )}

        {!loading && courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {courses.map(c => (
              <CourseCard
                key={c.id}
                course={c}
                to={`/learn/${c.id}`}
                completed={readProgress(c.id).viewed_final}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
