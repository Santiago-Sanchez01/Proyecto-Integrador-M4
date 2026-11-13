import { useEffect, useRef } from 'react'

type SectionHeaderProps = {
  title: string
  description: string
}

export default function SectionHeader({ title, description }: SectionHeaderProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  const previousTitle = useRef(title)

  useEffect(() => {
    if (previousTitle.current !== title) {
      heading.current?.focus()
      previousTitle.current = title
    }
  }, [title])

  return (
    <header className="section-header">
      <h1 ref={heading} tabIndex={-1}>{title}</h1>
      <p>{description}</p>
    </header>
  )
}
