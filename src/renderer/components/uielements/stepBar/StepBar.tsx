import clsx from 'clsx'

export type Props = {
  size?: number
  className?: string
}

export const StepBar = ({ size = 150, className }: Props): JSX.Element => {
  return (
    <div className={clsx('flex flex-col justify-center w-[9px]', className)}>
      <div className="w-[9px] h-[9px] rounded-full bg-gray1 dark:bg-gray1d" />
      <div className="w-[5px] border-r border-solid border-gray1 dark:border-gray1d" style={{ height: `${size}px` }} />
      <div className="w-[9px] h-[9px] rounded-full bg-gray1 dark:bg-gray1d" />
    </div>
  )
}
