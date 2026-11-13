export function authDestination(state: unknown): string {
  const from = typeof state === 'object' && state !== null && 'from' in state ? state.from : undefined
  // Only internal MVP routes can be restored; never navigate to arbitrary URLs.
  return typeof from === 'string' && /^\/(jornada|tareas|resumen)\/?(?:[?#].*)?$/.test(from) ? from : '/jornada'
}
