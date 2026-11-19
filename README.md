# Workspace.

**Un espacio personal para organizar tareas y enfocar tu jornada.**

Workspace ayuda a quienes trabajan en equipo a gestionar sus propias tareas,
elegir qué atender primero y consultar su progreso desde el teléfono o la computadora.

**Live Demo:** [workspace-m4.vercel.app](https://workspace-m4.vercel.app)

## Funcionalidades

- **Acceso personal.** Registro e inicio de sesión con email y contraseña, cierre de sesión y rutas protegidas. El cliente también integra el acceso con Google.
- **Mis tareas.** Creá, editá, filtrá, completá y eliminá tareas. Cloud Firestore guarda los cambios y sincroniza la lista mediante `onSnapshot`.
- **Mi Jornada.** Elegí una tarea pendiente como foco y consultá el progreso de tu lista.
- **Mi Resumen.** Revisá tus tareas, totales y avance desde una misma vista.
- **Diseño responsive y datos privados.** La navegación se adapta a pantallas móviles y de escritorio. Cada cuenta accede a sus tareas mediante su UID.

## Stack

| Responsabilidad | Tecnología |
| --- | --- |
| Frontend | React, TypeScript y Vite |
| Navegación | React Router |
| Autenticación | Firebase Authentication |
| Base de datos | Cloud Firestore |
| API | Vercel Functions y Firebase Admin |
| Correo | Amazon SES v2 |
| Pruebas | Vitest, React Testing Library y emulador de Firestore |
| Alojamiento | Vercel |

## Arquitectura

- **Vistas y componentes** en [`src/app`](src/app), [`src/features`](src/features) y [`src/components`](src/components). El router expone `/login` y `/register`, y protege `/jornada`, `/tareas` y `/resumen`.
- **Hooks y servicios Web.** `AuthProvider` observa la sesión de Firebase. `useTasks` y `useTaskFocus` conectan las vistas con los servicios Firestore y administran las suscripciones. Mi Resumen obtiene sus datos por esta vía.
- **Contratos HTTP** en [`shared`](shared). Definen las solicitudes y respuestas compartidas entre el cliente y las Functions.
- **Functions** en [`api`](api). `POST /api/summary` devuelve los datos del usuario autenticado. `POST /api/summary/send` solicita un envío manual, sujeto a la política de entorno.
- **Servicios de servidor** en [`server`](server). Firebase Admin verifica el token con control de revocación y consulta Firestore por el UID verificado. El flujo de correo resuelve el destinatario desde la cuenta verificada, renderiza el resumen e invoca el adaptador SES v2.

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
| Interfaz de correo | `VITE_SUMMARY_EMAIL_ENABLED=false` mantiene oculto el control de envío. |
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

**Total: 566 pruebas aprobadas.**

## Seguridad

Las [reglas de Firestore](firestore.rules) deniegan el acceso por defecto.
Exigen que el UID autenticado coincida con el propietario de
`users/{uid}` y sus tareas. La API deriva el UID del token verificado, valida
método y tamaño de la solicitud y resuelve el destinatario del correo desde
Firebase Auth. Firebase Admin aplica la autorización en el servidor y su
identidad debe contar con los permisos mínimos. Las credenciales de Admin
y AWS se mantienen del lado servidor.

## Guarda distribuida de correo

La modalidad local controlada conserva la guarda en memoria por defecto.
`SUMMARY_EMAIL_GUARD=firestore` selecciona, solo dentro de un runtime ya
autorizado, transacciones de Firebase Admin en `summarySendControl`. El
envío sigue bloqueado en Preview y Production.

La guarda reserva por hash de UID y clave, y persiste el inicio antes de
contactar SES. Una reserva anterior al inicio vence a los 60 segundos.
Su propietario anterior pierde el derecho a iniciar. Un inicio abandonado
se trata como incierto al vencer ese plazo y permanece bloqueado para revisión.
Las claves aceptadas reproducen el resultado sin enviar otro correo. Las
claves con fallo confirmado se rechazan. Los registros terminales carecen de
TTL automático para conservar la idempotencia.

Las reservas consumen cuota aunque fallen o se abandonen. Los valores por día
UTC son 2 por UID y 24 globales, configurables con
`SUMMARY_EMAIL_DAILY_UID_LIMIT` (1–10) y
`SUMMARY_EMAIL_DAILY_GLOBAL_LIMIT` (4–100). La capacidad global se divide entre
cuatro documentos. Cada UID usa una partición estable, por lo que puede
agotarse su capacidad con cupo disponible en otra. La suma nunca excede el
límite con la misma configuración en todas las instancias. Estos contadores
distribuyen la contención para el volumen esperado. Mantener límites uniformes
y aplicar cambios de configuración con el envío deshabilitado.

La guarda necesita permisos Admin adicionales `datastore.entities.create`,
`datastore.entities.update` y `datastore.databases.get` para abrir o revertir
transacciones, además de lectura. Las reglas vigentes
deniegan acceso web a estos registros. Antes de usar la guarda en un entorno
desplegado quedan pendientes la identidad de servidor, el alcance IAM para
escrituras, la reconciliación operativa de estados inciertos y una activación
controlada independiente de los flags actuales.

## Estado de la demo

- **Verificado en un iPhone real por el desarrollador.** Acceso con email y contraseña, navegación entre secciones, visualización de tareas persistidas, creación y eliminación, y experiencia responsive.
- **Google.** Implementado y probado con mocks. Queda pendiente confirmar una autenticación real en la demo y verificar la configuración de proveedor y dominios.
- **Firebase Admin.** La identidad de producción para el endpoint autenticado sigue pendiente de validar. La SPA consulta Firestore mediante el SDK Web.
- **Amazon SES.** Se verificó un envío manual desde AWS Console. El envío desde Workspace sigue pendiente de validación real. La aplicación publicada mantiene el envío deshabilitado.

## Uso de IA

Codex apoyó la implementación bajo especificaciones, la revisión de arquitectura,
el diagnóstico de errores y la preparación, ejecución y validación de pruebas.
La revisión de seguridad produjo regresiones para dos decisiones concretas:
validar el tamaño del cuerpo HTTP antes de procesarlo y bloquear SES si el
runtime está desplegado o su configuración es contradictoria. La verificación
manual en iPhone corresponde al desarrollador.

Para la reflexión personal queda documentar una decisión revisada por el
desarrollador y explicar qué evidencia utilizó para aceptarla o corregirla.
