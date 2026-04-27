export type PracticeStatus = '' | 'full_time' | 'part_time' | 'starting_out'

export interface UserProfile {
  display_name: string
  full_name: string
  age: number | null
  location: string
  modalities: string
  practice_status: PracticeStatus
  persona: string
  mission: string
  services: string
}

const PRACTICE_STATUS_LABEL: Record<Exclude<PracticeStatus, ''>, string> = {
  full_time: 'Full-time healer',
  part_time: 'Part-time healer',
  starting_out: 'Just starting out',
}

export function buildProfileContext(profile: UserProfile): string {
  const fullName = (profile.full_name ?? '').trim()
  const location = (profile.location ?? '').trim()
  const modalities = (profile.modalities ?? '').trim()
  const persona = (profile.persona ?? '').trim()
  const mission = (profile.mission ?? '').trim()
  const services = (profile.services ?? '').trim()

  const basics: string[] = []
  if (fullName) basics.push(`Name: ${fullName}`)
  if (profile.age && profile.age > 0) basics.push(`Age: ${profile.age}`)
  if (location) basics.push(`Location: ${location}`)
  if (modalities) basics.push(`Modalities: ${modalities}`)
  if (profile.practice_status) {
    basics.push(`Practice status: ${PRACTICE_STATUS_LABEL[profile.practice_status]}`)
  }

  const longform: string[] = []
  if (persona) longform.push(`## Who I Am\n${persona}`)
  if (mission) longform.push(`## My Business Mission\n${mission}`)
  if (services) longform.push(`## My Services & Pricing\n${services}`)

  if (basics.length === 0 && longform.length === 0) return ''

  const firstName = fullName.split(/\s+/)[0]
  const nameDirective = firstName
    ? `\n**IMPORTANT**: Always address her by her first name (${firstName}) in a warm, natural way — not in every sentence, but at least once per reply, ideally near the opening. Never address her generically as "beautiful," "gorgeous," or "darling" alone without her name.\n`
    : ''

  return `You are speaking with the following wellness professional. Always use this context to personalise every response — reference their specific background, mission, and services rather than speaking generically.

---
${basics.length > 0 ? `## About Her\n${basics.join('\n')}\n\n` : ''}${longform.join('\n\n')}
---
${nameDirective}
`
}
