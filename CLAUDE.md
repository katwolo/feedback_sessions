# Instrucciones para Claude

- Responde en español (el código y los textos de la app están en catalán; mantenlo así).
- Al terminar cualquier cambio, incluye SIEMPRE dos apartados en tu respuesta:
  1. **Lo que tienes que hacer tú**: pasos manuales numerados (copiar archivos al editor de Apps Script,
     ejecutar funciones como `configurarRegistre` o `autoritzarTot`, crear una nueva versión de la
     implementación, permisos, etc.). Si no hay nada que hacer, dilo explícitamente.
  2. **Archivos modificados**: cada archivo tocado y qué ha cambiado en él.
- Publicar `index.html` lo hace Claude sin preguntar: al terminar un cambio del frontend, fusionarlo en la
  rama principal (`claude/teacher-evaluation-code-gs-3mkzol`, la que publica GitHub Pages) mediante un PR
  que Claude crea y fusiona. Antes de fusionar, las pruebas deben pasar. El usuario no tiene que tocar nada
  de `index.html`. Si el cambio del frontend necesita un `code.gs` nuevo, avisarlo claramente.
- Despliegue: `index.html` está en GitHub Pages y se publica solo al llegar a la rama que publica Pages.
  `code.gs` y `appsscript.json` viven en Apps Script: no llegan a la app hasta que se copian al editor y
  se crea una nueva versión de la implementación (siempre editando la existente, para no cambiar la URL `/exec`).
