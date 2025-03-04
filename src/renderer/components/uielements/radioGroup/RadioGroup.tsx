import clsx from 'clsx'

export const RadioGroup = ({
  options,
  activeIndex = 0,
  onChange
}: {
  options: { label: React.ReactNode; value: string | number }[]
  activeIndex?: number
  onChange: (index: number) => void
}) => {
  return (
    <div className="h-fit">
      <div className="flex gap-x-[2px] rounded-lg border border-solid border-gray1 bg-bg0 p-[1px] dark:border-gray0d dark:bg-bg0d">
        {options.map((option, index) => (
          <div
            key={option.value}
            className={clsx(
              'cursor-pointer rounded-lg p-2',
              // 'first:rounded-l-lg last:rounded-r-lg',
              activeIndex === index
                ? 'bg-turquoise dark:bg-turquoise-dark'
                : 'bg-bg0 hover:bg-turquoise/20 dark:bg-bg0d hover:dark:bg-turquoise-dark/20'
            )}
            onClick={() => onChange(index)}>
            {option.label}
          </div>
        ))}
      </div>
    </div>
  )
}
