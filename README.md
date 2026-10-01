# Jhunnior Chat

Aplicación de chat responsive creada con Next.js y TypeScript. Esta primera versión implementa la experiencia de producto: conversaciones locales, historial persistente, nuevo chat, selector de tema, diseño móvil y una ruta de chat preparada para conectar un proveedor de IA.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Estado de las integraciones

La interfaz funciona sin claves. La respuesta actual de `src/app/api/chat/route.ts` es un adaptador de demostración para que el flujo sea comprobable de extremo a extremo. Para producción se debe sustituir por el proveedor elegido y configurar las variables de `.env.example`:

- Clerk para sesiones y cuentas.
- PostgreSQL para usuarios, conversaciones y cuotas (la migración está en `database/001_initial.sql`).
- Un proveedor compatible de IA para el streaming real.
- Vercel Blob para adjuntos privados.

La especificación completa de seguridad, permisos y despliegue se conserva en la documentación incluida.
