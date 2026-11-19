# Sessions/Supòsits

App para evaluar supuestos prácticos y sesiones desde el móvil. Guarda todo en un Google Sheet.

## Cómo está montada

| Parte | Dónde vive | Cómo se actualiza |
|---|---|---|
| `index.html` (la página del profesor) y `alumne.html` (la de los alumnos) | **GitHub Pages** | Automáticamente al subir cambios a la rama que publica GitHub Pages. |
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

## Autoevaluación y coevaluación

Desde Resultats, en una sesión ya exportada: bloque «Autoavaluació i coavaluació».

- El profesor activa autoevaluación y/o coevaluación (entre compañeros del mismo grupo) y elige el
  porcentaje de cada una. 0% = solo informativa.
- «Obrir i enviar correus»: cada alumno recibe un enlace a `alumne.html` y su **código personal**
  (columna «Codi alumne» de «👤 Llistat»). La página no recuerda el código, para que en un ordenador
  compartido nadie entre como otro. Tras 30 códigos incorrectos en 10 minutos se bloquea un rato.
- Nota final = profesor × (100 − auto − co)% + autoevaluación × auto% + media de los compañeros × co%.
  Si falta alguna parte, su peso se reparte proporcionalmente entre las que sí hay. Las notas puestas a
  mano («Manual») no se tocan. La nota del profesor, la de autoevaluación y la de coevaluación quedan en
  columnas separadas de «👥 Alumnat»; las respuestas, en «📝 Respostes alumnes».

## Pestañas del Sheet

| Pestaña | Contenido |
|---|---|
| 👤 Llistat | Alumnado. La columna "ID alumne" (el correo de Classroom) evita confundir a alumnos con el mismo nombre. El desdoblamiento de cada alumno se asigna en la app: Configurar → Desdoblaments ("General" = sin desdoblamiento; al evaluar "General" sale toda la clase). |
| 🔧 Configuració | Ítems de evaluación. Si "Supòsit" está vacío, el ítem vale para todo el módulo. Tipos: `numeric`, `sino`, `rubrica`. |
| 📋 Supòsits | Catálogo de supuestos por módulo (fecha, descripción, activo). |
| 👥 Alumnat | Una fila por alumno y sesión: nota final, grupo, origen de la nota (Calculada/Manual) y correo enviado. |
| 🔑 Avaluació alumnes | Sesiones con autoevaluación/coevaluación abiertas: porcentajes, si está abierta y el token del enlace. |
| 📝 Respostes alumnes | Respuestas de los alumnos (quién evalúa a quién, ítems, nota y comentario). |
| 💬 Comentaris | Comentarios rápidos que salen como botones al evaluar. |
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
