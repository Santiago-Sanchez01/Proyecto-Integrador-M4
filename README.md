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

Las rutas `/login` y `/register` tienen formularios conectados a Firebase Auth.
`/jornada`, `/tareas` y `/resumen` siguen siendo placeholders, ahora protegidos.
`/` redirige a `/jornada`. Las rutas desconocidas muestran una página no
encontrada. La integración requiere configurar el proyecto Firebase (ver Hito 01.4B).
Todavía no existe persistencia de tareas.

## Alcance acordado del MVP

- Título y descripción obligatorios.
- Una tarea en foco persistente por usuario; posteriormente se guardará como
  `focusTaskId` en `users/{uid}`.
- Resumen del estado actual de todas las tareas, sin filtros temporales.
- Sin vencimientos, zonas horarias, prioridades ni colaboración.
- Firestore, Vercel Functions y AWS SES quedan para otros hitos.

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
de las páginas internas. No agrega rutas ni modifica los placeholders. El formulario
solo demuestra validación local; no guarda ni envía datos. Para retirarla basta
quitar `DesignSystemPreview` de `AppLayout.tsx` y eliminar sus archivos y prueba.

Se verificaron 12 pruebas, navegación con Tab/Enter/Espacio, foco visible y tamaños
320, 375 y 1280 px en Chrome headless sin desbordamiento horizontal. La muestra
usa una columna en móvil y dos desde 800 px. Los controles tienen al menos 44 px
de alto. `prefers-reduced-motion` reduce las transiciones a cero.

Contrastes calculados: texto principal sobre superficie 13,90:1; secundario
8,87:1; texto oscuro sobre cobre 7,73:1; error sobre superficie 8,63:1. El borde
de control tiene al menos 3,49:1 sobre las tres superficies. Los controles
deshabilitados se distinguen por opacidad y no admiten interacción.

## Hito 01.3B: layout y navegación

`App.tsx` anida `/jornada`, `/tareas` y `/resumen` dentro de `AppLayout` mediante
`Outlet`. Login, registro y página no encontrada quedan fuera de ese layout.
`sections.ts` centraliza títulos, descripciones, destinos e identificadores de
iconos. `AppNavigation` usa un único conjunto de `NavLink`, con `aria-current`,
SVG decorativos y etiquetas visibles. `SectionHeader` muestra el encabezado y
recibe el foco después de cambiar de sección. Los placeholders reutilizan Card.

La navegación es inferior y fija por debajo de 1024 px; desde ese ancho pasa a
una sidebar sticky de 256 px. El contenido reserva espacio inferior y safe area.
Las áreas de los enlaces miden 64 px de alto en móvil y 48 px en escritorio.
Hay un enlace para saltar al contenido, foco visible y movimiento reducido.

Validación: typecheck, build, lint y 19 pruebas automatizadas correctas. En Chrome
headless se comprobaron 320, 375, 768 y 1280 px, navegación entre las tres secciones,
una única ruta activa, recarga de las rutas internas, teclado y salto al contenido.
No hubo desbordamiento horizontal ni contenido final tapado por la navegación
con la muestra de componentes desplegada. También se inspeccionaron capturas.
Las recargas se verificaron en el servidor local de Vite; no en Vercel desplegado.

## Hito 01.4A: Midnight Copper Auth V3

`src/features/auth/AuthLayout.tsx` utiliza Outlet para Login y Registro, separado
de AppLayout. `AuthForm.tsx` reutiliza Input y Button; `auth.css` contiene estilos
limitados a autenticación. Desde 1024 px, el panel visual ocupa 55 % y el formulario
45 %. En tamaños menores se oculta el panel visual y aparece el wordmark sobre
el formulario, con un ancho máximo de 420 px.

Los formularios validan campos obligatorios y email usando la validez nativa del
input. Registro exige provisionalmente al menos 8 caracteres y confirmación
idéntica; Login no impone esa longitud. La política definitiva deberá acordarse
al integrar Firebase. Los errores se asocian a los campos y se enfoca el primero.
Una región de estado informa errores generales y la ausencia de autenticación.
No se simulan esperas de red, estados de sesión ni creación de cuentas. Los datos
solo viven en memoria mientras está montado el formulario y se descartan al
cambiar de pantalla; no se escriben en almacenamiento ni se envían a servicios.
El navegador puede ofrecer su propio autocompletado mediante atributos semánticos.

### Fotografía pendiente

Se usa un fallback CSS estático con los tokens existentes, sin fotografías
remotas ni recursos visuales nuevos. Para incorporar la fotografía definitiva:

1. Revisar y registrar licencia, autor y permiso de uso en este README.
2. Colocar el recurso optimizado en `src/assets/auth/workspace-desk.avif` (o WebP),
   idealmente por debajo de 200 KB y con dimensiones adecuadas al panel.
3. Importarlo desde AuthLayout y aplicarlo como fondo decorativo de `.auth-visual`
   con `cover`, conservando una capa oscura que garantice contraste del texto.
4. Limitar su carga a escritorio; revisar tamaño transferido, encuadre y contraste
   en el navegador. No se creó un directorio vacío para este recurso pendiente.

Validación: typecheck, build y lint correctos; 26 pruebas automatizadas aprobadas.
En Chrome headless sobre el build local se comprobaron ambos formularios a 320,
375, 768 y 1280 px: sin desbordamiento horizontal, foco visible, navegación por
teclado, foco en errores y áreas interactivas de al menos 44 px. Se inspeccionaron
capturas. La revisión manual con lector de pantalla queda pendiente.

## Hito 01.4B: Firebase Authentication (estado actual)

El SDK modular `firebase` usa únicamente `firebase/app` y `firebase/auth`.
`src/lib/firebase.ts` valida la configuración pública e inicializa una sola app.
`auth.service.ts` contiene registro, login, logout y observación, sin depender de
React. No importa Firestore ni Admin SDK, no crea perfiles y no escribe credenciales.

`AuthProvider` comparte uid/email y los estados loading/ready/error mediante
`useAuth`. La sesión solo se confirma con `onAuthStateChanged`; no se decide por
el valor inicial de `currentUser`. La suscripción se limpia incluso en StrictMode.
La persistencia local y restauración son las predeterminadas del SDK oficial;
Workspace no escribe contraseñas ni tokens en localStorage o sessionStorage.

`ProtectedRoute` bloquea las pantallas internas hasta resolver la sesión y envía
al usuario anónimo a Login con su ruta de destino. `GuestRoute` evita mostrar
Login/Registro a usuarios autenticados. El destino solo acepta las tres rutas
internas (incluidos query y hash), evitando redirecciones externas. El destino se
conserva al cambiar entre Login y Registro.

Los formularios mantienen validación local y deshabilitan campos/botón durante
la solicitud. Se evita el doble envío, y el observador determina la navegación.
Los fallos se traducen a mensajes comprensibles sin mostrar mensajes crudos del
SDK ni revelar si existe una cuenta en el login. Cerrar sesión está disponible
en el contenido interno, también en móvil; si falla, la sesión no se descarta
optimistamente. Las instrucciones de vista previa del hito anterior se retiraron.

### Configuración requerida

1. Registrar una app web en un proyecto Firebase y habilitar Authentication con
   Email/Password. No habilitar otros proveedores para este hito.
2. En Authentication > Settings, configurar la política de contraseña en modo
   obligatorio con mínimo 8 caracteres, sin requisitos adicionales de composición
   para coincidir con esta interfaz. Habilitar protección contra enumeración de
   emails. Estas opciones no se pueden configurar mediante las variables del cliente.
3. Copiar `.env.example` a `.env.local` y completar `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` y `VITE_FIREBASE_APP_ID`
   con la configuración pública de esa app. Ninguna es una credencial Admin.
4. Revisar los dominios autorizados del proyecto, incluyendo el dominio de Vercel
   y localhost para las pruebas locales cuando corresponda. Reiniciar Vite.
5. En Vercel, definir esas variables para cada entorno y volver a compilar.

Sin configuración, se muestra un error recuperable y no se permite enviar el
formulario ni acceder al contenido interno. No hay una sesión ficticia de respaldo.

### Verificación y pendientes

Build, typecheck, lint y 58 pruebas automatizadas pasan. Las pruebas usan dobles
del servicio o del SDK: cubren éxito y error de login/registro, bloqueo durante
solicitudes, logout, rutas protegidas, restauración sin redirección prematura,
destino conservado, destinos externos rechazados, configuración ausente y cleanup.
No conectan ni crean cuentas en un proyecto externo.
En Chrome, sin configuración, se verificaron Login, Registro y acceso directo a
`/tareas` a 320 y 1280 px: se muestran errores recuperables, los formularios están
deshabilitados, el contenido interno no se renderiza y no hay desbordamiento.

El paquete Firebase incorpora transitivamente una versión vulnerable de
`@grpc/grpc-js` por Firestore, aunque ese módulo no se importa en esta aplicación.
Se fijó un override a `1.13.6`; después de reinstalar, npm informó cero
vulnerabilidades. Revisar y retirar ese override cuando Firebase actualice su
dependencia. No se aplicó `npm audit fix --force` ni un downgrade de Firebase.

Se comprobó la integración real en Chrome aislado contra el proyecto configurado:
registro, destino preservado (incluidos query/hash), recarga de sesión sin pasar
por Login, redirección de usuarios autenticados, logout, recarga después de logout,
login incorrecto con mensaje genérico y login correcto. La cuenta temporal usada
para estas comprobaciones se eliminó al finalizar. No se copiaron los valores de
`.env.local` al código ni a esta documentación; Git ignora ese archivo.

**Política de contraseña verificada:** Firebase informa longitud mínima 8 y modo
`ENFORCE` (Require), coincidiendo con la validación de registro de Workspace.
La comprobación real mediante `validatePassword` rechazó una contraseña de siete
caracteres y aceptó una de ocho. Todos los flujos reales descritos arriba se
repitieron correctamente tras el cambio de política, incluida la eliminación de
la cuenta temporal. El Hito 01.4B queda validado para su cierre.

Para repetir las comprobaciones manualmente:

- Acceso directo a `/tareas` sin sesión: muestra Login y conserva el destino.
- Registro con un email de prueba propio: crea la cuenta y vuelve al destino.
- Recarga con sesión activa: conserva el acceso sin pasar por Login.
- Acceso a `/login` y `/register` autenticado: vuelve a Mi Jornada.
- Logout: vuelve a Login; recargar no recupera la sesión cerrada.
- Login incorrecto: mensaje genérico y botón habilitado para reintentar.
- Login correcto: entra al destino interno solicitado.

La protección del router es de UX; cuando se implemente Firestore, el aislamiento
entre usuarios requerirá reglas de seguridad. No se implementó Firestore.

Referencias oficiales: [cuentas con contraseña](https://firebase.google.com/docs/auth/web/password-auth),
[observador de sesión](https://firebase.google.com/docs/auth/web/manage-users) y
[persistencia](https://firebase.google.com/docs/auth/web/auth-state-persistence).

## Entornos y despliegue posterior

`.env` y `.env.*` están excluidos de
Git, salvo `.env.example`, que podrá documentar variables sin secretos cuando
existan integraciones. No guardar credenciales Admin ni usar `VITE_` para secretos;
estas variables son visibles en el bundle del navegador.

En Vercel, seleccionar `workspace/` como raíz si se importa el directorio padre.
Usar el preset Vite, `npm run build` y salida `dist/`. `vercel.json` incluye el
fallback SPA para acceso directo a rutas. Revisarlo al incorporar `/api`.
No se realizó un despliegue en este hito.
