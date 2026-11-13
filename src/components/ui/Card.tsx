import type { ComponentPropsWithRef } from 'react'
import './ui.css'

export default function Card({ className = '', ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} className={`ui-card ${className}`} />
}
