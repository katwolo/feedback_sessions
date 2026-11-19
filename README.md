# Sessions/Supòsits

App para evaluar supuestos prácticos y sesiones desde el móvil. Guarda todo en un Google Sheet.

## Cómo está montada

| Parte | Dónde vive | Cómo se actualiza |
|---|---|---|
| `index.html` (la página) | **GitHub Pages** | Automáticamente al subir cambios a la rama que publica GitHub Pages. |
| `code.gs` + `appsscript.json` (el servidor) | **Apps Script** | A mano: copiar al editor y crear una **nueva versión** de la implementación. |

La página llama al servidor con `fetch` (POST) a la URL `/exec`, configurada en la constante `API_URL`
al principio del script de `index.html`.

### Configurar la implementación de Apps Script

1. Copia `code.gs` y `appsscript.json` al editor y guarda.
2. Ejecuta una vez `configurarRegistre` y `autoritzarTot`.
3. **Implementar → Gestionar implementaciones → editar**:
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**.
   - Versión: **Nueva versión**.
   Así la URL `/exec` no cambia y no hace falta tocar `API_URL`.
4. El archivo HTML `index` del editor de Apps Script ya no se usa: puedes borrarlo.

### Quién puede entrar

Cualquiera que tenga el enlace de la página (o la URL `/exec`) puede ver los datos del alumnado,
borrar resultados y enviar correos desde tu cuenta. Comparte el enlace solo con quien lo necesite.

## Notas guardadas en el móvil

Mientras evalúas, cada cambio se guarda al instante en el móvil (también cuando la app pasa a segundo plano).
Si la página se recarga o el navegador la cierra, al volver a abrirla la sesión aparece tal como estaba,
incluso sin conexión. Las sesiones pendientes de exportar salen en "Canviar" → "Desades al mòbil" para
reprenderlas o descartarlas. Al exportar al Sheet, la copia del móvil se borra.

## Pestañas del Sheet

| Pestaña | Contenido |
|---|---|
| 👤 Llistat | Alumnado. La columna "ID alumne" (el correo de Classroom) evita confundir a alumnos con el mismo nombre. El desdoblamiento de cada alumno se asigna en la app: Configurar → Desdoblaments ("General" = sin desdoblamiento; al evaluar "General" sale toda la clase). |
| 🔧 Configuració | Ítems de evaluación. Si "Supòsit" está vacío, el ítem vale para todo el módulo. Tipos: `numeric`, `sino`, `rubrica`. |
| 📋 Supòsits | Catálogo de supuestos por módulo (fecha, descripción, activo). |
| 👥 Alumnat | Una fila por alumno y sesión: nota final, grupo, origen de la nota (Calculada/Manual) y correo enviado. |
| 🗄 Historial | Desglose por ítem, con el peso usado. Nunca se borra. |

Lo más cómodo es editar la configuración desde la pestaña **Configurar** de la app.

## Estilos

`index.html` carga `estils.css`, que se genera con Tailwind a partir de las clases que usa la página:

```
npm install      # una sola vez
npm run css      # después de cambiar clases en index.html
```

## Tests

```
npm test
```

Ejecutan `code.gs` contra un Google Sheet simulado en memoria.
