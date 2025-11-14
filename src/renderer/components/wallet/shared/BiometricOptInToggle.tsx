import { CheckButton } from '../../uielements/button/CheckButton'

type Props = {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
  className?: string
}

export const BiometricOptInToggle = ({ checked, onChange, disabled = false, label, className }: Props) => (
  <div className={['mb-4 w-full', className].filter(Boolean).join(' ')}>
    <CheckButton checked={checked} clickHandler={onChange} disabled={disabled} className="!justify-start">
      <span className="text-left text-sm text-text0 dark:text-text0d">{label}</span>
    </CheckButton>
  </div>
)
