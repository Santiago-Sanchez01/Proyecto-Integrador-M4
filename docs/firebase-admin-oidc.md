# Firebase Admin con Vercel OIDC

Workspace usa Application Default Credentials (ADC) en desarrollo local.
En Preview y Production, Firebase Admin requiere el modo explícito
`vercel-oidc`. El proveedor toma la credencial temporal del contexto de
la Function y la intercambia en Google STS. A continuación, impersona a
la cuenta de servicio autorizada. Google Auth conserva en memoria el
token de acceso de Google hasta su ventana de renovación. Cada intercambio
obtiene el token OIDC de la invocación activa.

Firebase Auth usa el adaptador `Credential`. El cliente oficial de
Firestore recibe el mismo Google Auth por configuración y usa el transporte
REST para las consultas y transacciones del backend. Los tests de Firestore
conectan sus propios clientes al emulador. La inicialización real de Admin
rechaza las variables del emulador.

## Configuración en GCP y Vercel

1. Confirmar en Vercel el equipo propietario y el nombre del proyecto
   `workspace-m4`. Seleccionar el modo de emisor **Team**. Para ese modo,
   el issuer se deriva como `https://oidc.vercel.com/<team-slug-real>`
   y la audiencia por defecto como `https://vercel.com/<team-slug-real>`.
   Cotejar ambos con la configuración del proyecto.
2. Obtener en GCP el número del proyecto que alojará el pool. Habilitar
   Security Token Service, IAM Service Account Credentials, Identity Toolkit
   y Cloud Firestore en los proyectos correspondientes.
3. Crear un Workload Identity Pool y un proveedor OIDC para cada entorno.
   Introducir el issuer y la audiencia del paso 1 como audiencia permitida.
   Mapear `google.subject=assertion.sub` y restringir la condición del
   proveedor a la igualdad exacta con
   `owner:<team-slug-real>:project:workspace-m4:environment:preview` o
   `owner:<team-slug-real>:project:workspace-m4:environment:production`.
   Si se despliega un proyecto Vercel distinto para Preview, usar el nombre
   y equipo efectivos de ese despliegue.
4. Usar una cuenta de servicio dedicada por entorno. En su política IAM,
   conceder `roles/iam.workloadIdentityUser` al miembro exacto
   `principal://iam.googleapis.com/projects/<número-del-pool>/locations/global/workloadIdentityPools/<pool-real>/subject/<sujeto-exacto>`.
   Mantener las vinculaciones de Preview y Production separadas.
5. En Vercel, configurar estas variables exclusivamente del lado servidor,
   seleccionando el entorno correspondiente.

| Variable | Preview | Production |
| --- | --- | --- |
| `FIREBASE_ADMIN_CREDENTIAL_MODE` | `vercel-oidc` | `vercel-oidc` |
| `FIREBASE_ADMIN_PROJECT_ID` | ID real del proyecto Firebase de pruebas, coherente con Firebase Web | `workspace-m4` |
| `GCP_PROJECT_NUMBER` | Número real del proyecto donde vive el pool Preview | Número real del proyecto donde vive el pool Production |
| `GCP_WORKLOAD_IDENTITY_POOL_ID` | ID del pool Preview | ID del pool Production |
| `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` | ID del proveedor Preview | ID del proveedor Production |
| `GCP_SERVICE_ACCOUNT_EMAIL` | Cuenta de servicio Preview | Cuenta de servicio Production |

`VERCEL`, `VERCEL_ENV` y, cuando exista, `VERCEL_TARGET_ENV` proceden
de Vercel. Mantener los tres flags de correo en sus valores deshabilitados.
El cliente construye la audiencia del intercambio STS a partir del recurso
del proveedor, independientemente de la audiencia del JWT emitido por Vercel.
El runtime no requiere claves JSON, archivos ADC ni un token OIDC configurado
como variable en Vercel. En desarrollo, omitir el modo o elegir `adc`.

## Compatibilidad del runtime

Vercel desactiva por defecto `require(ESM)`. Firebase Admin 14.5.1 usa
`jwks-rsa@4.1.0`, que carga JOSE con `require()`. El override de npm
limita JOSE 5.10.0 a ese consumidor para conservar la carga CommonJS y la
conversión de claves públicas. Esta versión queda fuera del rango publicado
por `jwks-rsa@4.1.0` (`^6.1.3`). La compatibilidad se verificó con estas
versiones exactas. Revisar el override al actualizar las dependencias y
retirarlo cuando una versión compatible supere el smoke test del artefacto:

```powershell
node --no-experimental-require-module tests/backend/vercel-artifact-smoke.mjs .vercel/output
```

[Compatibilidad ESM de Vercel](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration#experimental-node.js-require()-of-es-module)

## Permisos y verificación

- La validación criptográfica del ID token usa el proyecto Firebase y las
  claves públicas. La comprobación de revocación y `getUser(uid)` requieren
  `firebaseauth.users.get` en el proyecto Firebase.
- Leer tareas por UID con `runQuery` requiere `datastore.entities.get` y
  `datastore.entities.list`. Empezar con estos permisos de lectura.
- Las transacciones de la guarda requieren además `datastore.databases.get`
  y, para escribir, `datastore.entities.create` y `datastore.entities.update`.
  Evaluar su alcance en una base de pruebas antes de conceder escritura cloud.
  Las reglas Firestore del cliente no delimitan los permisos de una identidad Admin.

En un Preview autorizado, verificar el rechazo de un token de otro proyecto,
el acceso del usuario a su resumen y la renovación entre invocaciones.
Para validar permisos de escritura de la guarda, usar una base de pruebas y
ejecutar una reserva y su finalización sin contactar SES. Confirmar que el
proveedor Preview rechaza el sujeto de Production y viceversa. No promover el
cambio a Production hasta comprobar estos pasos en Preview.

Referencias oficiales

- [OIDC de Vercel con GCP](https://vercel.com/docs/oidc/gcp)
- [Claims y contexto OIDC de Vercel](https://vercel.com/docs/oidc/reference)
- [Permisos IAM de Cloud Firestore](https://firebase.google.com/docs/firestore/security/iam)
