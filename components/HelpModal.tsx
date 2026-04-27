'use client'

import { useState, useRef } from 'react'
import { X, Paperclip, Send, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  userEmail: string
  displayName: string
  onClose: () => void
}

export default function HelpModal({ userEmail, displayName, onClose }: Props) {
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)
    setError(null)

    const fd = new FormData()
    fd.append('message', message.trim())
    fd.append('userEmail', userEmail)
    fd.append('displayName', displayName)
    if (file) fd.append('screenshot', file)

    const res = await fetch('/api/support/ticket', { method: 'POST', body: fd })
    setSending(false)

    if (res.ok) {
      setSent(true)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again.')
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > 4 * 1024 * 1024) {
      setError('Screenshot must be under 4 MB.')
      return
    }
    setError(null)
    setFile(f)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#1A2C41] px-6 py-5 flex items-center justify-between">
          <div>
            <h2
              className="text-white font-light tracking-widest uppercase text-lg"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Help & Support
            </h2>
            <p className="text-white/40 text-xs mt-0.5">We usually reply within a few hours</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle className="mx-auto text-[#C5A059] mb-4" size={40} />
            <h3 className="text-[#1A2C41] font-semibold text-lg mb-2">Ticket sent!</h3>
            <p className="text-[#1A2C41]/55 text-sm leading-relaxed mb-6">
              We received your message and will get back to you at<br />
              <span className="font-medium text-[#1A2C41]/80">{userEmail}</span> as soon as possible.
            </p>
            <button
              onClick={onClose}
              className="bg-[#1A2C41] hover:bg-[#243d5a] text-white font-semibold px-8 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* From */}
            <div>
              <label className="block text-xs text-[#1A2C41]/50 uppercase tracking-wider mb-1.5">From</label>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2C41]/60">
                {displayName} — {userEmail}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs text-[#1A2C41]/50 uppercase tracking-wider mb-1.5">
                What do you need help with?
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what's happening, what you expected, and what you see instead..."
                rows={5}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#1A2C41] placeholder:text-[#1A2C41]/30 focus:outline-none focus:border-[#C5A059]/60 resize-none transition-colors"
              />
            </div>

            {/* Screenshot upload */}
            <div>
              <label className="block text-xs text-[#1A2C41]/50 uppercase tracking-wider mb-1.5">
                Screenshot <span className="normal-case text-[#C5A059] font-medium">— please attach one if possible!</span>
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                  file
                    ? 'bg-[#C5A059]/8 border-[#C5A059]/40 text-[#1A2C41]'
                    : 'bg-gray-50 border-gray-200 hover:border-[#C5A059]/40 text-[#1A2C41]/40'
                }`}
              >
                <Paperclip size={15} className={file ? 'text-[#C5A059]' : ''} />
                <span className="text-sm truncate flex-1">
                  {file ? file.name : 'Click to attach a screenshot (PNG, JPG — max 4 MB)'}
                </span>
                {file && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = '' }}
                    className="text-[#1A2C41]/30 hover:text-[#1A2C41]/70 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
              <p className="text-[10px] text-[#1A2C41]/30 mt-1.5 leading-relaxed">
                A screenshot helps us understand and fix your issue much faster. Takes just a second to grab one!
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!message.trim() || sending}
              className="w-full flex items-center justify-center gap-2 bg-[#C5A059] hover:bg-[#d4af6a] text-[#1A2C41] font-semibold py-3 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mt-1"
            >
              <Send size={14} />
              {sending ? 'Sending…' : 'Send ticket'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
