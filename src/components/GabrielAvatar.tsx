import { clsx } from 'clsx'

interface GabrielAvatarProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  alt?: string
}

const sizeClasses = {
  sm: 'size-7',
  md: 'size-8',
  lg: 'size-10',
}

export function GabrielAvatar({
  size = 'md',
  className,
  alt = 'Gabriel',
}: GabrielAvatarProps) {
  return (
    <span
      className={clsx(
        'relative inline-flex shrink-0 overflow-hidden rounded-full',
        'bg-[var(--surface-strong)] ring-1 ring-[var(--gold)]/70',
        'shadow-[0_0_0_3px_var(--gold-soft)]',
        sizeClasses[size],
        className,
      )}
    >
      <img
        src="/brand/gabriel-avatar.jpeg"
        alt={alt}
        className="size-full object-cover"
      />
    </span>
  )
}
