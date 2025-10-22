import clsx from 'clsx'

type ConnectionColors = 'red' | 'yellow' | 'green'

type Props = {
  className?: string
  color: ConnectionColors
}

type ConnectionStatusProps = Props & React.HTMLProps<HTMLDivElement>

const colorMap: Record<ConnectionColors, string> = {
  red: 'bg-error0 dark:bg-error0d',
  yellow: 'bg-warning0 dark:bg-warning0d',
  green: 'bg-success'
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ color, className, ...rest }) => (
  <div
    className={clsx('h-[14px] w-[14px] rounded-full border-none', colorMap[color] || colorMap.red, className)}
    {...rest}
  />
)
