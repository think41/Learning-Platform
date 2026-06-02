import Logo from './Logo'

export default function LearnerNavbar() {
  return (
    <nav className="bg-white border-b border-gray-200 px-6 h-14 flex items-center shrink-0">
      <div className="flex items-center gap-3">
        <Logo size={32} />
        <span className="font-semibold text-gray-900">CourseBuilder</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium
          bg-brand-50 text-brand-700 border border-brand-100">
          Library
        </span>
      </div>
    </nav>
  )
}
