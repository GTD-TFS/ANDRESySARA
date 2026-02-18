# ANDRESySARA

Web RSVP pública con Firebase (Spark) + panel admin para la novia.

## Incluye
- `index.html`: landing + formulario RSVP público.
- `admin.html`: panel privado con login GitHub.
- `firestore.rules`: reglas para formulario público y administración privada.

## Requisitos (una sola vez en Firebase Console)
1. Activar Firestore API y crear base de datos en modo `Native`.
2. Activar Authentication -> `GitHub`.
3. En `Firestore -> Data`, crear documento `admins/<TU_UID>` con:
   - `enabled: true`
   - `email: "tu-email"`
   - `role: "admin"`
4. (Opcional) Crear `settings/event` para personalizar textos/horarios.

## Deploy de reglas desde este repo
```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project andresysara-f92c1
```

## Publicación web
Este repo funciona directo en GitHub Pages:
- URL esperada: `https://gtd-tfs.github.io/ANDRESySARA/`

## Notas
- La config de Firebase Web está en `firebase-config.js`.
- El formulario usa una llave hash (`dedupeKey`) para evitar duplicados exactos por nombre+apellido+contacto.
