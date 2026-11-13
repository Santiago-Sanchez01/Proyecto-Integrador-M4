const messages = {
  'no-session': 'Iniciá sesión para gestionar tus tareas.',
  'session-changed': 'La sesión cambió. Volvé a intentar desde tu cuenta actual.',
  'invalid-content': 'El título y la descripción deben contener texto.',
  'invalid-status': 'El estado de la tarea no es válido.',
  'invalid-id': 'El identificador de la tarea no es válido.',
  'invalid-data': 'No pudimos interpretar los datos de las tareas.',
  'pending-writes': 'Hay cambios pendientes de confirmación. Esperá la actualización de las tareas.',
} as const

export function taskError(code: keyof typeof messages) {
  return Object.assign(new Error(messages[code]), { code: `tasks/${code}` })
}

export function taskErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
  for (const [key, message] of Object.entries(messages)) {
    if (code === `tasks/${key}`) return message
  }
  switch (code) {
    case 'permission-denied': return 'No tenés permiso para acceder a estas tareas.'
    case 'unauthenticated': return messages['no-session']
    case 'unavailable': return 'No pudimos conectarnos con las tareas. Revisá tu conexión.'
    case 'not-found': return 'La tarea ya no está disponible.'
    case 'failed-precondition': return 'No pudimos consultar las tareas. Revisá la configuración de Firestore.'
    default: return 'No pudimos completar la operación de tareas. Volvé a intentar.'
  }
}
