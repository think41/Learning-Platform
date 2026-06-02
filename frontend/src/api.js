const BASE = '/session'

async function req(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const createSession = () =>
  req(BASE, { method: 'POST' })

export const sendChat = (sid, message) =>
  req(`${BASE}/${sid}/chat`, { method: 'POST', body: JSON.stringify({ message }) })

export const approvePlan = (sid) =>
  req(`${BASE}/${sid}/approve-plan`, { method: 'POST' })

export const approveSection = (sid) =>
  req(`${BASE}/${sid}/approve-section`, { method: 'POST' })

export const reviseSection = (sid, feedback) =>
  req(`${BASE}/${sid}/revise`, { method: 'POST', body: JSON.stringify({ feedback }) })

export const uploadFiles = (sid, files, message = '') => {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  form.append('message', message)
  return fetch(`${BASE}/${sid}/upload`, { method: 'POST', body: form }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }))
      throw new Error(err.detail || 'Upload failed')
    }
    return r.json()
  })
}

export const generateAssessments = (sid) =>
  req(`${BASE}/${sid}/generate-assessments`, { method: 'POST' })

export const regenerateQuiz = (sid, moduleNumber) =>
  req(`${BASE}/${sid}/regenerate-quiz/${moduleNumber}`, { method: 'POST' })

export const regenerateAssignment = (sid) =>
  req(`${BASE}/${sid}/regenerate-assignment`, { method: 'POST' })

export const exportSession = (sid) =>
  req(`${BASE}/${sid}/export`)
