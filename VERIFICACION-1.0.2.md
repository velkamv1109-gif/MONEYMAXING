# MONEYMAXING 1.0.2 — Interfaz sin recuadros

Entrega del 30 de octubre de 2026. Cambios visuales sobre la versión 1.0.1 previamente entregada.

## Qué cambió

Las superficies de tarjetas, navegación, botones, tablas, formularios, metas y diálogos son transparentes sobre el fondo uniforme de la aplicación. Se eliminaron bordes decorativos, sombras y esquinas redondeadas. Los deslizadores usan marcas lineales y los colores se eligen por nombre. Se conserva el foco visible de teclado. La ventana de Windows no se vuelve transparente hacia el escritorio.

Los diálogos usan el mismo fondo uniforme para impedir que el texto de la pantalla anterior interfiera. No cambiaron el formato de la bóveda, las fórmulas ni las dependencias.

## Verificación ejecutada

- Compilación Windows NSIS y ZIP completos, con comprobación de sintaxis y 16/16 pruebas automáticas aprobadas.
- Revisión de las nueve pantallas del ejecutable 1.0.2 con datos ficticios: superficies transparentes, sin marcos ni sombras; capturas revisadas.
- Nueve pantallas a 720, 900 y 1280 px sin desbordamiento horizontal de documento.
- Selección de acento accesible, deslizador con teclado, foco atrapado en formulario, Escape y retorno del foco aprobados.
- Capturas del acceso, formulario y temas oscuro/claro incluidas.
- Ejecutable empaquetado: creación de bóveda, movimiento de $321.45, guardado, cierre/reapertura y persistencia aprobados; navegación por nueve módulos sin errores JavaScript capturados.
- Se compararon los seis archivos de aplicación del `app.asar` con la fuente y se calcularon SHA-256 de los entregables.

Registros: `verificacion/compilacion.log`, `verificacion/interfaz.log` y `verificacion/paquete.log`. Las capturas contienen únicamente datos de prueba.

## Instalar

Respalda tu bóveda y ejecuta `MONEYMAXING-Setup-1.0.2.exe`. Para el portable, extrae **todo** `MONEYMAXING-1.0.2-Windows-x64.zip` y abre el EXE dentro de esa carpeta. No se instala automáticamente sobre tu aplicación original.

## Límites

El paquete sigue sin firma digital por falta de certificado. No se dispuso de una máquina limpia. La instalación/desinstalación completa se verificó para 1.0.1; para este cambio visual se recompiló y probó el ejecutable empaquetado, sin repetir la instalación. Se mantiene el resto de limitaciones descritas en README y en el registro histórico VERIFICACION.md. El arranque de desarrollo con Playwright no produjo ventana en esta sesión; la verificación visual se hizo sobre el paquete final.
