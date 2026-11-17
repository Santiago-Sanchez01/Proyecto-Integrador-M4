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
- `npm run test:backend`: ejecutar pruebas del servidor con Firebase y SES simulados.
- `npm run preview`: servir el build localmente.

## Organización

- `src/app/`: composición y rutas.
- `src/features/`: auth, tasks, jornada y summary.
- `src/components/`: componentes compartidos utilizados.
- `src/test/setup.ts`: jest-dom y limpieza del DOM entre pruebas.

Las rutas `/login` y `/register` tienen formularios conectados a Firebase Auth.
`/tareas` permite crear, editar, completar y eliminar tareas; `/jornada` muestra y
gestiona la tarea en foco; `/resumen` muestra todas las tareas y su progreso.
Las tres rutas están protegidas.
`/` redirige a `/jornada`. Las rutas desconocidas muestran una página no
encontrada. La integración requiere configurar el proyecto Firebase (ver Hito 01.4B).
La pantalla de tareas está conectada a `useTasks` y conserva los filtros de estado.

## Alcance acordado del MVP

- Título y descripción obligatorios.
- Una tarea en foco persistente por usuario, guardada como
  `focusTaskId` en `users/{uid}`.
- Resumen del estado actual de todas las tareas, sin filtros temporales.
- Sin vencimientos, zonas horarias, prioridades ni colaboración.
- El envío manual mediante SES está implementado con dobles de pruebas; permanece
  deshabilitado por defecto y pendiente de autorización y validación real.

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

## Hito 03.1: persistencia de tarea en foco

Sin cambios de interfaz. `focus.types.ts` define UserFocusDocument con exactamente
`focusTaskId: string | null` en `users/{uid}`. Un documento inexistente equivale
a foco nulo; seleccionar o quitar crea/reemplaza ese documento con un único campo.
No se crean perfiles ni se borra el documento para quitar el foco.

`createTaskFocusService()` obtiene el UID del SDK, sin aceptar un UID arbitrario.
Expone getFocus, subscribeFocus y selectFocus(id | null). La selección es una
transacción que lee documento de usuario y tarea propia; rechaza tareas ausentes
o completadas y verifica la sesión durante y después de la operación. Los listeners
omiten escrituras locales pendientes y se limpian explícitamente.

`useTaskFocus()` usa useAuth y expone focusTaskId, loading, error, operationError,
isMutating, selectFocus y clearFocus. No actualiza optimistamente el foco, propaga
rechazos y descarta callbacks/respuestas de otra sesión o posteriores al desmontaje.
El foco se conserva entre recargas por Firestore, sin depender de una fecha ni
guardar la selección en localStorage. Todavía no está conectado a Mi Jornada.

### Integridad y concurrencia

Las reglas permiten get del documento propio, nunca listar usuarios ni borrar
su documento. Create/update exigen exactamente focusTaskId, nulo o ID sin barras
que exista en las tareas propias y permanezca pending al finalizar la escritura.
Se usa getAfter para impedir seleccionar una tarea completada o borrada en el
mismo batch. El acceso a documentos ajenos y anónimos permanece denegado.

Completar o eliminar una tarea enfocada exige que el documento de usuario final
ya no apunte a ella. Por eso el servicio CRUD ahora ejecuta esas operaciones en
transacciones: lee el foco, lo limpia solo si coincide y actualiza/elimina la tarea
en la misma confirmación. No cambia su API ni los campos/timestamps de las tareas.
Editar texto y devolver a pendiente mantienen su comportamiento anterior.

Las lecturas de ambas operaciones permiten a Firestore reintentar ante conflictos.
Dos selecciones concurrentes dejan una única selección válida; seleccionar frente
a completar puede rechazar la selección, pero no deja una referencia inválida.
Completar una tarea diferente no borra el foco nuevo. No se elige automáticamente
otra tarea después de invalidar el foco. El coste incluye una lectura adicional del
documento de usuario en completar/eliminar; las transacciones necesitan conexión.

Las reglas garantizan esta integridad para SDK clientes, partiendo de datos válidos.
Admin SDK/consola puede omitirlas: no existe una función servidor para reparar
automáticamente esas escrituras. Antes del despliegue revisar datos importados;
si hay focos inválidos, deben corregirse explícitamente. No se escribe en producción
para las pruebas ni se modificó `.env.local`.

### Despliegue pendiente de autorización

No se publicaron las reglas. El cliente nuevo lee users/{uid}; con las reglas
anteriores esa lectura está denegada y completar/eliminar fallaría. Orden requerido:

1. Revisar y aprobar las reglas y los resultados del emulador.
2. Solo con autorización explícita, publicar las reglas en workspace-m4 usando el
   procedimiento de despliegue ya documentado.
3. Distribuir después el cliente actualizado; no habilitar la futura interfaz de
   foco en clientes antiguos. Un cliente antiguo que intente completar/eliminar
   una tarea enfocada sin liberar el foco será rechazado, preservando integridad.
4. Validar selección, recarga y finalización/eliminación con cuentas de prueba
   controladas, y limpiar sus datos al terminar.

Se incorporaron integraciones de reglas/servicios para selección, lectura persistida,
realtime, limpieza, tareas inválidas, aislamiento, batches adversariales y concurrencia,
y pruebas del hook para carga, errores, cambios de cuenta y limpieza de suscripciones.
Las pruebas existentes de tareas se conservaron; se actualizó la expectativa del
documento de usuario reservado para permitir ahora el contrato de foco propio.
Resultado: typecheck, build y lint correctos, 118 tests de aplicación y 74 del
emulador aprobados. No se desplegaron reglas ni se probaron escrituras en producción.

## Entornos y despliegue posterior

`.env` y `.env.*` están excluidos de
Git, salvo `.env.example`, que podrá documentar variables sin secretos cuando
existan integraciones. No guardar credenciales Admin ni usar `VITE_` para secretos;
estas variables son visibles en el bundle del navegador.

En Vercel, seleccionar `workspace/` como raíz si se importa el directorio padre.
Usar el preset Vite, `npm run build` y salida `dist/`. `vercel.json` incluye el
fallback SPA para acceso directo a rutas y excluye `/api` para las funciones.
No se realizó un despliegue en este hito.

## Hito 04.2: lectura autenticada desde el servidor

Arquitectura mínima, sin integración visual ni envío de correo:

- `api/summary.ts`: función Node compatible con Vercel, acepta solo POST.
- `server/firebase-admin.ts`: inicialización diferida y reutilizable del Admin SDK.
- `server/task-summary.ts`: consulta y validación de tareas y cálculo del resumen.
- `shared/summary.types.ts`: contrato JSON, reutiliza el modelo Task mediante tipos.
- `tests/backend/` y `vitest.backend.config.ts`: pruebas Node con mocks, sin secretos.

Node local verificado: 24.20.0. `engines.node` fija la familia 24.x para Vercel.
La única dependencia de producción incorporada es `firebase-admin`. Se usan los
tipos HTTP nativos de Node, sin framework ni otra biblioteca para el endpoint.
Las credenciales del servidor no forman parte del build Vite; ningún módulo de
`src/` importa Firebase Admin ni `server/`.

### Contrato HTTP

`POST /api/summary`, con `Authorization: Bearer <Firebase ID token>`.
No necesita body. Los datos de body/query, incluidos UID, email y rutas,
se ignoran como fuente de identidad. No acepta destinatarios personalizados.
El token se verifica con `verifyIdToken(token, true)`, incluyendo revocación y
estado de cuenta. No se devuelven claims, tokens ni email; la identidad mínima
es `user.uid` del token verificado.

Respuesta 200 de ejemplo ficticio:

```json
{
  "user": { "uid": "example-user" },
  "totals": { "total": 1, "pending": 1, "completed": 0 },
  "progress": 0,
  "tasks": [{
    "id": "example-task",
    "title": "Revisar entrega",
    "description": "Comprobar los puntos pendientes.",
    "status": "pending",
    "createdAt": "2026-01-01T12:00:00.000Z",
    "updatedAt": "2026-01-01T12:00:00.000Z"
  }]
}
```

Timestamps serializados a ISO UTC con precisión de milisegundos. Progreso
redondeado al entero más próximo, o cero si no hay tareas. No se guarda ninguna
estadística. La consulta usa `users/{uid}/tasks`, ordenada por createdAt y luego
ID descendentes, igual que el servicio cliente. Selecciona solo los cinco campos
del contrato; no necesita un índice compuesto adicional con la configuración
de índices simple existente. Los documentos leídos se validan antes de responder.

Errores JSON: `{ "error": { "code": "...", "message": "..." } }`:

| HTTP | code | Motivo |
| --- | --- | --- |
| 405 | METHOD_NOT_ALLOWED | Método distinto de POST; incluye Allow: POST |
| 401 | UNAUTHENTICATED | Falta Authorization |
| 401 | INVALID_TOKEN | Encabezado mal formado o token/usuario no válido |
| 413 | SUMMARY_TOO_LARGE | Exceso de tareas o tamaño |
| 500 | INTERNAL_ERROR | Configuración, red, Auth, Firestore o datos inválidos |

No se exponen errores internos, trazas ni credenciales. No se registran tokens
o secretos. Todas las respuestas incluyen Cache-Control: private, no-store,
Vercel-CDN-Cache-Control: no-store y X-Content-Type-Options: nosniff. No se habilita
CORS general. El handler responde JSON incluso ante fallos de autenticación.

### Límites y seguridad

Máximo 100 tareas y 1 MiB de JSON UTF-8. Se solicitan hasta 101 documentos para
detectar exceso; se responde 413 sin truncar tareas ni producir estadísticas
parciales. El límite reduce coste y volumen de lectura; no equivale a paginación.
Documentos muy grandes pueden consumir memoria durante la lectura del snapshot,
aunque la respuesta se rechace. Authorization se limita a 8192 caracteres.

Admin SDK omite las reglas de Firestore. El aislamiento depende del UID verificado
y de la ruta construida exclusivamente por el servidor, cubiertos por pruebas.
Usar una cuenta de servicio dedicada con permisos mínimos de lectura de Firestore
y consulta de usuarios de Authentication para comprobar revocación. No otorgar
permisos de propietario/editor ni distribuir credenciales al navegador. Para una
publicación futura, revisar límites de tráfico/coste en Vercel: un usuario válido
puede repetir consultas y este hito no implementa rate limiting distribuido.

La función rechaza FIREBASE_AUTH_EMULATOR_HOST y FIRESTORE_EMULATOR_HOST: no acepta
el modo de tokens no firmados del emulador. Las pruebas de backend usan mocks;
las pruebas de reglas mantienen su emulador aislado demo-workspace-m4.

### Variables del servidor

`.env.example` documenta `FIREBASE_ADMIN_PROJECT_ID=workspace-m4` como proyecto
explícito de desarrollo. Configurarlo en el entorno del proceso servidor, sin usar
VITE_. El proyecto nunca se obtiene del body, query ni token enviado por el cliente.

Firebase Admin usa `applicationDefault()` (ADC), manteniendo la inicialización
diferida y la instancia con nombre `workspace-server`. Ya no requiere
FIREBASE_ADMIN_CLIENT_EMAIL ni FIREBASE_ADMIN_PRIVATE_KEY; esas variables no se
utilizan. No hay fallback automático a `cert()` ni rutas de credenciales en código.

La ausencia de proyecto falla antes de inicializar. La resolución de ADC y la
obtención de tokens pueden ocurrir después, al hacer la primera llamada al SDK:
crear la instancia no demuestra que las credenciales o IAM sean válidos. Los
fallos de configuración o ADC se responden con 500 genérico, sin detalles internos.

### ADC local mediante impersonación (validado)

Firebase Admin con ADC mediante impersonación de una cuenta de servicio dedicada
ya fue validado en el entorno local con Vercel Dev y Firebase real. Esta validación
no implica que exista un despliegue ni una identidad de producción configurada.

Para reproducirlo en otro entorno local autorizado, disponer de Google Cloud CLI
y una cuenta de servicio dedicada. El desarrollador necesita poder impersonarla
(normalmente roles/iam.serviceAccountTokenCreator sobre esa cuenta específica).
La cuenta necesita lectura de Firestore y consulta de usuarios de Firebase Auth
para comprobar revocación. No se necesitan permisos de escritura para este endpoint.

Comando de referencia para configurar ADC en otro entorno autorizado, sustituyendo
el marcador por la cuenta aprobada; no contiene una identidad ni credencial real:

```powershell
gcloud auth application-default login --impersonate-service-account="CUENTA_DE_SERVICIO_AUTORIZADA" --project="workspace-m4"
```

`gcloud auth login` autentica la CLI y no equivale a configurar ADC. Tampoco bastan
el login de Firebase CLI ni la configuración global de impersonación de gcloud.
Google Cloud CLI guarda ADC fuera del repositorio; ese archivo puede contener
credenciales renovables del desarrollador, aunque no incluya una clave privada de
la cuenta de servicio. No copiarlo a la aplicación, Git, logs ni archivos VITE_*.
`.gitignore` excluye explícitamente `application_default_credentials.json` tanto
en la raíz como en cualquier subdirectorio. Esta exclusión es preventiva: las
credenciales deben permanecer fuera del repositorio y nunca agregarse con `git add -f`.

Con la ubicación habitual de ADC no es necesario definir GOOGLE_APPLICATION_CREDENTIALS.
Si ya existe esa variable, ADC prioriza su archivo: revisar que corresponda a una
configuración autorizada y esté fuera del repositorio. No se carga ni inspecciona
su contenido desde el código de aplicación. Reiniciar Vercel Dev al cambiar de
credenciales, porque los SDK pueden conservar clientes y tokens en memoria.

El ajuste documental de cierre no modifica `.env.local`, credenciales, cuentas,
IAM ni infraestructura; registra la validación local ya confirmada.

### Identidad de producción en Vercel

Vercel requiere configurar una identidad de servidor independiente; no dispone
automáticamente del ADC local. No subir ADC personal ni asumir que el proyecto
explícito concede acceso. Evaluar posteriormente OIDC con Workload Identity
Federation y una configuración ADC compatible, limitada al proyecto y entorno
autorizados. Esa integración requiere su propia revisión y prueba; no se implementa
en este hito. Mantener separados Development, Preview y Production. No se inicializa
Analytics. Las variables AWS de 04.3 se documentan al final.

Siguen pendientes la configuración y revisión de IAM para esa identidad de
producción, la validación en Vercel y los controles contra abuso (límites de
frecuencia y concurrencia, cuotas y monitorización de costes). La aprobación
del Hito 04.2 corresponde únicamente al entorno local, no a producción.

### Resultado de la validación local del Hito 04.2

Se confirmó manualmente el funcionamiento conjunto del frontend Vite y la API
en Vercel Dev, sin desplegar:

| Prueba local | Resultado confirmado |
| --- | --- |
| GET /api/summary | HTTP 405 |
| POST /api/summary sin token | HTTP 401 |
| POST /api/summary con Firebase ID token real de prueba | HTTP 200 |
| Resumen obtenido desde Firestore | 8 tareas, 0 pendientes, 8 completadas, progreso 100 % |

La prueba autenticada validó Firebase Auth, Firebase Admin, ADC mediante
impersonación y lectura de Firestore. No se guardan aquí tokens, credenciales,
rutas privadas ni datos identificatorios del usuario de prueba.

La cobertura automatizada incluye aislamiento de Alice y Bob con Auth y Firestore
simulados, identidad falsificada en body/query/headers sin autoridad, rechazo de
solicitudes sin token y headers de caché en respuestas 200, 401, 405, 413 y 500.
El cierre local conserva pendiente la identidad, IAM y seguridad operativa de
producción descritas arriba.

### Procedimiento para repetir la validación local sin desplegar

1. Ejecutar `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` y
   `npm run test:backend`. Este último no carga archivos `.env` ni usa credenciales
   reales: incluye una petición HTTP en localhost con Auth y Firestore simulados.
2. Con Java 21 disponible, ejecutar `npm run test:rules` para la regresión de reglas.
3. Para comprobar la función completa con Firebase real, configurar manualmente
   ADC con impersonación según el apartado anterior y establecer
   `$env:FIREBASE_ADMIN_PROJECT_ID = "workspace-m4"` en el proceso servidor.
   No modificar `.env.local`. Usar una cuenta de prueba controlada y no fijar
   variables de emulador en este proceso.
4. Con la CLI de Vercel disponible, ejecutar `vercel dev --listen 3000` desde
   `workspace/`. Revisar cualquier solicitud de vinculación de proyecto; no
   ejecutar `vercel deploy`. `npm run dev` por sí solo sirve Vite, no las Functions.
5. Iniciar sesión en el frontend local. Obtener un ID token vigente mediante
   `getFirebaseAuth().currentUser.getIdToken()` y enviarlo directamente como Bearer
   al POST local, sin imprimirlo, copiarlo a archivos o incorporarlo a comandos
   versionados. Comprobar totales, orden, 401 sin token y 405 con GET. No se debe
   crear ni modificar ningún documento desde este endpoint.
6. Revisar la configuración y el enrutamiento en Vercel antes de autorizar una
   publicación futura. Las pruebas con mocks no validan IAM ni credenciales reales.

Al cerrar 04.2, el botón de correo seguía deshabilitado y no se había implementado
AWS SES. El avance local de 04.3 se detalla al final; el endpoint de lectura
conserva su contrato. No se desplegaron funciones ni se cambiaron reglas.

Referencias oficiales: [Vite y Functions en Vercel](https://vercel.com/docs/frameworks/frontend/vite),
[Firebase Admin](https://firebase.google.com/docs/admin/setup) y
[verificación de tokens y revocación](https://firebase.google.com/docs/auth/admin/manage-sessions).
Para la siguiente etapa: [ADC local con impersonación](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment)
y [OIDC de Vercel con Google Cloud](https://vercel.com/docs/oidc/gcp).

## Hito 04.3A: contratos y preparación segura del correo

Base conservada de la subetapa anterior, desarrollada sin envíos ni cambios de
interfaz. En 04.3 se reutiliza para conectar el endpoint y el adaptador descritos
en el siguiente apartado. No se incorporan registros persistentes,
infraestructura ni cambios de credenciales.

`server/authenticated-user.ts` centraliza Bearer y `verifyIdToken(token, true)`.
Conserva los códigos, mensajes y comportamiento del endpoint de lectura; sus
headers de caché siguen establecidos en `api/summary.ts` antes de autenticar.
La identidad es inmutable y opaca para TypeScript. Su procedencia se comprueba
también en runtime, con referencias emitidas por el verificador; no se puede
reconstruir a partir de JSON, un UID o un objeto enviado por el cliente. No retiene
tokens y debe usarse dentro de la petición que la obtiene; no se serializa ni persiste.

`server/summary-recipient.ts` recibe esa identidad y consulta `getUser(uid)`.
Requiere cuenta habilitada, correo presente con sintaxis admitida y
`emailVerified === true`. El destinatario procede del registro actual de Auth,
incluso cuando el token tiene otro email o un estado de verificación antiguo.
Nunca recibe una dirección de destino del cliente. La validación admite un
subconjunto conservador de direcciones ASCII, incluido plus addressing y dominios
punycode; no admite listas, nombres de presentación, controles o inyección de headers.
Los errores tipados tienen mensajes fijos, sin dirección, UID ni detalles del SDK.

`shared/summary-send.types.ts` define un contrato inicial de aceptación para envío
(`accepted`, requestId) y errores. No afirma entrega al buzón. El endpoint de
envío utiliza este contrato; la resolución del destinatario es solo servidor.

`server/summary-email.ts` es una función pura que genera asunto fijo, texto y HTML
desde TaskSummary, sin consultar servicios ni modificar tareas, totales, progreso
u orden. Escapa contenido no confiable y no interpreta HTML o Markdown. Conserva
los saltos de línea de descripciones en el HTML mediante `<br>` después del escape.
El límite es 256 KiB combinados de texto y HTML en bytes UTF-8, después de renderizar;
no cuenta el asunto fijo. Rechaza el exceso con EMAIL_TOO_LARGE, sin devolver
contenido parcial ni incluir contenido privado en el error. Los límites de lectura
de 100 tareas y 1 MiB continúan en el servicio de resumen existente.

Pruebas sin credenciales reales cubren autenticación y procedencia de la identidad,
email ausente/no verificado/cambiado, cuenta deshabilitada, destinatarios fabricados,
errores privados, contenido malicioso, Unicode y el límite exacto de tamaño.
La regresión incluye aislamiento de usuarios y contrato HTTP del endpoint existente.

La subetapa 04.3A no activó ni simuló entrega de correos. Los pendientes actuales
se detallan a continuación.

## Hito 04.3: envío manual de resúmenes (código local)

Implementado y probado con Firebase y SES simulados. No se realizó ningún envío
real, no se configuraron credenciales ni se modificó infraestructura. Tampoco se
validó este flujo en Vercel Cloud. La aceptación técnica local no demuestra
recepción del correo ni cumplimiento operativo en producción.

### Flujo y responsabilidades

1. `SummaryPage` reutiliza `SummaryView` y `useSummarySend`. El usuario inicia
   cada envío explícitamente; montar la página o iniciar sesión no envía nada.
2. `summary-send.api.ts` comprueba la sesión actual, obtiene un ID token vigente
   mediante `getIdToken()` y hace un único POST a `/api/summary/send`.
3. `api/summary/send.ts` valida método, Bearer y petición. Autentica mediante
   `authenticated-user.ts` (`verifyIdToken(token, true)`, incluida revocación).
4. `send-summary.ts` coordina configuración, protección local, destinatario
   actual de `getUser(uid)`, lectura real de `task-summary.ts` y renderizado puro.
5. `ses.ts` encapsula `SESv2Client` y `SendEmailCommand`: formato Simple,
   asunto fijo, cuerpos UTF-8 de texto y HTML, remitente de servidor y un único
   To. No utiliza CC/BCC, contenido del cliente ni llamadas HTTP internas.

AWS SDK solo se importa desde `server/`; los contratos compartidos son tipos.
La inicialización es diferida y usa la cadena estándar de credenciales del SDK,
sin claves hardcodeadas ni lectura explícita de archivos personales.
`POST /api/summary` conserva su comportamiento de consulta, sin enviar correo.

### Contrato HTTP

`POST /api/summary/send` requiere `Authorization: Bearer <ID token>` y
`Idempotency-Key: <UUID v4>`. El body debe estar ausente/vacío o ser `{}`.
Se rechazan parámetros de query y cualquier campo del body (incluidos UID,
email, remitente, tareas o HTML). El cliente no tiene autoridad sobre estos datos.
Se limita el cuerpo original a 1024 bytes, midiendo el stream binario intacto
antes de parsearlo. `Content-Length` solo permite rechazar temprano: también se
compara con los bytes recibidos. Chunked se mide igualmente. No se consulta
`req.body`, ni se estima el tamaño mediante `JSON.stringify` de un objeto parseado.
Un stream previamente leído, terminado, abortado, con encoding de texto o sin
bytes originales verificables se rechaza con 400; no se consume una segunda vez.
Un objeto preparseado solo puede coexistir con una solicitud válida si se conserva
un stream original intacto: la autoridad siguen siendo sus bytes, no el objeto.
Los errores de lectura y EOF incompleto devuelven 400 sin llegar al envío.

El cuerpo ausente admite ausencia de `Content-Type`. Cuando hay contenido, solo
se admite `application/json`, opcionalmente con `charset=utf-8` (también entre
comillas y sin distinguir mayúsculas). Debe contener únicamente `{}`; se permiten
espacios JSON alrededor del objeto. Solo espacios, JSON malformado, otros tipos,
charsets, parámetros o campos devuelven 400. Un tipo incompatible también se
rechaza aunque el cuerpo esté vacío. Se exige UTF-8 válido y no se admite
compresión. Exceso de bytes devuelve 413, sin procesar contenido parcial.

**Compatibilidad Vercel:** sus helpers pueden consumir el stream antes del
handler y exponer `body` mediante un getter. El runtime instalado de Vercel CLI
65.2.0 y `@vercel/node` confirma ese comportamiento. Para este lector es necesario
arrancar Vercel Dev con `NODEJS_HELPERS=0` en el proceso y su entorno de build,
antes de inicializar el runtime. `vercel.json` conserva los rewrites e incluye
`build.env.NODEJS_HELPERS=0`: la CLI toma este ajuste de `meta.buildEnv`, por lo
que definirlo solo en PowerShell no garantiza desactivar el parser. No contiene
credenciales ni habilita envío. Los requests JSON ya consumidos por helpers se
rechazan deliberadamente; no se intenta reconstruir el tamaño perdido. El handler
de lectura existente usa APIs nativas de Node y no requiere esos helpers.
No se cambió configuración cloud; cualquier producción futura debe revisar esta
opción por separado y seguirá sin autorizar envíos.
Se comprobó además el runtime real instalado en un proceso aislado de loopback:
con helpers desactivados, el fixture del lector aceptó cuerpo vacío y `{}`
(200) y rechazó 2050 bytes (413). Con helpers activos, rechazó JSON ya consumido
(400). Este fixture no importó Firebase ni SES, no habilitó correo y no equivale
a una prueba autenticada de envío ni a una validación de Vercel Cloud. Los archivos
temporales utilizados para la comprobación se eliminaron al finalizar.

| HTTP | Resultado |
| --- | --- |
| 202 | `{ "status": "accepted", "requestId": "<UUID>" }`: SES confirmó aceptación; no confirma entrega |
| 400 | Petición, query, body o clave de idempotencia inválidos |
| 401 | Bearer ausente, inválido, vencido, revocado o cuenta rechazada al verificar |
| 403 | Cuenta no disponible, email ausente/inválido o no verificado en Auth actual |
| 405 | Solo POST, con `Allow: POST` |
| 409 | Envío en curso o clave ya utilizada en una operación fallida |
| 413 | Petición, resumen o correo demasiado grande; no hay envío parcial |
| 429 | Espera local entre operaciones; incluye `Retry-After` y `retryAfterSeconds` |
| 503 | Envío deshabilitado, configuración inválida, despliegue sin control distribuido, proveedor rechazado o resultado incierto |
| 500 | Fallo interno controlado, sin datos privados ni trazas |

Los errores tienen `{ "error": { "code": "...", "message": "..." } }`.
Todas las respuestas fijan `Cache-Control: private, no-store`,
`Vercel-CDN-Cache-Control: no-store` y `X-Content-Type-Options: nosniff`.
No se devuelven contenido de tareas, destinatarios, tokens ni identificadores SES.
No se registran credenciales ni contenido privado en logs de aplicación.

### Identidad, contenido y experiencia

Se consulta el registro actual de Firebase Auth en cada operación nueva: debe
estar habilitado y tener email válido con `emailVerified === true`. Un claim
antiguo de email no decide el destinatario. El registro puede cambiar después
de esa consulta: Auth y SES no admiten una transacción conjunta; se utiliza el
correo verificado obtenido para esa operación, no una garantía de atomicidad
entre proveedores.

No se agrega un flujo de verificación de correo ni se modifica artificialmente
`emailVerified`. Las cuentas sin verificar reciben un bloqueo y un mensaje
específico. Antes de una prueba real se requiere una cuenta de prueba con correo
verificado mediante el flujo oficial de Firebase autorizado para el proyecto.

Se conservan el orden y los límites de 100 tareas y 1 MiB de lectura. El correo
incluye totales, progreso y listado completo, escapa HTML y limita texto + HTML
a 256 KiB UTF-8 después de renderizar. El asunto fijo no depende de las tareas.

La UI representa loading, aceptación y errores mediante estados accesibles;
deshabilita el botón durante la operación y evita solicitudes simultáneas.
Al cambiar de usuario limpia el estado y aborta la espera local; abortar el
cliente **no cancela** un efecto ya iniciado en el servidor. La espera del
frontend vence a los 30 segundos. No hay envíos automáticos ni reintentos de red.
Ante `SEND_STATUS_UNKNOWN` o `SEND_IN_PROGRESS` bloquea otro intento en esa vista.
Recargar no demuestra que la operación anterior haya fallado.

### Idempotencia y límites: alcance local explícito

`summary-send-guard.ts` implementa una abstracción reemplazable con guardia
en memoria: una operación por UID en curso, 60 segundos de espera tras un
resultado confirmado y retención de claves durante 24 horas. Repetir una clave
aceptada devuelve la aceptación anterior sin enviar un correo nuevo. Una clave
fallida no vuelve a ejecutarse; una operación pendiente o incierta no se expulsa
por tiempo. Hay un máximo de 1000 registros; al llenarse se rechazan nuevas
operaciones. No se envían resúmenes parciales ni se promete exactamente un envío.

El SDK usa `maxAttempts: 1`: sin reintentos automáticos, conexión de 3 s y
solicitud de 10 s con error al superar el plazo. Un timeout, error de red o
respuesta sin MessageId se trata como **incierto**, no como rechazo definitivo.
El bloqueo incierto requiere revisión antes de otro intento. Reiniciar el
proceso pierde la memoria y no resuelve si SES aceptó el envío anterior.

Esta protección **no es distribuida**, no impone una cuota diaria y no sobrevive
a reinicios. La política pura `summary-email-runtime.ts` bloquea los entornos
declarados Preview y Production con `DISTRIBUTED_GUARD_REQUIRED`, incluso con el
flag activado; rechaza estados ausentes, vacíos, desconocidos o contradictorios
con `SEND_DISABLED`. Se evalúa antes de reservar o consultar destinatario/tareas.
No se debe retirar ese bloqueo para publicar sin una revisión adicional.
Una etapa posterior debe autorizar almacenamiento solo servidor y transacciones
para reservas por UID/clave, cuotas y resolución de resultados inciertos, con
IAM revisado. No se crearon colecciones ni se modificaron reglas en este hito.
La alternativa mínima actual sirve únicamente para una prueba local controlada
en un solo proceso, previa autorización, y no para activar correo en producción.

### Variables y credenciales (sin activación en esta intervención)

| Variable | Uso |
| --- | --- |
| `FIREBASE_ADMIN_PROJECT_ID` | Proyecto explícito; ADC de servidor configurado por separado |
| `SUMMARY_EMAIL_ENABLED=false` | Flag autoritativo de servidor; solo `true` permite continuar en entorno local |
| `SUMMARY_EMAIL_RUNTIME=disabled` | Opt-in adicional: solo `local-controlled` puede habilitar una prueba local autorizada |
| `NODEJS_HELPERS=0` | Desactiva helpers de Vercel para conservar los bytes originales; no habilita correo |
| `AWS_SES_REGION` | Región donde se verificó la identidad de SES |
| `SES_FROM_EMAIL` | Dirección única de remitente verificada en SES; nunca proviene del cliente |
| `VITE_SUMMARY_EMAIL_ENABLED=false` | Disponibilidad visual pública; no habilita el backend por sí misma |

Los valores por defecto mantienen el envío desactivado. No se modificó
`.env.local`. Cambiar el flag Vite requiere reiniciar el dev server o reconstruir
el frontend; los flags de servidor se configuran solo en el proceso servidor.
No usar `VITE_` para credenciales AWS ni Firebase Admin.

El único estado ALLOW de la política exige **todos** estos valores exactos:
`SUMMARY_EMAIL_ENABLED=true`, `SUMMARY_EMAIL_RUNTIME=local-controlled`,
`VERCEL=1`, `VERCEL_ENV=development`, `NODE_ENV=development`, `NODEJS_HELPERS=0`.
`VERCEL_TARGET_ENV` puede estar ausente; si está presente debe ser `development`.
Además, región y remitente deben ser válidos. No basta `NODE_ENV=development`,
el flag aislado ni la ausencia de variables Vercel. El código instalado de la
CLI confirma que Vercel Dev fija `VERCEL=1` y `VERCEL_ENV=development`; el resto
debe configurarse explícitamente para la prueba autorizada. No se establecieron
valores ALLOW en ningún proceso con dependencias reales durante este parche.

Esto es una política de **configuración**, no una atestación del host: un operador
que copie intencionalmente todos los valores locales a un despliegue podría
imitarlo. IAM y el control de infraestructura deben impedir que despliegues no
autorizados reciban credenciales capaces de enviar. Esa garantía externa no se
ha verificado ni modificado aquí. No publicar credenciales ni activar flags en
Preview/Production. El flag de UI no cambia ninguna de estas restricciones.

Preparación local sin habilitar correo (solo tras revisar el entorno): conservar
`build.env.NODEJS_HELPERS=0` del `vercel.json` versionable y definir en la misma
sesión de PowerShell `NODEJS_HELPERS=0` y `NODE_ENV=development`,
conservar `SUMMARY_EMAIL_ENABLED=false` y `SUMMARY_EMAIL_RUNTIME=disabled`, y
reiniciar Vercel Dev con `vercel dev --listen 3000`. No usar `vercel env pull`
para este ajuste: no hace falta tocar `.env.local` ni la configuración remota.
La habilitación posterior del único estado ALLOW y la identidad AWS requieren
autorización separada. No se ejecuta ni se recomienda activar ese estado ahora.

Para desarrollo futuro, usar una identidad AWS autorizada de corta duración y
la cadena de proveedores estándar (por ejemplo un perfil externo al repositorio
con sesión SSO), sin versionar archivos de credenciales. Para Vercel, evaluar
OIDC con rol limitado a proyecto/entorno y `ses:SendEmail` sobre la identidad
SES autorizada, restringiendo remitente y región. El token OIDC de Vercel **no se
integra automáticamente** solo por crear un SESv2Client: requerirá configurar la
federación y un proveedor de credenciales temporal, probarlo y revisar IAM.
La identidad Firebase Admin en producción también sigue pendiente.

En SES sandbox tanto remitente como destinatario deben cumplir la verificación
de SES; `emailVerified` de Firebase no sustituye esa autorización de SES.
No solicitar salida de sandbox ni crear identidades, roles o claves sin revisión.

### Pruebas y validación real pendiente

Ejecutar `npm test`, `npm run test:backend`, `npm run typecheck`, `npm run lint`,
`npm run build` y, con Java 21 disponible, `npm run test:rules`.
Las pruebas del adaptador sustituyen el SDK o inyectan transporte; las del flujo
completo simulan Auth, Firestore y correo. Ninguna necesita acceso AWS ni realiza
envíos. Se cubren identidad y destinatario actuales, entradas maliciosas,
caché, tamaño, concurrencia, incertidumbre, errores y estados de UI.
La configuración backend de Vitest no carga archivos de entorno.

Antes de una prueba real: revisar el diff, autorizar identidad/credenciales
temporales e IAM mínimo, configurar remitente y región SES, comprobar sandbox y
usar una cuenta de prueba propia con email verificado en ambos sistemas cuando
corresponda. Solo con autorización explícita habilitar temporalmente los flags
en un único proceso local de Vercel Dev; hacer un clic manual, comprobar 202 y
recepción, y volver a deshabilitar. No repetir automáticamente ante incertidumbre.
No registrar tokens en consola, archivos, historial ni capturas.
Vercel Cloud requiere además el control distribuido descrito arriba antes de
autorizar un envío o un despliegue con correo habilitado.

Referencias: [SES SendEmail](https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html),
[cadena de credenciales de AWS SDK v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html),
[sandbox SES](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
y [OIDC de Vercel con AWS](https://vercel.com/docs/oidc/aws).
La política de lectura sigue la [desactivación oficial de helpers Node](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration)
y el [comportamiento del helper body](https://vercel.com/docs/functions/runtimes/node-js).
