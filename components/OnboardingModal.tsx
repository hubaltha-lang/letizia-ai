'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile, PracticeStatus } from '@/lib/profile'

interface Props {
  userId: string
  displayName: string
  initial?: Partial<UserProfile>
  onComplete: (profile: UserProfile) => void
  onClose?: () => void
}

interface FormState {
  full_name: string
  age: string
  location: string
  modalities: string
  practice_status: PracticeStatus
  persona: string
  mission: string
  services: string
}

const EMPTY_FORM: FormState = {
  full_name: '',
  age: '',
  location: '',
  modalities: '',
  practice_status: '',
  persona: '',
  mission: '',
  services: '',
}

const PRACTICE_STATUS_OPTIONS: { value: PracticeStatus; label: string }[] = [
  { value: '', label: '—' },
  { value: 'full_time', label: 'Full-time healer' },
  { value: 'part_time', label: 'Part-time healer' },
  { value: 'starting_out', label: 'Just starting out' },
]

type Step =
  | { kind: 'basics' }
  | {
      kind: 'textarea'
      key: 'persona' | 'mission' | 'services'
      label: string
      description: string
      placeholder: string
    }

const STEPS: Step[] = [
  { kind: 'basics' },
  {
    kind: 'textarea',
    key: 'persona',
    label: 'Who I Am',
    description:
      'Your background, certifications, and your "why." Used to write bios, About Me sections, and add personal authenticity to every message.',
    placeholder:
      'e.g. I\'m a certified sound healer and breathwork facilitator with 8 years of experience. I trained at the Sound Healing Academy in London and hold a Level 3 certification in Trauma-Informed Breathwork. My "why" is...',
  },
  {
    kind: 'textarea',
    key: 'mission',
    label: 'My Business Mission',
    description:
      'The specific problem you solve and who you solve it for. This becomes the hook of every marketing message Letizia writes for you.',
    placeholder:
      'e.g. I help burned-out corporate teams at mid-size tech companies reduce stress and boost focus through science-backed sound healing sessions — without disrupting their workflow or requiring any prior wellness experience.',
  },
  {
    kind: 'textarea',
    key: 'services',
    label: 'My Services & Pricing',
    description:
      'Your packages and price points. Letizia uses this to recommend the right offer for the right lead and never leaves money on the table.',
    placeholder:
      'e.g.\n• Corporate Sound Bath (90 min, up to 30 people) — £2,500\n• Executive 1:1 Breathwork Session (60 min) — £250\n• Monthly Wellness Retainer (4 sessions/month) — £1,800/mo\n• Team Retreat (full day) — £5,000',
  },
]

function initFormFromProfile(initial: Partial<UserProfile> | undefined): FormState {
  if (!initial) return EMPTY_FORM
  return {
    full_name: initial.full_name ?? '',
    age: initial.age ? String(initial.age) : '',
    location: initial.location ?? '',
    modalities: initial.modalities ?? '',
    practice_status: (initial.practice_status as PracticeStatus) ?? '',
    persona: initial.persona ?? '',
    mission: initial.mission ?? '',
    services: initial.services ?? '',
  }
}

function isBasicsStepComplete(values: FormState): boolean {
  return !!(
    values.full_name.trim() &&
    values.age.trim() &&
    values.location.trim() &&
    values.modalities.trim() &&
    values.practice_status
  )
}

export default function OnboardingModal({ userId, displayName, initial, onComplete, onClose }: Props) {
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<FormState>(() => initFormFromProfile(initial))
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  function handleFieldChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleNext() {
    if (step === 0 && !isBasicsStepComplete(values)) return
    if (step < STEPS.length - 1) setStep((s) => s + 1)
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1)
  }

  const ageNum = values.age ? parseInt(values.age, 10) : NaN
  const completeProfile: UserProfile = {
    display_name: displayName,
    full_name: values.full_name.trim(),
    age: Number.isFinite(ageNum) ? ageNum : null,
    location: values.location.trim(),
    modalities: values.modalities.trim(),
    practice_status: values.practice_status,
    persona: values.persona.trim(),
    mission: values.mission.trim(),
    services: values.services.trim(),
  }

  async function handleSubmit() {
    setSaving(true)
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: completeProfile.full_name,
        age: completeProfile.age,
        location: completeProfile.location,
        modalities: completeProfile.modalities,
        practice_status: completeProfile.practice_status,
        persona: completeProfile.persona,
        mission: completeProfile.mission,
        services: completeProfile.services,
      })
      .select()

    setSaving(false)

    if (error) {
      console.error('Onboarding save failed:', error)
      alert(`Failed to save profile: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      console.error('Onboarding save returned 0 rows — RLS is blocking the upsert', { userId })
      alert('Profile save was blocked. Please refresh and try again.')
      return
    }

    try {
      localStorage.setItem(`onboarding_done_${userId}`, '1')
    } catch {}

    onComplete(completeProfile)
  }

  function handleSkip() {
    try {
      localStorage.setItem(`onboarding_done_${userId}`, '1')
    } catch {}
    if (onClose) onClose()
    else onComplete(completeProfile)
  }

  const inputCls =
    'w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#C5A059]/50 transition-colors'

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
              {onClose ? 'Close' : 'Skip for now'}
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
          {current.kind === 'basics' ? (
            <>
              <label className="block text-white text-xs font-semibold uppercase tracking-wider mb-1">
                About You
              </label>
              <p className="text-white/35 text-xs leading-relaxed mb-3">
                The basics Letizia uses to address you by name and tailor every reply.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-white/60 text-[10px] uppercase tracking-wider mb-1">
                    Name & Surname
                  </label>
                  <input
                    type="text"
                    value={values.full_name}
                    onChange={(e) => handleFieldChange('full_name', e.target.value)}
                    placeholder="e.g. Sofia Mendes"
                    className={inputCls}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-white/60 text-[10px] uppercase tracking-wider mb-1">
                      Age
                    </label>
                    <input
                      type="number"
                      min={16}
                      max={120}
                      value={values.age}
                      onChange={(e) => handleFieldChange('age', e.target.value)}
                      placeholder="e.g. 34"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 text-[10px] uppercase tracking-wider mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={values.location}
                      onChange={(e) => handleFieldChange('location', e.target.value)}
                      placeholder="e.g. London, UK"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white/60 text-[10px] uppercase tracking-wider mb-1">
                    Modalities of Healing
                  </label>
                  <input
                    type="text"
                    value={values.modalities}
                    onChange={(e) => handleFieldChange('modalities', e.target.value)}
                    placeholder="e.g. Sound healing, breathwork, reiki"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-white/60 text-[10px] uppercase tracking-wider mb-1">
                    Practice Status
                  </label>
                  <select
                    value={values.practice_status}
                    onChange={(e) =>
                      handleFieldChange('practice_status', e.target.value as PracticeStatus)
                    }
                    className={`${inputCls} cursor-pointer appearance-none`}
                  >
                    {PRACTICE_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#1A2C41]">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              <label className="block text-white text-xs font-semibold uppercase tracking-wider mb-1">
                {current.label}
              </label>
              <p className="text-white/35 text-xs leading-relaxed mb-3">{current.description}</p>
              <textarea
                key={current.key}
                value={values[current.key]}
                onChange={(e) => handleFieldChange(current.key, e.target.value)}
                placeholder={current.placeholder}
                rows={6}
                className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#C5A059]/50 resize-none transition-colors leading-relaxed"
                autoFocus
              />
            </>
          )}
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
              disabled={current.kind === 'basics' && !isBasicsStepComplete(values)}
              className="bg-[#C5A059] hover:bg-[#C5A059]/90 disabled:opacity-40 disabled:cursor-not-allowed text-[#1A2C41] font-semibold text-sm px-6 py-2 rounded-xl transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
