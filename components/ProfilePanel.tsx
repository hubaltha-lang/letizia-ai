'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle, Loader } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile, PracticeStatus } from '@/lib/profile'

interface Props {
  userId: string
  initial: UserProfile
  onChange: (profile: UserProfile) => void
}

type SaveStatus = 'idle' | 'saving' | 'saved'

const LONGFORM_FIELDS: { key: 'persona' | 'mission' | 'services'; label: string; description: string; placeholder: string }[] = [
  {
    key: 'persona',
    label: 'Who I Am',
    description: 'Your background, certifications, and your "why." Used to write bios, About Me sections, and add personal authenticity to every message.',
    placeholder: 'e.g. I\'m a certified sound healer and breathwork facilitator with 8 years of experience. I trained at the Sound Healing Academy in London and hold a Level 3 certification in Trauma-Informed Breathwork. My "why" is...',
  },
  {
    key: 'mission',
    label: 'My Business Mission',
    description: 'The specific problem you solve and who you solve it for. This becomes the hook of every marketing message Letizia writes for you.',
    placeholder: 'e.g. I help burned-out corporate teams at mid-size tech companies reduce stress and boost focus through science-backed sound healing sessions — without disrupting their workflow or requiring any prior wellness experience.',
  },
  {
    key: 'services',
    label: 'My Services & Pricing',
    description: 'Your packages and price points. Letizia uses this to recommend the right offer for the right lead and never leaves money on the table.',
    placeholder: 'e.g.\n• Corporate Sound Bath (90 min, up to 30 people) — £2,500\n• Executive 1:1 Breathwork Session (60 min) — £250\n• Monthly Wellness Retainer (4 sessions/month) — £1,800/mo\n• Team Retreat (full day) — £5,000',
  },
]

const PRACTICE_STATUS_OPTIONS: { value: PracticeStatus; label: string }[] = [
  { value: '', label: '—' },
  { value: 'full_time', label: 'Full-time healer' },
  { value: 'part_time', label: 'Part-time healer' },
  { value: 'starting_out', label: 'Just starting out' },
]

export default function ProfilePanel({ userId, initial, onChange }: Props) {
  const [profile, setProfile] = useState<UserProfile>(initial)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  useEffect(() => {
    setProfile(initial)
  }, [
    initial.full_name,
    initial.age,
    initial.location,
    initial.modalities,
    initial.practice_status,
    initial.persona,
    initial.mission,
    initial.services,
  ])

  const saveToSupabase = useCallback(async (updated: UserProfile) => {
    setSaveStatus('saving')
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: updated.full_name,
        age: updated.age,
        location: updated.location,
        modalities: updated.modalities,
        practice_status: updated.practice_status,
        persona: updated.persona,
        mission: updated.mission,
        services: updated.services,
      })
      .select()

    if (error) {
      setSaveStatus('idle')
      console.error('Profile save error:', error)
      return
    }
    if (!data || data.length === 0) {
      setSaveStatus('idle')
      console.error('Profile save returned 0 rows — RLS may be blocking', { userId })
      return
    }

    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [userId, supabase])

  function handleChange<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    const updated = { ...profile, [key]: value }
    setProfile(updated)
    onChange(updated)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveToSupabase(updated), 800)
  }

  const inputCls =
    'w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#C5A059]/50 transition-colors'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white text-sm font-semibold">My Profile</h2>
            <p className="text-white/40 text-xs mt-0.5">Letizia reads this before every reply</p>
          </div>
          <div className="h-6 flex items-center">
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-1.5 text-white/40 text-xs">
                <Loader size={11} className="animate-spin" />
                <span>Saving</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-1.5 text-[#C5A059] text-xs">
                <CheckCircle size={11} />
                <span>Saved</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 px-5 py-4 space-y-6">
        {/* About You — structured section */}
        <div>
          <label className="block text-white text-xs font-semibold uppercase tracking-wider mb-1">
            About You
          </label>
          <p className="text-white/35 text-xs leading-relaxed mb-3">
            The basics Letizia uses to address you by name and tailor every reply to where you are in your practice.
          </p>

          <div className="space-y-2.5">
            <div>
              <label className="block text-white/60 text-[10px] uppercase tracking-wider mb-1">Name & Surname</label>
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                placeholder="e.g. Sofia Mendes"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-white/60 text-[10px] uppercase tracking-wider mb-1">Age</label>
                <input
                  type="number"
                  min={16}
                  max={120}
                  value={profile.age ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    handleChange('age', v === '' ? null : parseInt(v, 10))
                  }}
                  placeholder="e.g. 34"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-white/60 text-[10px] uppercase tracking-wider mb-1">Location</label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="e.g. London, UK"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-white/60 text-[10px] uppercase tracking-wider mb-1">Modalities of Healing</label>
              <input
                type="text"
                value={profile.modalities}
                onChange={(e) => handleChange('modalities', e.target.value)}
                placeholder="e.g. Sound healing, breathwork, reiki"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-white/60 text-[10px] uppercase tracking-wider mb-1">Practice Status</label>
              <select
                value={profile.practice_status}
                onChange={(e) => handleChange('practice_status', e.target.value as PracticeStatus)}
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
        </div>

        {/* Longform fields */}
        {LONGFORM_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="block text-white text-xs font-semibold uppercase tracking-wider mb-1">
              {field.label}
            </label>
            <p className="text-white/35 text-xs leading-relaxed mb-2">{field.description}</p>
            <textarea
              value={profile[field.key]}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={5}
              className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#C5A059]/50 resize-none transition-colors leading-relaxed"
            />
          </div>
        ))}

        <div className="pb-4">
          <div className="bg-[#C5A059]/10 border border-[#C5A059]/25 rounded-xl px-4 py-3">
            <p className="text-[#C5A059] text-xs font-semibold mb-1">How this works</p>
            <p className="text-white/40 text-xs leading-relaxed">
              Every time you start a new chat, Letizia reads your profile first. The more detail you add, the more personalised and on-brand every response will be.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
