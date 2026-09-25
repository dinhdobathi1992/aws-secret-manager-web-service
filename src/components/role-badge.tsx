import type { Role } from '@/lib/auth/rbac'
import { BadgeTag, type Tone } from './badge-tag'

const TONE: Record<Role, Tone> = { reader: 'neutral', writer: 'blue', admin: 'amber' }

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <BadgeTag tone={TONE[role]} className={className}>
      {role}
    </BadgeTag>
  )
}
