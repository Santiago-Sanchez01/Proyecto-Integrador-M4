# Workspace

Aplicación de gestión individual de tareas con React, TypeScript y Firebase.

## Comandos

- `npm install`: instalar dependencias.
- `npm run dev`: iniciar Vite.
- `npm run typecheck`: verificar TypeScript de aplicación y configuración.
- `npm run build`: verificar TypeScript y generar `dist/`.
- `npm run lint`: ejecutar Oxlint.
- `npm test`: ejecutar Vitest una vez.
- `npm run test:watch`: ejecutar Vitest en modo interactivo.
- `npm run test:rules`: ejecutar reglas e integraciones del servicio en el emulador.
- `npm run preview`: servir el build localmente.

## Organización

- `src/app/`: composición y rutas.
- `src/features/`: auth, tasks, jornada y summary.
- `src/components/`: componentes compartidos utilizados.
- `src/test/setup.ts`: jest-dom y limpieza del DOM entre pruebas.

Las rutas `/login` y `/register` tienen formularios conectados a Firebase Auth.
`/tareas` permite crear, editar, completar y eliminar tareas; `/jornada` y `/resumen`
siguen siendo placeholders. Las tres rutas están protegidas.
`/` redirige a `/jornada`. Las rutas desconocidas muestran una página no
encontrada. La integración requiere configurar el proyecto Firebase (ver Hito 01.4B).
La pantalla de tareas está conectada a `useTasks` y conserva los filtros de estado.

## Alcance acordado del MVP

- Título y descripción obligatorios.
- Una tarea en foco persistente por usuario; posteriormente se guardará como
  `focusTaskId` en `users/{uid}`.
- Resumen del estado actual de todas las tareas, sin filtros temporales.
- Sin vencimientos, zonas horarias, prioridades ni colaboración.
- La interfaz de tareas, Vercel Functions y AWS SES quedan para otros hitos.

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

La protección del router es de UX; el aislamiento de Firestore depende de reglas
de seguridad, preparadas en el Hito 02.1 y pendientes de revisión y publicación.

Referencias oficiales: [cuentas con contraseña](https://firebase.google.com/docs/auth/web/password-auth),
[observador de sesión](https://firebase.google.com/docs/auth/web/manage-users) y
[persistencia](https://firebase.google.com/docs/auth/web/auth-state-persistence).

## Hito 02.1: infraestructura de Cloud Firestore

No se implementaron operaciones CRUD ni se modificaron las pantallas internas.
`src/lib/firebase.ts` ahora expone `getFirebaseApp()`, que reutiliza la aplicación
por defecto existente. Auth y `src/lib/firestore.ts` usan esa misma app. El cliente
Firestore es lazy: no lee ni escribe documentos al importarlo. No hay variables
nuevas, Analytics, Admin SDK ni cambios en `.env.local`.

### Contratos y estructura de datos

Ruta: `users/{uid}/tasks/{taskId}`. El UID proviene de Firebase Authentication;
no se duplica como campo de la tarea. No es necesario crear `users/{uid}` para
que exista su subcolección de tareas.

`src/features/tasks/task.types.ts` define:

| Campo persistido | Tipo | Restricción |
| --- | --- | --- |
| `title` | `string` | Obligatorio, no vacío después de `trim()` |
| `description` | `string` | Obligatorio, no vacío después de `trim()` |
| `status` | `'pending' \| 'completed'` | Sin otros estados |
| `createdAt` | Firebase `Timestamp` | Fecha de servidor, inmutable |
| `updatedAt` | Firebase `Timestamp` | Fecha de servidor en cada escritura |

`TaskDocument` representa esos cinco campos. `Task` agrega `id: string` para
React, obtenido del identificador del documento; `id` no se guarda en Firestore.
Ambos modelos conservan Timestamp y su precisión; las vistas futuras podrán
usar `toDate()` para presentar fechas. La obligatoriedad de texto no vacío se
valida en las reglas; TypeScript por sí solo no garantiza ese contenido.
No hay prioridades, vencimientos, etiquetas, responsables ni colaboración.

### Reglas preparadas (no desplegadas)

`firestore.rules` deniega todas las rutas salvo las tareas del propietario
autenticado. Se separan get/list, create, update y delete. No permite operaciones
sobre otro UID ni consultas generales de tareas de todos los usuarios.

- Create exige exactamente los cinco campos, tipos válidos y ambas fechas iguales
  a `request.time`. El futuro CRUD deberá enviar `serverTimestamp()` en ambas.
- Update valida el documento completo resultante, conserva `createdAt` y exige
  `updatedAt == request.time`. Las actualizaciones parciales también deben enviar
  `updatedAt: serverTimestamp()`.
- El contrato también exige `updatedAt >= createdAt`. En create la igualdad con
  `request.time` ya lo garantiza; en update cubre documentos importados mediante
  consola/Admin con una fecha de creación futura, que no pasan por estas reglas.
  Se agregó una prueba de ese caso y se comprueba que el rechazo no modifica el
  documento. Corregir datos importados inconsistentes requiere una acción
  administrativa revisada; no se habilita cambiar `createdAt` desde el cliente.
- Title y description deben ser strings con `trim().size() > 0`; status debe ser
  uno de los dos strings permitidos. No se aceptan campos extra ni `id` persistido.
- Delete solo exige propiedad; no depende de la validez del documento existente.
- `users/{uid}` permanece cerrado. Su espacio está reservado para un contrato
  futuro de `focusTaskId`, sin permitirlo ni crear perfiles en este hito.

### Pruebas de seguridad aisladas

Dependencias de desarrollo: `@firebase/rules-unit-testing` 6 y `firebase-tools` 15.
La librería de reglas es compatible con el Firebase 13 instalado. El CLI instalado
requiere **JDK 21 o superior**, disponible en PATH (`java -version`) o JAVA_HOME.
No se requiere iniciar sesión en Firebase para ejecutar el emulador de este proyecto demo.

Desde `workspace/`:

```sh
npm install
npm run test:rules
```

El script inicia solo Firestore en `127.0.0.1:8080` con el proyecto ficticio
`demo-workspace-m4`, carga las reglas locales, ejecuta Vitest y apaga el emulador.
El CLI puede descargar el binario del emulador la primera vez; necesita conexión.
No usa `workspace-m4` ni las variables de `.env.local`. La configuración de Vitest
de reglas deshabilita la carga de archivos de entorno. La suite exige explícitamente
`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` y nunca cae a un endpoint de producción.

`tests/firestore/firestore.rules.test.ts` prepara datos exclusivamente en el emulador
y los limpia entre casos. Cubre operaciones del propietario, rechazo de otro usuario
y anónimos, campos vacíos o incorrectos, campos extra y ausentes, timestamps
manipulados, inmutabilidad de createdAt, perfiles cerrados y denegación por defecto.
Las excepciones a reglas para preparar fixtures solo existen en el contexto del
emulador de la librería de pruebas.

`npm test` conserva la suite de aplicación y no inicia la suite de reglas.
`vitest.rules.config.ts` y las pruebas de seguridad están incluidas en el chequeo
TypeScript. No confundir aprobar los tests de aplicación con aprobar las reglas.

**Validación actualizada:** las 57 pruebas de reglas pasan en el emulador con
Temurin JDK 21. El problema inicial `spawn java ENOENT` se resolvió proporcionando
JAVA_HOME y PATH temporalmente al proceso. El usuario confirmó la publicación
de las reglas en `workspace-m4` antes de comenzar el Hito 02.2. Las pruebas del
Hito 02.2 se detallan más abajo; en esta intervención no se cambiaron las reglas.

La auditoría de dependencias de producción informa 0 vulnerabilidades. Permanecen
13 avisos moderados transitivos de las herramientas de desarrollo, principalmente
Firebase CLI. Se aplicaron correcciones compatibles con `npm audit fix`; no se
forzaron downgrades mayores ni overrides adicionales para ocultar los avisos.
Revisarlos al actualizar la herramienta. Estos paquetes no se importan en la SPA.

### Publicación manual, únicamente después de revisión

Las reglas en el repositorio no reemplazan las de Firebase Console automáticamente.
El usuario informó su despliegue al cerrar 02.1. Los cambios futuros siguen
requiriendo revisión y aprobación; no se desplegó nada durante el Hito 02.2.

Para futuras publicaciones:

1. Ejecutar y aprobar la suite de seguridad con el emulador y revisar las reglas.
2. Confirmar que la base creada es la base `(default)` del proyecto `workspace-m4`.
3. Obtener aprobación explícita para publicar las reglas revisadas.
4. Solo entonces, con la cuenta Firebase correcta autenticada en CLI, ejecutar:

```sh
npx firebase login
npx firebase deploy --only firestore:rules --project workspace-m4
```

Esos comandos son documentación; no se ejecutaron en esta intervención. El flag limita el despliegue
a las reglas y selecciona el proyecto de forma explícita. No se configuró un alias
de producción por defecto ni un script automático de despliegue.

No utilizar claves Admin ni cuentas de servicio en el navegador o las pruebas.
Las bibliotecas servidor/Admin pueden omitir las reglas, por lo que no sustituyen
las pruebas de acceso con el SDK cliente. No usar producción para fixtures.
La configuración web `VITE_*` es pública y no autoriza el acceso a datos.

Referencias: [pruebas de reglas con emulador](https://firebase.google.com/docs/firestore/security/test-rules-emulator),
[String.trim en reglas](https://firebase.google.com/docs/reference/rules/rules.String#trim)
y [Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure).

## Hito 02.2: servicio de tareas y lógica React

No se cambiaron pantallas, reglas, `.env.local` ni dependencias. No se implementó
focusTaskId, email ni funciones serverless. Los placeholders siguen vigentes.

### Servicio de sesión

`src/features/tasks/tasks.service.ts` expone `createTasksService()`. Esta función
obtiene el usuario real de Firebase Auth y liga el servicio a su UID. No acepta un
UID ni una ruta proporcionados por el consumidor. Rechaza el uso sin sesión, las
operaciones de un servicio antiguo tras cambiar de cuenta y los resultados de
consultas/escrituras que terminan cuando ya cambió la sesión. Las reglas siguen
siendo la autorización efectiva en servidor.

Operaciones disponibles:

- `createTask({ title, description })`: valida y recorta ambos textos, crea estado
  pending y ambas fechas con `serverTimestamp()`. Devuelve el ID tras confirmación.
- `getTasks()`: consulta puntual al servidor de la subcolección propia.
- `subscribeTasks(onChange, onError)`: listener en tiempo real; devuelve unsubscribe.
- `updateTask(id, { title, description })`: edita solo contenido y updatedAt.
- `setTaskStatus(id, status)`: cambia pending/completed y updatedAt.
- `deleteTask(id)`: elimina el documento en la ruta propia. Como en Firestore,
  eliminar un documento propio inexistente es una operación idempotente.

Las actualizaciones nunca incluyen createdAt. Los payloads se construyen con una
lista explícita de campos; el ID de tarea no puede contener `/`. Las escrituras
esperan las promesas del SDK y propagan sus errores. El contrato de creación se
comprueba también mediante `WithFieldValue<TaskDocument>`. `TaskContent` representa
los dos campos editables. La deserialización valida estado, textos y timestamps
en lugar de convertir datos desconocidos mediante un cast a Task.

### Consulta y snapshots

Se ordena por createdAt descendente y, ante empates, por ID descendente. No hay
filtros ni paginación. En Standard, esta consulta utiliza el índice automático
descendente de createdAt y su desempate por nombre; no se agregó un índice
compuesto. Si se deshabilitó ese índice en la consola, debe restaurarse. Las
consultas con orderBy no incluyen documentos sin createdAt, que serían inválidos
según el contrato publicado.

El listener solicita `includeMetadataChanges: true` y omite snapshots con
`hasPendingWrites`. Así se conservan Timestamp confirmados y no se presenta una
escritura local como resultado confirmado. Puede emitir datos válidos de caché
sin escrituras pendientes y luego datos actualizados del servidor. La consulta
puntual usa `getDocsFromServer`, falla sin conexión y rechaza overlays pendientes.

Se escucha toda la colección propia, adecuado para el MVP académico. Cada montaje
de `useTasks` abre un listener: evitar montarlo simultáneamente en muchos componentes
para no duplicar lecturas. Al crecer el volumen, evaluar paginación y compartir la
suscripción. [Detalles oficiales de listeners](https://firebase.google.com/docs/firestore/query-data/listen)
y [orden de índices](https://firebase.google.com/docs/firestore/query-data/index-overview).

### Hook useTasks

`useTasks()` obtiene el usuario desde useAuth y expone:

- `tasks`, `loading`, `error` de la suscripción.
- `isMutating` y `operationError` independientes del error de lectura.
- `createTask`, `updateTask`, `setTaskStatus`, `deleteTask` (promesas).

Loading permanece activo hasta el primer snapshot aceptado; sin sesión devuelve
una lista vacía. El cambio de UID oculta y reinicia los datos durante el render,
antes del cleanup pasivo. Cada listener y operación pendiente queda ligado a su
sesión; los callbacks tardíos se ignoran, incluidas las respuestas que llegan entre
el cambio de cuenta y la limpieza del efecto. El desmontaje desuscribe y evita
actualizar estado. También funciona con StrictMode.

Las operaciones no modifican tasks de forma optimista: el listener es la única
fuente del listado. Un contador conserva isMutating mientras existan operaciones
concurrentes. Los errores se traducen con `tasks.errors.ts`, se exponen y vuelven
a rechazarse para que la futura interfaz pueda manejarlos. Esa interfaz deberá
capturar los rechazos y deshabilitar las acciones que no deba repetir. Si el SDK
termina un listener por error, se requiere un nuevo montaje para reintentarlo.

Una escritura ya enviada no puede cancelarse al desmontar o cerrar sesión: puede
completarse para la cuenta original, sujeta a las reglas. El hook descarta su
resultado para la nueva sesión. Sin conexión, las escrituras pueden quedar
pendientes hasta que el SDK las confirme o rechace; no se simula un timeout ni
se afirma éxito. Los errores de operación persisten hasta la próxima operación.

### Verificación del Hito 02.2

Las pruebas unitarias del servicio usan dobles del SDK y las del hook verifican
snapshots, operaciones, errores, concurrencia, desmontaje, cambio de usuario y
callbacks anteriores al cleanup. Las tres integraciones nuevas usan el servicio
real y el SDK cliente contra el emulador, con identidades simuladas por
rules-unit-testing: ciclo CRUD completo, realtime/orden y aislamiento entre cuentas.
También se repiten las 57 pruebas de reglas existentes sin modificarlas.

Resultado final: `npm run typecheck`, `npm run build` y `npm run lint` correctos;
`npm test`: **90 pruebas aprobadas**; `npm run test:rules`: **60 aprobadas**
(57 de reglas y 3 integraciones nuevas). Sin fallos automatizados pendientes.

En PowerShell, si la terminal no hereda la instalación de Java:

```powershell
$env:JAVA_HOME = 'C:\ruta\al\jdk-21'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version
npm.cmd run test:rules
```

Solo modifica el entorno de ese proceso; no reinstala Java ni cambia el sistema.
`tsconfig.node.json` usa resolución bundler para comprobar las integraciones que
importan el servicio de Vite. Las pruebas del emulador no cargan `.env.local`.

Pendientes manuales para la próxima interfaz: conectar useTasks, comprobar estados
de carga y errores visibles, verificar las acciones con una cuenta propia y
revisar el índice automático de createdAt en producción si devuelve un error de
precondición. En esta etapa no se escribieron datos de prueba en producción.

## Hito 02.3A: listado y filtros de Mis tareas

`TasksPage` conecta la ruta `/tareas` con useTasks. `TasksView` presenta los filtros
y estados de lectura; `TaskList` renderiza las tarjetas con título, descripción
completa y una etiqueta textual de estado con icono decorativo. Se reutilizan Card,
Button, los tokens Midnight Copper V2 y AppLayout, sin rediseñar la navegación.
Los estilos propios están en `src/features/tasks/tasks.css`.

Todas, Pendientes y Completadas filtran en memoria conservando el orden recibido.
Los conteos siempre corresponden al total disponible de cada categoría. Cambiar
de filtro no abre consultas ni listeners adicionales. Los botones nativos usan
aria-pressed dentro de un fieldset con leyenda; se operan con Tab, Enter o Espacio.
Una región de estado anuncia el resultado y los estados no dependen solo del color.

Se distinguen carga inicial, cuenta sin tareas, filtro sin resultados y error de
lectura. Ver todas limpia un filtro sin resultados. Reintentar remonta únicamente
el contenedor de la suscripción, limpia el listener anterior y vuelve a mostrar
carga; también reinicia el filtro a Todas. No se modificaron el hook, el servicio
CRUD, las reglas ni `.env.local`. El hook existente impide mostrar datos de otra
sesión, comportamiento cubierto también en las pruebas de esta pantalla.

La ruta carga TasksPage bajo demanda con React.lazy/Suspense, evitando incluir
Firestore y el listado en el paquete inicial de autenticación. El build final
generó aproximadamente 380 kB para el paquete inicial y 474 kB para tareas, antes
de gzip; ya no aparece la advertencia de un paquete único superior a 500 kB.
No se agregaron dependencias.

Validación: typecheck, build y lint correctos; **99 tests de aplicación** y
**60 tests del emulador** aprobados (57 de reglas y 3 integraciones existentes).
Los nueve tests nuevos de la página usan el hook real con un doble del servicio:
listado/orden, filtros/conteos sin escrituras, carga, vacío global, filtro vacío,
error y reintento, snapshots sucesivos, teclado y cambio de cuenta. Las pruebas
de rutas/autenticación aíslan useTasks para no consultar Firestore real.

Se revisó en Chrome a 320, 375, 768 y 1280 px usando componentes reales y datos
locales de muestra en un archivo de revisión ignorado por Git. Se comprobaron
ausencia de desbordamiento, textos largos, controles de al menos 44 px, foco
visible, filtro por teclado, estados de lectura y movimiento reducido. Se verificó
que el final del listado sea accesible sobre la navegación inferior al hacer scroll.
Las capturas y el archivo local de revisión no forman parte del build ni alimentan
la ruta real: `/tareas` siempre utiliza useTasks y los datos de la cuenta activa.

**Pendiente de revisión visual del usuario: no se declara cerrado el hito.**
Abrir `/tareas` tras iniciar sesión para revisar la cuenta real. Si todavía no hay
tareas, se verá el vacío global; no se insertaron fixtures en producción para
llenar la pantalla. Revisar también las capturas con datos de muestra de escritorio
y móvil, el salto de línea de los filtros a 320 px, el teclado y la lectura con
lector de pantalla. Los escenarios de error/reintento y filtro sin resultados
están cubiertos con dobles; conviene repetirlos manualmente en un entorno de prueba.

## Hito 02.3B: interfaz CRUD

`TasksPage` coordina los formularios y usa exclusivamente las operaciones de
useTasks. `TaskList` recibe callbacks para editar, cambiar estado y pedir una
eliminación; `TasksView` conserva los filtros y el orden del listener. No se
modificaron el servicio, el hook, las reglas ni `.env.local`, y no se agregaron
dependencias.

Componentes nuevos:

- `TaskModal`: dialog nativo con fondo inerte, scroll de página bloqueado,
  recorrido cíclico con Tab/Shift+Tab, Escape controlado y restauración del foco.
- `TaskEditor`: título y descripción obligatorios, validación local por trim,
  precarga al editar, comparación del borrador con el contenido inicial y errores
  accesibles. Usa los componentes Input, Textarea y Button existentes.
- `DeleteTaskDialog`: confirmación explícita con título de la tarea, foco inicial
  en Cancelar y errores reintentables. No se elimina por abrir o cancelar el diálogo.
- `task-modal.css`: panel de 520 px a la derecha desde 768 px y pantalla completa
  por debajo; confirmación de eliminación centrada, usando los tokens existentes.

Guardar espera la promesa del hook; el formulario se cierra solo al confirmarse.
Durante guardado/eliminación se deshabilitan campos y acciones de cierre y se
impiden envíos duplicados mediante un bloqueo inmediato, además del estado visual.
La página serializa las acciones de escritura para evitar dobles operaciones.
Completar/volver a pendiente muestra el estado anterior hasta recibir el snapshot
confirmado; las tareas no se insertan, editan o eliminan de forma optimista.
Los filtros y conteos se actualizan únicamente con useTasks. Si una tarea sale
del filtro activo, se devuelve el foco a Nueva tarea. Los filtros se conservan al
crear; una nueva tarea pending no aparecerá bajo Completadas hasta cambiar el filtro.

Al cerrar un borrador modificado se ofrece Seguir editando o Descartar cambios.
La entrada usa `createBrowserRouter`/RouterProvider con las mismas rutas para
habilitar useBlocker, en lugar de interceptar manualmente el historial del navegador.
Se comprobó Atrás real en Chrome. La recarga/cierre de pestaña usa beforeunload:
el navegador controla el mensaje y puede limitarlo, especialmente en móviles.
No se persisten borradores en almacenamiento local. Durante una escritura pendiente
la navegación interna permanece bloqueada; las solicitudes ya enviadas no se pueden
cancelar de forma fiable. Sin conexión pueden permanecer pendientes.

La edición conserva el contenido precargado sin sobrescribirlo por cambios remotos
mientras se escribe. Sigue vigente la política de última escritura de Firestore:
no se agregó versionado ni detección de conflictos entre pestañas. Si la tarea fue
eliminada en otra pestaña, el error de actualización se muestra y el borrador se
mantiene. Al cambiar de cuenta se desmonta todo el estado del editor.

### Validación y revisión

Typecheck, build y lint correctos; **114 pruebas de aplicación** y **60 pruebas
del emulador** aprobadas. Se agregaron pruebas de apertura/cierre, foco,
teclado, campos vacíos, creación/edición exitosa y fallida, borradores, bloqueo de
navegación, beforeunload, estados, confirmación/cancelación de eliminación y
prevención de duplicados. jsdom solo simula showModal/close para las pruebas; el
comportamiento real de dialog, su foco y la inercia del fondo se comprobaron en Chrome.
El emulador conserva las 57 reglas y 3 integraciones del servicio, sin cambios.

Se verificó la ruta real contra Firebase con una cuenta temporal y tareas reales:
crear, editar conservando createdAt, completar, volver a pendiente, conteos/filtros,
cancelar una eliminación y confirmar la eliminación. Se comprobaron pantalla completa
a 320/375 px y panel a 768/1280 px, sin desbordamiento; foco inicial, Tab dentro del
diálogo, Escape con borrador y Atrás bloqueado hasta confirmar. Las tareas de prueba
y las cuentas temporales fueron eliminadas al finalizar, también en el intento
inicial de diagnóstico. No se registraron credenciales ni tokens.

Las capturas locales ignoradas por Git están en
`node_modules/.tmp/tasks-crud-review/` (editor de escritorio/móvil, edición,
confirmación de eliminación y listado). No forman parte del build de producción.
Queda la revisión visual del usuario antes del cierre oficial, además de comprobar
lector de pantalla y dispositivos móviles reales. Los errores de escritura se
verificaron con dobles del SDK; no se alteraron permisos de producción para forzarlos.

## Entornos y despliegue posterior

`.env` y `.env.*` están excluidos de
Git, salvo `.env.example`, que podrá documentar variables sin secretos cuando
existan integraciones. No guardar credenciales Admin ni usar `VITE_` para secretos;
estas variables son visibles en el bundle del navegador.

En Vercel, seleccionar `workspace/` como raíz si se importa el directorio padre.
Usar el preset Vite, `npm run build` y salida `dist/`. `vercel.json` incluye el
fallback SPA para acceso directo a rutas. Revisarlo al incorporar `/api`.
No se realizó un despliegue en este hito.
