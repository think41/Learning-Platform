import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight, Presentation } from 'lucide-react'

export default function SectionDeck({ slides }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: 'start' })
  const [index, setIndex]    = useState(0)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setIndex(emblaApi.selectedScrollSnap())
    setCanPrev(emblaApi.canScrollPrev())
    setCanNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
  }, [emblaApi, onSelect])

  useEffect(() => {
    const handler = (e) => {
      if (!emblaApi) return
      if (e.key === 'ArrowLeft')  emblaApi.scrollPrev()
      if (e.key === 'ArrowRight') emblaApi.scrollNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [emblaApi])

  if (!Array.isArray(slides) || slides.length === 0) return null

  return (
    <div className="mb-10">
      <div className="relative rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
        {/* brand accent bar — signals 'this is a player, not prose' */}
        <div className="h-1.5 bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600" />

        {/* deck chrome */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-900 text-gray-100">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <Presentation size={14} className="text-brand-400" />
            Slide deck
          </div>
          <div className="text-xs font-medium text-gray-300 tabular-nums">
            {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
          </div>
        </div>

        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {slides.map((s, i) => (
              <div key={i} className="flex-[0_0_100%] min-w-0">
                <Slide slide={s} />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => emblaApi?.scrollPrev()}
          disabled={!canPrev}
          aria-label="Previous slide"
          className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white
            shadow-lg ring-1 ring-black/5 flex items-center justify-center
            text-gray-700 hover:text-brand-600 hover:scale-105
            disabled:opacity-0 disabled:pointer-events-none transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => emblaApi?.scrollNext()}
          disabled={!canNext}
          aria-label="Next slide"
          className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white
            shadow-lg ring-1 ring-black/5 flex items-center justify-center
            text-gray-700 hover:text-brand-600 hover:scale-105
            disabled:opacity-0 disabled:pointer-events-none transition-all"
        >
          <ChevronRight size={20} />
        </button>

        {/* progress dots */}
        <div className="flex items-center justify-center gap-1.5 py-3 bg-white border-t border-gray-100">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-brand-600' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Slide({ slide }) {
  const isCode = typeof slide.code === 'string' && slide.code.trim().length > 0
  return (
    <div className="aspect-[16/9] px-10 sm:px-14 py-9 sm:py-11 flex flex-col bg-white">
      <h3 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6 leading-tight">
        {slide.title}
      </h3>

      {isCode ? (
        <pre className="flex-1 overflow-auto bg-gray-900 text-gray-100 rounded-lg p-4 text-sm leading-relaxed">
          <code>{slide.code}</code>
        </pre>
      ) : (
        <ul className="space-y-3 text-gray-700 text-base leading-relaxed">
          {(slide.bullets || []).map((b, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-brand-600 font-bold mt-0.5">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
