import { cn } from '../utils'

interface Props {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  message?: string
}

export default function LoadingSpinner({ className, size = 'md', message }: Props) {
  const sizeClass = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }[size]

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className={cn('border-2 border-brand-600/30 border-t-brand-400 rounded-full animate-spin', sizeClass)} />
      {message && <p className="text-slate-400 text-sm">{message}</p>}
    </div>
  )
}
