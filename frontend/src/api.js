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

export const uploadFile = (sid, file) => {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${BASE}/${sid}/upload`, { method: 'POST', body: form }).then(r => r.json())
}

export const exportSession = (sid) =>
  req(`${BASE}/${sid}/export`)
