import { Label } from '../label'

export type Props = {
  title: string
  children: React.ReactNode
}

export const PoolShareCard = ({ title, children }: Props) => {
  return (
    <div className="rounded-lg border border-solid border-gray0 bg-bg1 p-4 dark:border-gray0d dark:bg-bg1d">
      <Label className="px-4 pb-4 text-[16px]" align="center" textTransform="uppercase" weight="bold">
        {title}
      </Label>
      <div>{children}</div>
    </div>
  )
}
