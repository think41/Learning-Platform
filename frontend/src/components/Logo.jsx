// Original app mark: three ascending rounded bars (growth / building a course)
// inside a rounded tile with the brand orange gradient.
export default function Logo({ size = 32, className = '' }) {
  const id = 'cb-grad'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="CourseBuilder logo"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#f26207" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      <rect x="8"  y="18" width="4" height="6"  rx="1.5" fill="#fff" />
      <rect x="14" y="13" width="4" height="11" rx="1.5" fill="#fff" opacity="0.92" />
      <rect x="20" y="8"  width="4" height="16" rx="1.5" fill="#fff" opacity="0.85" />
    </svg>
  )
}
