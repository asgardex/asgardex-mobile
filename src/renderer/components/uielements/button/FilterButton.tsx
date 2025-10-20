import { Button } from '@headlessui/react'
import clsx from 'clsx'

type FilterButtonProps = {
  active?: boolean
  className?: string
  children: React.ReactNode
  onClick?: () => void
}

export const FilterButton = ({ active = false, className, children, onClick }: FilterButtonProps) => {
  return (
    <Button
      className={clsx(
        // Base styles
        'mr-[10px] last:mr-0 px-3 min-w-0 h-8 rounded-2xl border uppercase text-11',
        // Active state
        active === true
          ? 'bg-turquoise text-white border-turquoise hover:bg-turquoise/90'
          : 'bg-bg0 dark:bg-bg0d text-text2 dark:text-text2d border-gray1 dark:border-gray1d hover:bg-bg2/90 hover:dark:bg-bg2d/90',
        className
      )}
      onClick={onClick}>
      {children}
    </Button>
  )
}
