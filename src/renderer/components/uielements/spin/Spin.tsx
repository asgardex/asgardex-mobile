import clsx from 'clsx'

type SpinProps = {
  className?: string
  spinning?: boolean
  tip?: string // optional status text
  children?: React.ReactNode
}

export const Spin = ({ className, spinning = true, tip, children }: SpinProps) => {
  if (!children) {
    return (
      <div className={clsx('flex flex-col items-center justify-center space-y-2', className)}>
        {spinning && (
          <>
            <div className="animate-spin rounded-full border-t-2 border-b-2 border-turquoise h-6 w-6" />
            {tip && <p className="text-sm text-gray-600">{tip}</p>}
          </>
        )}
      </div>
    )
  }

  return (
    <div className={clsx('relative', className)}>
      {spinning && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 space-y-2">
          <div className={`animate-spin rounded-full border-t-2 border-b-2 border-turquoise h-6 w-6`} />
          {tip && <p className="text-sm text-text0 dark:text-text0d">{tip}</p>}
        </div>
      )}
      {children}
    </div>
  )
}
