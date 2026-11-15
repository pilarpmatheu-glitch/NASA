# Calendarios NASA FIRMS

## Conexión actual con la interfaz

BRASA consulta `/api/dashboard` cada minuto. El servidor entrega históricos validados y conteos recientes del recolector. Los filtros originales se conservan. Los productos siguen separados en almacenamiento y en el detalle de la respuesta; la vista agrupa las detecciones por familia de sensor como resumen exploratorio. La mediana visible usa solamente los años con registros para cada fecha y muestra el número de años incluidos. El filtro de ambos sensores se aplica también a esa referencia. Es una estadística descriptiva parcial: excluir ausencias puede sesgarla y no acredita cobertura ni comparabilidad entre plataformas. Los colores usan los umbrales acordados (1, 2 y 4,5). Sin registros, la celda sigue gris; no se imputan ceros. El 29 de febrero sólo incluye años bisiestos. Reiniciar el servidor local o desplegar este cambio en Railway para habilitar la nueva ruta.

Servidor Node.js 24+, sin dependencias externas. BRASA conserva el diseño y los filtros originales. Consulta `/api/dashboard` para mostrar datos recientes e históricos agregados. El archivo `datos_cuyo_resumen.json` queda como referencia del prototipo anterior y no alimenta los calendarios actuales. No usa Groq.

## Ejecutar en Windows

Desde esta carpeta:

```powershell
npm.cmd start
```

Abrir http://localhost:3000. Detener con Ctrl+C. No abrir index.html directamente. En PowerShell se usa `npm.cmd` porque la política local bloquea `npm.ps1`; no hace falta cambiar esa política. En otras terminales puede usarse `npm`.

La clave existente se lee de `.env` como `FIRMS_MAP_KEY`; no hace falta copiarla. `.env.example` contiene solamente nombres de configuración. Las variables del entorno tienen prioridad. No se requiere `npm install`.

```powershell
npm.cmd test
npm.cmd run collect
```

`collect` realiza una actualización única y termina. No ejecutarlo simultáneamente con el servidor: el almacenamiento está diseñado para un único proceso escritor. `audit` permite revisar los CSV de la carpeta superior; el resumen de Cuyo que usa la web está en `cuyo-history.json`, generado con `import:cuyo` a partir del CSV validado. No modifica los originales.

## Recolección y almacenamiento

- Consulta al inicio y cada hora mientras el proceso esté activo. No necesita tener el navegador abierto. Cada producto se actualiza de forma independiente, sin ciclos simultáneos.
- Reconsulta hoy UTC y los cuatro días anteriores, conforme al máximo actual de la API Area. Retiene lo acumulado fuera de esa ventana. No recupera automáticamente interrupciones de más de cinco días ni correcciones posteriores: requieren una carga histórica revisada.
- Productos independientes: MODIS Terra+Aqua, VIIRS Suomi NPP, NOAA-20 y NOAA-21. No se suman sensores ni plataformas VIIRS.
- Identidad: producto, satélite, instrumento, fecha UTC, hora UTC y coordenadas numéricas exactas. Una repetición actualiza sus atributos; píxeles cercanos y pasadas distintas permanecen separados. No es un algoritmo de identificación de incendios. No se intenta fusionar revisiones con coordenadas cambiadas.
- Guarda `data/firms.json` mediante archivo temporal y renombrado antes de anunciar éxito. Un fallo de descarga, validación o escritura preserva el último estado persistido. Respuestas HTTP 200 de error también se rechazan al validar el CSV. No se imprime la URL que contiene la clave.
- Los resultados son acumulativos: no se eliminan detecciones previas por su ausencia en una respuesta posterior. Por eso son provisionales y no sustituyen archivos científicos revisados. Conviene respaldar el volumen y, al crecer, migrar a una base de datos.
- La API local devuelve agregados, última consulta y último éxito por producto. Se marca desactualizado después de dos horas sin éxito. El cliente relee el servidor cada minuto; el botón no consume consultas NASA adicionales.
- Ausencia de filas no certifica cobertura. Se muestra `—`, incluso cuando NASA respondió correctamente sin detecciones. Los CSV de focos no permiten demostrar que se observó todo el territorio, ni distinguir nubes, fallos de adquisición y ausencia real de anomalías. Los días con detecciones también pueden tener cobertura parcial.

## Geografía de Cuyo

La API utiliza un rectángulo amplio: oeste −70,8; sur −37,8; este −64,5; norte −28,2, en WGS84. Después aplica el polígono suministrado por el equipo en `JSON CUYO.txt`, convertido a `cuyo-boundary.json`. La línea tenía un punto aislado al final; se excluyó para cerrar el contorno, como indicaba el procesamiento previo. No son límites provinciales oficiales.

La comprobación contra los cuatro CSV originales reprodujo exactamente las 138.235 filas de `detecciones_cuyo_todos_los_sensores.csv`. También se filtran en el calendario los resultados conservados antes de recibir el polígono. La consulta reciente y la importación histórica usan ahora esa misma delimitación.

## Históricos y comparación

El calendario histórico usa `cuyo-history.json`, generado con `npm.cmd run import:cuyo -- "C:\ruta\detecciones_cuyo_todos_los_sensores.csv"`. Se conserva la separación SP/NRT. El CSV contiene 138.235 filas y 138.234 identidades únicas; la duplicación ya existe en el archivo NASA original. No se publica el CSV completo, sólo los agregados diarios y una huella para verificar el origen.

Hallazgos iniciales:

- MODIS original: 60.909 filas, 2016-01-01 a 2025-12-31, versiones `6.03` y `61.03`. El nombre del archivo no basta para asumir un producto homogéneo.
- Suomi identifica parte de los instrumentos como `SNPP`; la importación normaliza esa etiqueta a `VIIRS` sólo en ese archivo conocido. El original y su huella se preservan.
- Suomi: 223.172 filas, 223.171 identidades únicas, 2016–2025. NOAA-21 SP: 5.882 filas, enero–julio de 2026; NRT local: 4.457 filas, agosto–noviembre de 2026. NOAA-21 no proporciona en estos archivos una referencia de hace diez años.
- Los CSV recientes MODIS procesados tienen 32 y 31 filas; NOAA-21, 34 y 24. No se encontró documentación del filtro o de qué significa “sin repetidos”; no se adopta ese criterio como identidad de incendio.
- El Excel `focos_MODIS_armonizados.xlsx` tiene una hoja con líneas CSV en celdas, observaciones globales del 14 de noviembre de 2026 y coordenadas fuera de Argentina. No se importa como serie histórica de Cuyo.
- No hay manifiesto de cobertura diaria, polígonos ni código de preparación. La primera y última detección no demuestran continuidad de la serie.

La vista BRASA muestra la mediana de los años con registros en 2016–2025, con colores y el número de años incluidos por fecha. Es una referencia parcial: la falta de cobertura puede sesgarla. Los días sin registros quedan grises y no se convierten en cero. `/api/calendar` mantiene la referencia por producto y el promedio general sin calcular. NRT y SP no son directamente intercambiables. El CSV histórico contiene MODIS y Suomi NPP en 2016–2025, pero NOAA-21 solamente en 2026.

## Colores

Cantidad diaria UTC de detecciones recibidas y deduplicadas de forma exacta: verde hasta 1, amarillo más de 1 y hasta 2, naranja más de 2 y hasta 4,5, rojo más de 4,5. En la referencia histórica se aplica la misma escala a la mediana parcial. Son intervalos descriptivos fijos, no categorías científicas de riesgo. No miden FRP, superficie quemada ni incendios únicos. MODIS y VIIRS se agrupan sólo con fines exploratorios. Gris indica falta de valor; no equivale a cero.

## Preparado para alojar, sin publicar

Se incluyen Dockerfile y Compose con Node 24, usuario sin privilegios, verificación `/healthz`, volumen persistente y reinicio automático. El contexto Docker incluye el polígono y los agregados históricos; excluye claves, Git y CSV completos. Para probar con Docker instalado: `docker compose up --build -d`. Compose lee FIRMS_MAP_KEY del `.env` local; no incorpora el archivo a la imagen.

El proyecto está alojado en Railway. El proceso Node consulta cada hora mientras sigue activo; `FIRMS_MAP_KEY` debe estar configurada como secreto y `DATA_DIR=/app/data` debe apuntar a un volumen persistente. `cuyo-history.json` viaja con la imagen. Hay que monitorear el último éxito por producto: `/healthz` sólo indica que el proceso responde. Si Railway detiene el servicio o se agota el crédito gratuito, cesan las actualizaciones.

## Documentación oficial consultada

Consultada el 15 de noviembre de 2026:

- [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area): fuentes, coordenadas y ventanas de 1–5 días.
- [Disponibilidad de productos](https://firms.modaps.eosdis.nasa.gov/api/data_availability): disponibilidad general; no acredita cobertura diaria local.
- [Ejemplos oficiales](https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html).
- [README de descargas](https://firms.modaps.eosdis.nasa.gov/download/Readme.txt): diferencia NRT/SP, WGS84, limitaciones y atribución. Algunas notas antiguas de NOAA-21 en ese README no coinciden con el catálogo actual de Area; prevalecen el catálogo y los archivos inspeccionados.

Fuente de datos: NASA FIRMS / LANCE. Consultar las limitaciones de uso enlazadas desde la página.

## Verificación realizada

Pruebas Node de reconsulta, duplicados, separación de satélites, errores HTTP/CSV/red, preservación de datos, claves ausentes, resultados vacíos, fechas futuras, bisiestos y promedio no habilitado. Prueba HTTP con arranque real: carga desde disco, archivos públicos, parámetros inválidos y bloqueo de `.env`, `.git`, datos internos y código del servidor. Auditoría ejecutada sobre los diez CSV locales. Consulta real exitosa a los cuatro productos FIRMS con la clave local, sin imprimirla.

El entorno de ejecución restringido bloqueó las consultas externas; la prueba real funcionó con permiso de red. También se verificó que al volver a bloquear la red se conservaban los resultados. La inspección visual quedó pendiente porque la herramienta no tenía acceso autorizado a Chrome. No se probó la imagen Docker: Docker no está instalado. No se esperó una hora completa para comprobar el temporizador en tiempo real.
