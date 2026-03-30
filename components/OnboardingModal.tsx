'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/profile'

interface Props {
  userId: string
  displayName: string
  onComplete: (profile: UserProfile) => void
}

const STEPS: {
  key: keyof Omit<UserProfile, 'display_name'>
  label: string
  description: string
  placeholder: string
}[] = [
  {
    key: 'persona',
    label: 'Who I Am',
    description:
      'Your background, certifications, and your "why." Used to write bios, About Me sections, and add personal authenticity to every message.',
    placeholder:
      'e.g. I\'m a certified sound healer and breathwork facilitator with 8 years of experience. I trained at the Sound Healing Academy in London and hold a Level 3 certification in Trauma-Informed Breathwork. My "why" is...',
  },
  {
    key: 'mission',
    label: 'My Business Mission',
    description:
      'The specific problem you solve and who you solve it for. This becomes the hook of every marketing message Letizia writes for you.',
    placeholder:
      'e.g. I help burned-out corporate teams at mid-size tech companies reduce stress and boost focus through science-backed sound healing sessions — without disrupting their workflow or requiring any prior wellness experience.',
  },
  {
    key: 'services',
    label: 'My Services & Pricing',
    description:
      'Your packages and price points. Letizia uses this to recommend the right offer for the right lead and never leaves money on the table.',
    placeholder:
      'e.g.\n• Corporate Sound Bath (90 min, up to 30 people) — £2,500\n• Executive 1:1 Breathwork Session (60 min) — £250\n• Monthly Wellness Retainer (4 sessions/month) — £1,800/mo\n• Team Retreat (full day) — £5,000',
  },
]

export default function OnboardingModal({ userId, displayName, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [values, setValues] = useState({ persona: '', mission: '', services: '' })
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  function handleChange(value: string) {
    setValues((prev) => ({ ...prev, [current.key]: value }))
  }

  function handleNext() {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1)
  }

  async function handleSubmit() {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({
        persona: values.persona,
        mission: values.mission,
        services: values.services,
      })
      .eq('id', userId)

    setSaving(false)

    // Mark onboarding done for this user so it never shows again
    try {
      localStorage.setItem(`onboarding_done_${userId}`, '1')
    } catch {}

    onComplete({
      display_name: displayName,
      persona: values.persona,
      mission: values.mission,
      services: values.services,
    })
  }

  function handleSkip() {
    try {
      localStorage.setItem(`onboarding_done_${userId}`, '1')
    } catch {}
    onComplete({
      display_name: displayName,
      persona: '',
      mission: '',
      services: '',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#1A2C41]/80 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-[#1A2C41] border border-white/10 rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[#C5A059] font-light tracking-widest uppercase text-lg"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Letizia
            </span>
            <button
              onClick={handleSkip}
              className="text-white/30 hover:text-white/60 text-xs transition-colors"
            >
              Skip for now
            </button>
          </div>
          <h2 className="text-white text-base font-semibold">
            Welcome{displayName ? `, ${displayName.split(' ')[0]}` : ''}!
          </h2>
          <p className="text-white/40 text-xs mt-1">
            Let&apos;s set up your profile so every reply feels personal and on-brand.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-2 px-6 pt-4 flex-shrink-0">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? 'bg-[#C5A059]' : 'bg-white/10'
              }`}
            />
          ))}
          <span className="text-white/30 text-xs ml-1 whitespace-nowrap">
            {step + 1} / {STEPS.length}
          </span>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <label className="block text-white text-xs font-semibold uppercase tracking-wider mb-1">
            {current.label}
          </label>
          <p className="text-white/35 text-xs leading-relaxed mb-3">{current.description}</p>
          <textarea
            key={current.key}
            value={values[current.key]}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={current.placeholder}
            rows={6}
            className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#C5A059]/50 resize-none transition-colors leading-relaxed"
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex items-center justify-between flex-shrink-0 border-t border-white/10">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="text-white/40 hover:text-white/70 text-sm transition-colors disabled:opacity-0"
          >
            ← Back
          </button>

          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-[#C5A059] hover:bg-[#C5A059]/90 disabled:opacity-60 text-[#1A2C41] font-semibold text-sm px-6 py-2 rounded-xl transition-colors"
            >
              {saving ? 'Saving…' : 'Submit'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#1A2C41] font-semibold text-sm px-6 py-2 rounded-xl transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
