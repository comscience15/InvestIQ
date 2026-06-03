import type { SignalType } from '../types'
import { signalBadgeClass } from '../utils'
import { cn } from '../utils'

interface Props {
  signal: SignalType
  className?: string
}

export default function SignalBadge({ signal, className }: Props) {
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-semibold border', signalBadgeClass(signal), className)}>
      {signal}
    </span>
  )
}
