export interface UserProfile {
  display_name: string
  persona: string
  mission: string
  services: string
}

export function buildProfileContext(profile: UserProfile): string {
  const parts: string[] = []

  if (profile.persona.trim()) {
    parts.push(`## Who I Am\n${profile.persona.trim()}`)
  }
  if (profile.mission.trim()) {
    parts.push(`## My Business Mission\n${profile.mission.trim()}`)
  }
  if (profile.services.trim()) {
    parts.push(`## My Services & Pricing\n${profile.services.trim()}`)
  }

  if (parts.length === 0) return ''

  return `You are speaking with the following wellness professional. Always use this context to personalise every response — reference their specific background, mission, and services rather than speaking generically.

---
${parts.join('\n\n')}
---

`
}
