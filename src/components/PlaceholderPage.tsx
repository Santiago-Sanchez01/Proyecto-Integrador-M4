type PlaceholderPageProps = {
  title: string
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section>
      <h1>{title}</h1>
      <p>Esta sección se implementará en una próxima etapa.</p>
    </section>
  )
}
