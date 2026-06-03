import { cn, scoreBarColor } from '../utils'

interface Props {
  label: string
  score: number
  className?: string
}

export default function ScoreBar({ label, score, className }: Props) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 font-mono">{score.toFixed(0)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-border overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', scoreBarColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
