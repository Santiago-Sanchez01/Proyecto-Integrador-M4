import Card from './ui/Card'

type PlaceholderPageProps = {
  title?: string
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <Card>
      {title && <h1>{title}</h1>}
      <p>Esta sección se implementará en una próxima etapa.</p>
    </Card>
  )
}
