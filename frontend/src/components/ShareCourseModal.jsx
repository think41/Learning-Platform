import { useEffect, useRef, useState } from 'react'
import { X, Mail, Link as LinkIcon, Check, Loader2, AlertCircle } from 'lucide-react'
import { shareCourse } from '../api'

export default function ShareCourseModal({ open, onClose, courseId, courseTitle }) {
  const [email, setEmail]     = useState('')
  const [note, setNote]       = useState('')
  const [copied, setCopied]   = useState(false)
  const [status, setStatus]   = useState('idle') // idle | sending | sent | error
  const [errorMsg, setError]  = useState('')
  const emailRef              = useRef(null)

  const courseUrl = `${window.location.origin}/learn/${courseId}`

  useEffect(() => {
    if (open) {
      setEmail('')
      setNote('')
      setCopied(false)
      setStatus('idle')
      setError('')
      setTimeout(() => emailRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape' && status !== 'sending') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, status])

  if (!open) return null

  const trimmedEmail = email.trim()
  const validEmail   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)

  const handleSend = async () => {
    if (!validEmail || status === 'sending') return
    setStatus('sending')
    setError('')
    try {
      await shareCourse(courseId, trimmedEmail, note.trim())
      setStatus('sent')
      setTimeout(() => onClose(), 1500)
    } catch (e) {
      setStatus('error')
      setError(e.message || 'Failed to send email')
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(courseUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked — user can still select the link manually
    }
  }

  const sending = status === 'sending'
  const sent    = status === 'sent'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => { if (!sending) onClose() }}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Share this course</h2>
          <button
            onClick={onClose}
            disabled={sending}
            className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            Enter the recipient's email and we'll send them an invitation with a link to this course.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Recipient email
            </label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alice@example.com"
              disabled={sending || sent}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400
                disabled:bg-gray-50 disabled:text-gray-500"
              onKeyDown={(e) => { if (e.key === 'Enter' && validEmail) handleSend() }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Personal note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Thought you might enjoy this…"
              disabled={sending || sent}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none
                focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400
                disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 flex items-center gap-2">
            <LinkIcon size={14} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-600 font-mono truncate flex-1">{courseUrl}</span>
            <button
              onClick={handleCopy}
              className="text-xs font-medium text-brand-700 hover:text-brand-800 shrink-0
                inline-flex items-center gap-1"
            >
              {copied ? <><Check size={12} /> Copied</> : 'Copy'}
            </button>
          </div>

          {status === 'error' && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {status === 'sent' && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
              <Check size={14} className="text-green-600 shrink-0" />
              <p className="text-xs text-green-700">Invitation sent to {trimmedEmail}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            {sent ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleSend}
            disabled={!validEmail || sending || sent}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
              bg-brand-600 text-white hover:bg-brand-700 disabled:bg-gray-200
              disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {sending
              ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
              : sent
                ? <><Check size={14} /> Sent</>
                : <><Mail size={14} /> Send Invitation</>}
          </button>
        </div>
      </div>
    </div>
  )
}
