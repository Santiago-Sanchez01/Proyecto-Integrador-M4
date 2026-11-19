# Workspace.

**Un espacio personal para organizar tareas y enfocar tu jornada.**

Workspace ayuda a quienes trabajan en equipo a gestionar sus propias tareas,
elegir qué atender primero y consultar su progreso desde el teléfono o la computadora.

**Demo pública** · [workspace-m4.vercel.app](https://workspace-m4.vercel.app)

## Funcionalidades

- **Acceso personal.** Registro e inicio de sesión con email y contraseña, acceso con Google, cierre de sesión y rutas protegidas.
- **Mis tareas.** Creá, editá, filtrá, completá y eliminá tareas. Cloud Firestore guarda los cambios y sincroniza la lista mediante `onSnapshot`.
- **Mi Jornada.** Elegí una tarea pendiente como foco y consultá el progreso de tu lista.
- **Mi Resumen.** Revisá tus tareas, totales y avance desde una misma vista.
- **Diseño responsive y datos privados.** La navegación se adapta a pantallas móviles y de escritorio. Cada cuenta accede a sus tareas mediante su UID. Las vistas informan estados de carga y errores.

## Stack

| Responsabilidad | Tecnología |
| --- | --- |
| Frontend | React, TypeScript y Vite |
| Navegación | React Router |
| Autenticación | Firebase Authentication |
| Base de datos | Cloud Firestore |
| API | Vercel Functions y Firebase Admin |
| Correo | Adaptador Amazon SES v2, con envío deshabilitado |
| Pruebas | Vitest, React Testing Library y emulador de Firestore |
| Alojamiento | Vercel |

## Arquitectura

- **Vistas y componentes** en [`src/app`](src/app), [`src/features`](src/features) y [`src/components`](src/components). El router expone `/login` y `/register`, y protege `/jornada`, `/tareas` y `/resumen`.
- **Hooks y servicios Web.** `AuthProvider` observa la sesión de Firebase. `useTasks` y `useTaskFocus` conectan las vistas con los servicios Firestore y administran las suscripciones. Mi Resumen obtiene sus datos por esta vía.
- **Contratos HTTP** en [`shared`](shared). Definen las solicitudes y respuestas compartidas entre el cliente y las Functions.
- **Functions** en [`api`](api). `POST /api/summary` define la consulta autenticada del resumen. `POST /api/summary/send` define la solicitud de envío, sujeta a la política de entorno. La disponibilidad de ambas rutas en Production se detalla abajo.
- **Servicios de servidor** en [`server`](server). Firebase Admin verifica el token y su revocación. El código deriva el UID de esa identidad, consulta sus tareas y resuelve el destinatario del correo desde la cuenta verificada. La SPA usa Firebase Web directamente para mostrar Mi Resumen.

## Instalación local

Necesitás Node.js **24.x**, npm y una aplicación Web registrada en un proyecto
Firebase con Firestore y Email/Password habilitados. Java **21** se usa para las
pruebas de Firestore. Para probar las Functions necesitás también Vercel CLI.

```bash
git clone https://github.com/Santiago-Sanchez01/Proyecto-Integrador-M4.git
cd Proyecto-Integrador-M4
npm ci
```

Copiá [`.env.example`](.env.example) a `.env.local` si todavía no existe.
Completá las cuatro variables Firebase Web con los datos de la misma
aplicación registrada y ejecutá `npm run dev`. Verificá que el proyecto
Firestore de desarrollo tenga las [reglas del repositorio](firestore.rules).

Para probar Google, habilitá el proveedor en **Firebase Console → Authentication
→ Sign-in method**, seleccioná el correo de asistencia y agregá el hostname de
la app en **Authentication → Settings → Authorized domains**. Para desarrollo
local, agregá `localhost` si falta. [Guía de Firebase](https://firebase.google.com/docs/auth/web/google-signin)

### Frontend y Functions

`npm run dev` sirve el frontend Vite. `npm run build` genera `dist` y
`npm run preview` sirve ese build estático. Para probar `/api/*`, ejecutá
`vercel dev` desde la raíz del proyecto vinculado. Las solicitudes autenticadas
requieren un proyecto Admin explícito y Application Default Credentials (ADC)
autorizadas en el entorno local.

### Variables de entorno

| Ámbito | Variables y finalidad |
| --- | --- |
| Firebase Web | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` y `VITE_FIREBASE_APP_ID` conectan el navegador con Firebase. |
| Interfaz de correo | `VITE_SUMMARY_EMAIL_ENABLED=false` mantiene deshabilitado el control de envío. |
| Firebase Admin | `FIREBASE_ADMIN_PROJECT_ID` identifica el proyecto. El SDK obtiene su identidad de ADC en el servidor. |
| Política de correo | `SUMMARY_EMAIL_ENABLED=false` y `SUMMARY_EMAIL_RUNTIME=disabled` bloquean el envío. |
| HTTP y SES | `NODEJS_HELPERS=0` conserva el cuerpo HTTP para validarlo antes de procesarlo. `AWS_SES_REGION` y `SES_FROM_EMAIL` identifican la región y el remitente de una prueba local autorizada. |

Las variables `VITE_*` son públicas. Conservá credenciales privadas y archivos
ADC fuera del frontend y del repositorio. Usá [`.env.example`](.env.example)
como referencia de configuración.

## Pruebas

| Comando | Alcance | Última validación |
| --- | --- | --- |
| `npm run typecheck` | Tipos TypeScript | Aprobado |
| `npm run lint` | Análisis estático | Aprobado |
| `npm test -- --pool=threads` | Frontend con Vitest y RTL | 201 pruebas |
| `npm run test:backend -- --pool=threads` | Contratos HTTP, Auth Admin y SES simulado | 291 pruebas |
| `npm run test:rules` | Reglas y operaciones sobre el emulador de Firestore | 74 pruebas |
| `npm run build` | Build de producción | Aprobado |

**566 pruebas aprobadas sobre `main`**. Las suites de backend usan dobles de servicios y las de Firestore ejecutan el emulador sobre un proyecto demo local. La comprobación HTTP de Production se registra por separado.

## Seguridad

Las [reglas de Firestore](firestore.rules) deniegan el acceso por defecto.
Exigen que el UID autenticado coincida con el propietario de
`users/{uid}` y sus tareas. La API deriva el UID del token verificado, valida
método y tamaño de la solicitud y resuelve el destinatario del correo desde
Firebase Auth. Firebase Admin aplica la autorización en el servidor y su
identidad debe contar con los permisos mínimos. Las credenciales de Admin
y AWS se mantienen del lado servidor.

## Production y limitaciones

Vercel publica `main` con el preset Vite, Node.js 24 según `package.json` y el build `npm run build` en `dist`. [`vercel.json`](vercel.json) permite abrir directamente las rutas de la SPA. [Configuración de Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite)

- **SPA.** El desarrollador comprobó en un iPhone real el acceso con email y contraseña, la navegación, las tareas persistidas, la creación y eliminación de tareas y el diseño responsive. También reportó un inicio de sesión exitoso con Google en escritorio. El smoke de entrega comprobó la respuesta pública de las rutas.
- **Functions de resumen.** En el smoke del commit base `99a1a17`, `/api/summary` y `/api/summary/send` respondieron HTTP 500. Los registros de Production mostraron `ERR_MODULE_NOT_FOUND` al cargar las Functions. Mi Resumen y el CRUD utilizan el SDK Web de Firestore. La identidad de Firebase Admin para Production queda pendiente de validación.
- **Amazon SES.** La rama `feat/summary-email-cloud-integration` contiene el desarrollo de backend para la guarda distribuida y la federación. El operador validó Firebase Admin OIDC y AWS STS con HTTP 200 en Preview. También recibió un correo enviado manualmente desde AWS Console. El envío originado en Workspace sigue pendiente de validación y permanece deshabilitado en Production.

## Uso de IA

El trabajo con Codex se organizó por etapas. Primero se definieron los contratos
de autenticación y tareas, luego se revisaron los cambios y se ejecutaron pruebas
de regresión. Esa revisión dejó controles concretos para limitar el cuerpo HTTP,
derivar el destinatario desde Firebase y bloquear el envío ante una configuración
contradictoria.

En integración, Vitest pasó mientras las Functions fallaban al cargar en Vercel.
Se reprodujeron por separado la resolución de imports ESM y la incompatibilidad
entre `jwks-rsa` y JOSE, y se comprobó el artefacto empaquetado en Node 24.
El desarrollador realizó las pruebas en dispositivos y con servicios reales.
Cada resultado se documentó según lo que demostraba. Esa distinción llevó a
mantener la experimentación en Preview y el correo deshabilitado en Production.
