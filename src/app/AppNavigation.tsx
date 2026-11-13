import { NavLink } from 'react-router'
import { sections } from './sections'

export default function AppNavigation() {
  return (
    <aside className="app-sidebar">
      <p className="app-brand">Workspace<span>Tu espacio de trabajo personal</span></p>
      <nav className="app-navigation" aria-label="Secciones de Workspace">
        <ul>
          {sections.map(({ path, title, icon }) => (
            <li key={path}>
              <NavLink to={path} className={({ isActive }) => `app-navigation__link${isActive ? ' is-active' : ''}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  {icon === 'focus' && <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>}
                  {icon === 'tasks' && <><path d="m3 6 2 2 3-4M11 6h10M3 13l2 2 3-4M11 13h10M3 20h5M11 20h10" /></>}
                  {icon === 'summary' && <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></>}
                </svg>
                <span>{title}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
