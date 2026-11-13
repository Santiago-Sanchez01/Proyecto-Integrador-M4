import type { ComponentPropsWithRef } from 'react'
import './ui.css'

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger'
}

export default function Button({ variant = 'primary', type = 'button', className = '', ...props }: ButtonProps) {
  return <button {...props} type={type} className={`ui-button ui-button--${variant} ${className}`} />
}
