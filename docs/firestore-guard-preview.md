# Validación de la guarda Firestore en Preview

## Guarda actual

La reserva lee con `getAll` el estado del usuario y de la solicitud. Deriva
el documento de usuario de SHA-256 del UID y el shard global del primer byte
de ese hash. Usa el `readTime` de Firestore para el día UTC, el cooldown de
60 segundos y la vigencia de la reserva. Cuando admite la solicitud, una
transacción escribe el contador del usuario, el de uno de cuatro shards
globales y el estado de la solicitud. La cuota se consume al reservar,
incluso ante fallo confirmado. Cada shard tiene su propio límite, por lo
que puede agotarse mientras otro conserva cupo.

La transición a iniciado y la confirmación usan transacciones separadas
que releen los documentos y comprueban el identificador de solicitud,
propietario de reserva y estado. Las actualizaciones requieren documentos
existentes y el SDK gestiona contención y reintentos de la transacción.
Una aceptación se reproduce con la misma clave. Una clave marcada como
fallida se rechaza. Una reserva abandonada antes de iniciar puede ser
sustituida al vencer, y un propietario sustituido pierde autoridad.
Una reserva iniciada vencida o un resultado incierto bloquean otros
envíos hasta reconciliar el resultado. La Function de envío invoca SES
después de confirmar el inicio, fuera de toda transacción.

## Aislamiento

El diagnóstico utiliza un proyecto de pruebas separado cuyo ID empieza con
`workspace-guard-` y la base Firestore Native nombrada
`workspace-guard-diagnostics`. El proyecto Firebase `workspace-m4`
sigue proporcionando la identidad del operador. El cliente Firestore
REST de la prueba utiliza una segunda identidad federada dedicada al
proyecto aislado. La base `(default)` y el proyecto de Workspace se
rechazan como destinos. Dentro de la base aislada, cada ejecución crea un
UUID de servidor y cada escenario tiene sus propios documentos y
contadores, bajo `summaryGuardDiagnosticRuns/{uuid}/cases/{caso}`.
El cliente envía solo su token y la identidad verificada se usa solamente
para autorizar la ejecución.

La cuenta Preview de Workspace tiene una vinculación directa sin
condición a `workspaceFirebasePreview` en `workspace-m4`, cuya única
base al momento de la inspección era `(default)`. El rol incluye creación
y actualización de documentos. Un prefijo en esa base dejaría el
aislamiento a cargo de la aplicación, y los SDK Admin usan IAM. Se usa
un proyecto separado para evitar compartir permisos, contadores,
documentos y disparadores con Workspace. [IAM para servidores Firestore](https://docs.cloud.google.com/firestore/native/docs/security/iam)

## Requisitos para una ejecución autorizada

1. Provisionar un proyecto desechable con el prefijo indicado y la base
   nombrada exacta, vacía, sin importar datos ni habilitar disparadores.
   Denegar acceso por SDK cliente. Confirmar el destino y que no exista
   ninguna concesión directa ni heredada sobre Workspace para la cuenta
   de pruebas. [Administración y acceso por base](https://firebase.google.com/docs/firestore/manage-databases)
2. Provisionar la cuenta `workspace-guard-preview@<proyecto-de-pruebas>.iam.gserviceaccount.com`.
   Permitir la impersonación mediante `roles/iam.workloadIdentityUser`
   únicamente al sujeto Vercel Preview del proyecto Workspace, mediante el
   pool y proveedor Preview existentes. En el proyecto aislado conceder un
   rol personalizado con `datastore.databases.get` para transacciones y
   rollback, `datastore.entities.get` para lecturas por referencia y
   `datastore.entities.create` y `datastore.entities.update` para
   reservas y transiciones. Restringir el binding al recurso exacto con
   `resource.name == "projects/<proyecto-de-pruebas>/databases/workspace-guard-diagnostics"`.
   No se necesita listar colecciones ni borrar documentos. La verificación
   del token con revocación sigue usando `firebaseauth.users.get` de la
   identidad Firebase Admin existente. [Permisos de Firestore Native](https://docs.cloud.google.com/firestore/native/docs/security/iam)
3. Limitar las siguientes variables de servidor a Preview y a
   `feat/summary-email-cloud-integration`. Mantener Vercel Authentication,
   OIDC Team, la [configuración Firebase Admin de Preview](firebase-admin-oidc.md)
   y los tres flags de correo deshabilitados.

   | Variable | Valor |
   | --- | --- |
   | `FIRESTORE_GUARD_CHECK_PROJECT_ID` | ID real del proyecto separado `workspace-guard-…` |
   | `FIRESTORE_GUARD_CHECK_DATABASE_ID` | `workspace-guard-diagnostics` |
   | `FIRESTORE_GUARD_CHECK_ALLOWED_UID` | UID exacto de la cuenta Firebase autorizada |

4. Tras autorizar un nuevo Preview, iniciar sesión en Vercel y en Workspace
   con la cuenta autorizada. En **Mi Resumen → Verificar guarda Firestore**,
   el `200` confirma reserva, duplicados, confirmación, cooldown, cuotas,
   concurrencia, estado incierto y rollback para fixtures. La carrera usa
   dos reservas concurrentes sobre el mismo ámbito desde una invocación.
   Las pruebas del emulador también cubren clientes independientes y
   pérdida de confirmación. El diagnóstico no comprueba IAM de escritura
   sobre la base real ni envío SES. Un timeout del navegador puede dejar
   operaciones ya confirmadas en el proyecto aislado.

## Limpieza

Quitar las tres variables del siguiente deployment y desactivar el acceso
al Preview temporal que las recibió. Revocar el acceso de impersonación
y el binding condicionado de la cuenta de prueba con autorización
posterior. Con otra identidad de administración y tras verificar el ID
completo del proyecto y de la base, eliminar recursivamente
`summaryGuardDiagnosticRuns` de la base aislada, o retirar la base
nombrada completa si es desechable. Borrar solo un documento padre no
elimina sus subcolecciones. Retirar el botón, la Function, las variables
de ejemplo y las pruebas específicas del diagnóstico antes de cualquier
promoción. [Eliminar datos en Firestore](https://firebase.google.com/docs/firestore/manage-data/delete-data)
