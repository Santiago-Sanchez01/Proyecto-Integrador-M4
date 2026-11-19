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

Con autorización posterior, instrumentar temporalmente el flujo autenticado
del diagnóstico de Preview. Exigir Vercel Authentication, la rama y el proyecto
indicados y un UID de prueba autorizado comparado en el servidor. Invocar el
proveedor de credenciales solamente y, si se necesita una segunda comprobación,
usar `GetCallerIdentity` con esas credenciales para cotejar la cuenta y el rol
asumido en memoria. Registrar únicamente éxito o un código sanitizado. Retirar
la instrumentación al terminar. Este paso se puede correlacionar con el
evento `AssumeRoleWithWebIdentity` en CloudTrail. Mantener cerrada la ruta
de envío y evitar instanciar SES durante la prueba.

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
