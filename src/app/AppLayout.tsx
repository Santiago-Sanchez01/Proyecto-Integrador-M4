import { Outlet, useLocation } from 'react-router'
import AppNavigation from './AppNavigation'
import SectionHeader from './SectionHeader'
import DesignSystemPreview from './DesignSystemPreview'
import { sections } from './sections'
import './AppLayout.css'

export default function AppLayout() {
  const { pathname } = useLocation()
  const section = sections.find(({ path }) => path === pathname.replace(/\/+$/, '')) ?? sections[0]

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <AppNavigation />
      <main id="main-content" className="app-content" tabIndex={-1}>
        <SectionHeader title={section.title} description={section.description} />
        <Outlet />
        <DesignSystemPreview />
      </main>
    </div>
  )
}
