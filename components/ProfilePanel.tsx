'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle, Loader } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/profile'

interface Props {
  userId: string
  initial: UserProfile
  onChange: (profile: UserProfile) => void
}

type SaveStatus = 'idle' | 'saving' | 'saved'

const FIELDS: { key: keyof Omit<UserProfile, 'display_name'>; label: string; description: string; placeholder: string }[] = [
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

export default function ProfilePanel({ userId, initial, onChange }: Props) {
  const [profile, setProfile] = useState<UserProfile>(initial)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  // Sync if parent updates (e.g. on initial load)
  useEffect(() => {
    setProfile(initial)
  }, [initial.persona, initial.mission, initial.services])

  const saveToSupabase = useCallback(async (updated: UserProfile) => {
    setSaveStatus('saving')
    const { error } = await supabase
      .from('profiles')
      .update({
        persona: updated.persona,
        mission: updated.mission,
        services: updated.services,
      })
      .eq('id', userId)

    if (!error) {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('idle')
      console.error('Profile save error', error)
    }
  }, [userId, supabase])

  function handleChange(key: keyof UserProfile, value: string) {
    const updated = { ...profile, [key]: value }
    setProfile(updated)
    onChange(updated)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveToSupabase(updated), 800)
  }

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
        {FIELDS.map((field) => (
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
