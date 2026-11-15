# Sessions/Supòsits

App para evaluar supuestos prácticos y sesiones desde el móvil. Guarda todo en un Google Sheet.

## Cómo se despliega (importante: ha cambiado)

La app **ya no funciona desde GitHub Pages**. Antes la API estaba abierta a cualquiera que tuviera
la URL y el token, y el token era visible en el `index.html` público. Ahora la página la sirve el mismo
proyecto de Apps Script y Google identifica a quien la abre.

1. En el editor de Apps Script del proyecto:
   - Sustituye `code.gs` y `appsscript.json` (Configuración del proyecto → "Mostrar archivo de manifiesto").
   - Crea un archivo HTML llamado **`index`** (Archivo → nuevo → HTML) y pega el contenido de `index.html`.
2. Ejecuta **una vez** `configurarRegistre` (añade las columnas y pestañas nuevas al Sheet sin tocar
   tus datos) y después `autoritzarTot` (pide los permisos nuevos de Drive para los PDF).
3. **Implementar → Gestionar implementaciones → Editar → Nueva versión**. Abre la URL `/exec`: esa es la app.
4. **Revoca el token antiguo.** La implementación vieja que usaba GitHub Pages sigue viva hasta que la archives:
   ve a "Gestionar implementaciones" y archívala.

### Quién puede entrar

- Por defecto (`"access": "MYSELF"` en `appsscript.json`) solo entras tú.
- Para que entren más profesores de tu dominio de Google Workspace: cambia a `"access": "DOMAIN"` y
  añade sus correos a `PROFESSORS_AUTORITZATS` al principio de `code.gs`.

## Pestañas del Sheet

| Pestaña | Contenido |
|---|---|
| 👤 Llistat | Alumnado. La columna "ID alumne" (el correo de Classroom) evita confundir a alumnos con el mismo nombre. |
| 🔧 Configuració | Ítems de evaluación. Si "Supòsit" está vacío, el ítem vale para todo el módulo. Tipos: `numeric`, `sino`, `rubrica`. |
| 📋 Supòsits | Catálogo de supuestos por módulo (fecha, descripción, activo). |
| 👥 Alumnat | Una fila por alumno y sesión: nota final, grupo, origen de la nota (Calculada/Manual) y correo enviado. |
| 🗄 Historial | Desglose por ítem, con el peso usado. Nunca se borra. |

Lo más cómodo es editar la configuración desde la pestaña **Configurar** de la app.

## Tests

```
node tests/backend.test.js
```

Ejecutan `code.gs` contra un Google Sheet simulado en memoria.
