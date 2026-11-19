# AWS SES en Preview mediante Vercel OIDC

El cliente SES conserva la cadena estándar de credenciales en desarrollo.
En Vercel, la credencial federada solo se admite para el proyecto
`workspace-m4`, la rama `feat/summary-email-cloud-integration` y el entorno
`preview`. La política de envío sigue rechazando Preview y Production y se
evalúa antes de construir el cliente SES.

| Variable de servidor | Configuración de Preview |
| --- | --- |
| `AWS_ROLE_ARN` | `arn:aws:iam::302495249734:role/workspace-ses-preview` |
| `AWS_SES_REGION` | `us-east-2` |
| `SES_FROM_EMAIL` | Dirección verificada que autoriza el rol en SES Sandbox |

Limitar esas variables a Preview y a la rama de integración. Mantener
`VITE_SUMMARY_EMAIL_ENABLED=false`, `SUMMARY_EMAIL_ENABLED=false` y
`SUMMARY_EMAIL_RUNTIME=disabled`. La región `AWS_REGION` de la Function
no selecciona la región STS ni SES.
Una futura prueba de envío en Sandbox requerirá un destinatario verificado en
SES en `us-east-2`, además del correo verificado en Firebase.

El proveedor oficial de Vercel resuelve el token mediante un helper que también
admite fuentes de desarrollo. Workspace usa el proveedor oficial de AWS SDK
`fromWebToken` con el token tomado exclusivamente del contexto de invocación
de Vercel. El intercambio usa la audiencia original
`https://vercel.com/santiago-sanchez01` y el rol de Preview. Las credenciales
de STS duran 15 minutos y conservan el vencimiento que usa el SDK para renovar.
Cada resolución obtiene el token de la invocación en curso.

## Verificación real de STS sin enviar

El botón temporal «Verificar conexión AWS» en Mi Resumen llama a
`POST /api/summary/aws-check` con el ID token obtenido por Firebase Web.
El servidor verifica el token y su revocación, autoriza un único UID y
acepta únicamente el Preview de este proyecto y rama. El proveedor
existente resuelve las credenciales del rol. Con esas credenciales, el
diagnóstico llama a `GetCallerIdentity` y coteja en memoria la cuenta, el
rol asumido y el nombre de sesión esperado. La Function responde solo
`{"ok":true}` o un código público. No llama a SES ni modifica Firestore.

1. Cuando se autorice la publicación, mantener Vercel Authentication y OIDC
   en modo Team. Confirmar la exposición de `VERCEL`, `VERCEL_ENV`,
   `VERCEL_PROJECT_NAME` y `VERCEL_GIT_COMMIT_REF` para build y runtime.
   Si Vercel proporciona `VERCEL_TARGET_ENV`, debe ser `preview`.
2. Configurar `AWS_STS_DIAGNOSTIC_ALLOWED_UID` con el UID exacto de la cuenta
   de prueba, exclusivamente como variable de servidor en Preview y en la
   rama de integración. Omitir el prefijo `VITE_`. Confirmar `AWS_ROLE_ARN`,
   `AWS_SES_REGION` y la [configuración de Firebase Admin OIDC](firebase-admin-oidc.md).
   Este diagnóstico no necesita un remitente SES. Conservar los tres flags
   de correo deshabilitados.
3. Publicar solo esa rama después de aprobar la revisión. Abrir el nuevo
   Preview protegido, autenticar primero en Vercel y luego en Workspace con
   la cuenta autorizada. Ir a **Mi Resumen → Verificar conexión AWS**.
4. Registrar el deployment, la hora y el resultado visible. **HTTP 200**
   con «Identidad AWS verificada» confirma el intercambio OIDC y que STS
   identificó el rol previsto. `401` indica token Firebase ausente o inválido,
   `403 FORBIDDEN` indica otro UID y `404 DIAGNOSTIC_DISABLED` indica un
   entorno o allowlist inactivos. `503 AWS_NOT_CONFIGURED` indica rol o
   región ausentes o incorrectos. `502 AWS_STS_UNAVAILABLE` agrupa errores
   del token OIDC, el intercambio o la consulta STS.
   `502 AWS_IDENTITY_MISMATCH` indica que la cuenta, el rol o la sesión
   devueltos difieren de lo esperado. Para distinguir un rechazo de
   federación de un fallo posterior, un operador autorizado puede
   correlacionar la hora con `AssumeRoleWithWebIdentity` en CloudTrail.
   Registrar solo el código sanitizado.

El `200` valida la identidad en STS. La entrega de correo y los permisos
de envío de SES requieren comprobaciones independientes.
[Referencia de GetCallerIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html)

## Evidencia de entrega

El operador obtuvo HTTP 200 al consultar el resumen con Firebase Admin OIDC
en Preview. También obtuvo HTTP 200 al validar la identidad AWS por STS
en el Preview del commit `6d289a1`.
También confirmó la recepción de un correo enviado desde AWS Console en
`us-east-2`. Quedan pendientes la autorización efectiva de `ses:SendEmail`
para el rol Preview y la recepción de un resumen originado en Workspace.

La ruta actual de envío rechaza Preview y Production antes de reservar
o contactar SES. Activar los flags no habilita el runtime cloud. El cliente
de envío omite cookies, así que un futuro Preview protegido deberá conservar
las cookies del mismo origen sin sustituir el token Firebase.

## Envío de prueba pendiente de autorización

1. Limitar la prueba al Preview protegido de integración y a un UID por
   allowlist. Comparar en el servidor el correo verificado de Firebase
   con el único buzón de prueba autorizado. Verificar remitente y destino
   en SES Sandbox de la misma región. Confirmar por lectura el permiso
   `ses:SendEmail` del rol sobre el remitente y la restricción al destinatario
   antes de autorizar la prueba.
   [Restricciones de SES Sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
   [Controles IAM de SES](https://docs.aws.amazon.com/ses/latest/dg/control-user-access.html)
2. Preparar una autorización temporal específica en el servidor,
   deshabilitada por defecto y con vencimiento. Mantener obligatoria la
   guarda Firestore. Usar un único ID de operación fijado por el servidor
   para todos los intentos y un ámbito de contadores exclusivo. El
   `requestId` de respuesta conserva el contrato del cliente. La variante
   normal usa `summarySendControl` y consume una partición global aun con
   un UID de prueba. En la misma base real, un ámbito separado solo
   separa rutas y contadores a nivel de código. La cuenta Admin conserva
   permisos de escritura sobre el resto de la base. La prueba de hoy
   queda en el emulador mientras ese riesgo y la autorización sigan
   sin resolver.
3. Tras revisión y autorización explícita, ejecutar un solo envío.
   Registrar HTTP 202 como aceptación, comprobar recepción en el buzón
   autorizado y cerrar la autorización. Ante un resultado incierto,
   conservar la reserva y reconciliar antes de repetir. Production
   queda fuera de este flujo y requiere identidades Google Cloud y AWS
   propias, guardas validadas y un plan de recuperación independiente.

### Retirada

Quitar `AWS_STS_DIAGNOSTIC_ALLOWED_UID` de Preview. Eliminar
`api/summary/aws-check.ts`, su contrato, la opción AWS de Mi Resumen y sus
pruebas, incluida la rama AWS del smoke test. Quitar la entrada de
`.env.example` y la dependencia directa `@aws-sdk/client-sts` si ya no
tiene consumidores. Conservar el proveedor de credenciales y la política de
correo. Publicar la retirada en Preview con autorización, verificar que
desapareció el botón y que la ruta devuelve `404`. Retirar también el
deployment temporal que recibió el UID. Vercel aplica los cambios de
variables a nuevos deployments. [Variables de entorno en Vercel](https://vercel.com/docs/environment-variables)

## Guarda Firestore antes de activar envío

El rol Preview necesita `datastore.entities.get` para las lecturas
transaccionales, `datastore.databases.get` para abrir o revertir transacciones,
y `datastore.entities.create` y `datastore.entities.update` para confirmar
reservas y transiciones. Las consultas de tareas usan además
`datastore.entities.list`. Las reglas del cliente no restringen estos
permisos de Admin.

En una base aislada, comprobar reserva atómica de la solicitud y cuota,
transición a iniciado, resultado aceptado simulado, fallo confirmado y estado
incierto. Probar una colisión entre dos instancias y la denegación de acceso
desde Firebase Web. El HTTP 200 de lectura en Preview no verifica escrituras
ni el alcance efectivo del rol sobre Firestore.
