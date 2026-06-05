import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Plus } from 'lucide-react'
import Logo from '../components/Logo'
import CourseCard from '../components/CourseCard'
import ShareCourseModal from '../components/ShareCourseModal'
import { listCourses } from '../api'

export default function GeneratedCoursesPage() {
  const [courses, setCourses]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [shareTarget, setShareTarget] = useState(null)

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
              <CourseCard
                key={c.id}
                course={c}
                onShare={setShareTarget}
              />
            ))}
          </div>
        )}
      </main>

      <ShareCourseModal
        open={!!shareTarget}
        onClose={() => setShareTarget(null)}
        courseId={shareTarget?.id}
        courseTitle={shareTarget?.title}
      />
    </div>
  )
}
