// Per-browser learner progress. No backend, no users.
const key = (courseId) => `learn:${courseId}`

const empty = () => ({ started: false, completed_sections: [], completed_quizzes: [], viewed_final: false })

export function readProgress(courseId) {
  try {
    return JSON.parse(localStorage.getItem(key(courseId)) || 'null') || empty()
  } catch {
    return empty()
  }
}

export function writeProgress(courseId, progress) {
  localStorage.setItem(key(courseId), JSON.stringify(progress))
}

export function markStarted(courseId) {
  const p = readProgress(courseId)
  if (!p.started) {
    p.started = true
    writeProgress(courseId, p)
  }
  return p
}

export function markSectionComplete(courseId, sectionId) {
  const p = readProgress(courseId)
  if (!p.completed_sections.includes(sectionId)) {
    p.completed_sections.push(sectionId)
  }
  p.started = true
  writeProgress(courseId, p)
  return p
}

export function markQuizComplete(courseId, moduleNumber) {
  const p = readProgress(courseId)
  if (!p.completed_quizzes.includes(moduleNumber)) {
    p.completed_quizzes.push(moduleNumber)
  }
  writeProgress(courseId, p)
  return p
}

export function markFinalViewed(courseId) {
  const p = readProgress(courseId)
  if (!p.viewed_final) {
    p.viewed_final = true
    writeProgress(courseId, p)
  }
  return p
}

// ── Linear order helpers ──────────────────────────────────────────────────────

// Walk modules and return a flat list of "steps": sections + quizzes interleaved,
// plus a final-assignment step at the end if the course has one.
// Each step: { kind: 'section' | 'quiz' | 'final', id, moduleNumber?, title }
export function flattenSteps(modules, finalAssignment = null) {
  const steps = []
  for (const m of modules || []) {
    const subs = m.submodules || []
    for (let si = 0; si < subs.length; si++) {
      steps.push({
        kind: 'section',
        id: `m${m.number}_s${si}`,
        moduleNumber: m.number,
        title: subs[si].title,
      })
    }
    steps.push({
      kind: 'quiz',
      id: `quiz_m${m.number}`,
      moduleNumber: m.number,
      title: `Module ${m.number} quiz`,
    })
  }
  if (finalAssignment && finalAssignment.title) {
    steps.push({
      kind: 'final',
      id: 'final',
      title: finalAssignment.title || 'Final assignment',
    })
  }
  return steps
}

export function isStepDone(step, progress) {
  if (step.kind === 'section') return progress.completed_sections.includes(step.id)
  if (step.kind === 'quiz')    return progress.completed_quizzes.includes(step.moduleNumber)
  if (step.kind === 'final')   return !!progress.viewed_final
  return false
}

// A step is unlocked iff all prior steps are done.
export function isStepUnlocked(steps, index, progress) {
  for (let i = 0; i < index; i++) {
    if (!isStepDone(steps[i], progress)) return false
  }
  return true
}

// Find the first not-completed unlocked step (i.e., where the learner should resume).
export function firstIncomplete(steps, progress) {
  for (let i = 0; i < steps.length; i++) {
    if (!isStepDone(steps[i], progress)) return { step: steps[i], index: i }
  }
  return null
}
