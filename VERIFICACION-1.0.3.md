# Verificación 1.0.3 — 31 de octubre de 2026

Entorno: Windows x64, Electron 45.0.0, Node 24.22.1 y npm 12.2.1. Rama `fix/windows-delivery`. Sin servicios externos, sin publicación y sin migración de la bóveda.

## Controles ejecutados

| Control | Resultado |
|---|---|
| Sintaxis de ocho módulos JS/CJS | Aprobado |
| `npm test` | 26/26; incluye diez controles de cotizaciones |
| Compilación NSIS y ZIP x64 completos | Aprobado; certificado no disponible, sin firma Authenticode |
| Arranque del ejecutable 1.0.3 empaquetado | Aprobado |
| Crear ingreso 321.45, cerrar y volver a abrir | Aprobado con datos aislados |
| Navegar nueve módulos | Aprobado, sin errores de página en el recorrido |
| Cuatro tipos de cotización mediante IPC y generación PDF real | Aprobado |
| Servicios: subtotal 200.50, descuento 20.05, impuesto 28.87, total 209.32 | Aprobado |
| Entradas inválidas, escape, recuperación de foco y bloqueo | Aprobado; bloquear vacía el borrador |
| Cancelar destino, error de disco y reintento | Aprobado |
| Doble solicitud simultánea y remitente IPC ajeno | Rechazados en pruebas automatizadas |
| Formulario a 1280, 900 y 720 píxeles | Sin desbordamiento horizontal |
| PDF de 28 conceptos y notas extensas | Tres páginas; revisadas todas tras renderizar con Poppler |
| Cuatro ejemplos PDF A4 | Revisados visualmente: tablas, condiciones, totales y numeración |
| Diálogo nativo Windows Guardar | Aprobado con destino aislado; archivo con cabecera PDF y confirmación en interfaz |

El primer intento de pruebas bajo sandbox denegó sockets locales (EACCES); la ejecución con permisos locales adecuados pasó completa. No se interpretó aquella denegación como defecto de la app. Los controles se ejecutaron sobre datos sintéticos; no se descifró ni alteró la bóveda real.

## Reproducción

`npm run dist:win -- --config.electronDist=node_modules/electron/dist` ejecuta sintaxis y pruebas antes de empaquetar. Luego `node scripts/packaged-smoke.cjs` y `node scripts/quotation-smoke.cjs`. Este último sustituye la elección del destino nativo durante la automatización, pero usa el IPC, renderizado y escritura reales. La prueba adicional `node scripts/quotation-native-smoke.cjs` espera que se seleccione manualmente un destino PDF aislado en el diálogo de Windows.

`MONEYMAXING_EXE` permite verificar otra ruta instalada; todos estos scripts aíslan `MONEYMAXING_DATA_DIR` y usan un puerto libre. No habilitar depuración sobre datos reales.

## Alcance y límites

La exportación usa un preload de API mínima, valida ventana/origen/marco/contenido en el proceso principal, escapa el texto y renderiza sin JavaScript ni acceso a red. El destino se obtiene del diálogo nativo y se escribe atómicamente. Las pruebas no sustituyen una auditoría externa de seguridad.

No se guardan borradores de cotización. No hay envío automático, tarifas en línea, firma del PDF, emisión de pólizas ni oferta bancaria. Hipoteca y retiro son simulaciones explícitas. Los archivos exportados son legibles, sin cifrado. No se cambió el sistema visual de 1.0.2.

No se dispuso de una VM limpia: la comprobación se realizó en este Windows. Para repetir en un equipo limpio: instalar NSIS, crear bóveda de prueba, registrar un movimiento, exportar los cuatro tipos de PDF, cerrar/reabrir y comprobar movimiento y lectura de PDFs. La instalación no requiere herramientas de desarrollo.

Referencias técnicas: [Electron printToPDF](https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions) y [validación del remitente IPC](https://www.electronjs.org/docs/latest/tutorial/security/#17-validate-the-sender-of-all-ipc-messages).
