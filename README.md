# Workspace

Aplicación de gestión individual de tareas. Hito 01.2: fundaciones técnicas.

## Comandos

- `npm install`: instalar dependencias.
- `npm run dev`: iniciar Vite.
- `npm run typecheck`: verificar TypeScript de aplicación y configuración.
- `npm run build`: verificar TypeScript y generar `dist/`.
- `npm run lint`: ejecutar Oxlint.
- `npm test`: ejecutar Vitest una vez.
- `npm run test:watch`: ejecutar Vitest en modo interactivo.
- `npm run preview`: servir el build localmente.

## Organización

- `src/app/`: composición y rutas.
- `src/features/`: auth, tasks, jornada y summary.
- `src/components/`: componentes compartidos utilizados.
- `src/test/setup.ts`: jest-dom y limpieza del DOM entre pruebas.

Las rutas `/login`, `/register`, `/jornada`, `/tareas` y `/resumen` son placeholders
públicos. `/` redirige a `/jornada`. Las rutas desconocidas muestran una página no
encontrada. No hay autenticación ni persistencia implementadas.

## Alcance acordado del MVP

- Título y descripción obligatorios.
- Una tarea en foco persistente por usuario; posteriormente se guardará como
  `focusTaskId` en `users/{uid}`.
- Resumen del estado actual de todas las tareas, sin filtros temporales.
- Sin vencimientos, zonas horarias, prioridades ni colaboración.
- Firebase, Vercel Functions y AWS SES quedan para otros hitos.

## Hito 01.3A: Midnight Copper V2

`src/styles/tokens.css` define la paleta aprobada, espaciados, radios y tiempos.
`global.css` define la base y foco visible. Inter se carga desde Google Fonts con
`display=swap` y fallback `system-ui`; sin conexión, se usa la fuente del sistema.
Se agregaron tokens funcionales de error (`#FFA6A6`) y borde de control
(`#718797`) para garantizar contraste, conservando los ocho colores iniciales.

Componentes en `src/components/ui/`:

- `Button`: variantes `primary`, `secondary` y `danger`; `type="button"` por
  defecto, acepta atributos y referencias nativos.
- `Input` y `Textarea`: `label` obligatorio, `helpText` y `error` opcionales,
  identificadores automáticos, soporte de atributos, referencias y `required`.
  Ayuda y error se asocian mediante `aria-describedby`; el error activa
  `aria-invalid`. Las descripciones externas se conservan.
- `Card`: contenedor neutro con atributos nativos, sin rol interactivo implícito.

La muestra temporal se abre desde “Ver componentes · Midnight Copper V2” al pie
de cualquier página. No agrega rutas ni modifica los placeholders. El formulario
solo demuestra validación local; no guarda ni envía datos. Para retirarla basta
quitar `DesignSystemPreview` de `App.tsx` y eliminar sus archivos y prueba.

Se verificaron 12 pruebas, navegación con Tab/Enter/Espacio, foco visible y tamaños
320, 375 y 1280 px en Chrome headless sin desbordamiento horizontal. La muestra
usa una columna en móvil y dos desde 800 px. Los controles tienen al menos 44 px
de alto. `prefers-reduced-motion` reduce las transiciones a cero.

Contrastes calculados: texto principal sobre superficie 13,90:1; secundario
8,87:1; texto oscuro sobre cobre 7,73:1; error sobre superficie 8,63:1. El borde
de control tiene al menos 3,49:1 sobre las tres superficies. Los controles
deshabilitados se distinguen por opacidad y no admiten interacción.

## Entornos y despliegue posterior

Este hito no requiere variables de entorno. `.env` y `.env.*` están excluidos de
Git, salvo `.env.example`, que podrá documentar variables sin secretos cuando
existan integraciones. No guardar credenciales ni usar `VITE_` para secretos.

En Vercel, seleccionar `workspace/` como raíz si se importa el directorio padre.
Usar el preset Vite, `npm run build` y salida `dist/`. `vercel.json` incluye el
fallback SPA para acceso directo a rutas. Revisarlo al incorporar `/api`.
No se realizó un despliegue en este hito.
