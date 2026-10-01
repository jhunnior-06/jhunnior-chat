# Orden de implementación
1. Base Next.js, entorno validado y diseño responsive.
2. Clerk y sincronización de users mediante funciones SQL de privilegio mínimo.
3. PostgreSQL, roles, RLS y repositorios transaccionales.
4. CRUD de conversaciones, historial paginado y settings.
5. Proveedor de IA, validación, idempotencia, streaming y persistencia.
6. Cuotas atómicas, recuperación de generaciones interrumpidas y observabilidad.
7. Archivos privados y cola de eliminación.
8. Feedback, exportación y borrado de cuenta.
9. Pruebas entre dos usuarios, build, preview y producción.

Definición de terminado: todas las pruebas del README pasan, credenciales y modelo están configurados, las migraciones se aplicaron con roles separados y el despliegue responde en producción. El ZIP define la estructura; no sustituye esta implementación.
