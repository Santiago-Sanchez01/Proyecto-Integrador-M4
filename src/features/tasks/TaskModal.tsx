import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import './task-modal.css'

type TaskModalProps = {
  titleId: string
  children: ReactNode
  drawer?: boolean
  initialFocus?: RefObject<HTMLElement | null>
  fallbackFocus: RefObject<HTMLButtonElement | null>
  onRequestClose: () => void
}

export default function TaskModal({ titleId, children, drawer = false, initialFocus, fallbackFocus, onRequestClose }: TaskModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const fallback = fallbackFocus.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    initialFocus?.current?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      const target = opener?.isConnected ? opener : fallback
      if (target?.isConnected) target.focus()
    }
  }, [initialFocus, fallbackFocus])

  return <dialog ref={ref} className={`task-modal${drawer ? ' task-modal--drawer' : ''}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onRequestClose() }} onKeyDown={event => {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]')]
    const first = controls[0]
    const last = controls.at(-1)
    if (!first) { event.preventDefault(); event.currentTarget.focus() }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }}><div className="task-modal__inner">{children}</div></dialog>
}
