# Controlar LED del Arduino desde una página web

Este proyecto permite encender y apagar el LED integrado del Arduino desde una página web que se sirve localmente por un servidor Node.js.

Resumen:
- `arduino/arduino_serial_led.ino` - Sketch para Arduino (UNO/Nano) que escucha comandos por Serial: `ON` / `OFF` (o `1` / `0`).
- `server/` - Servidor Node.js que sirve la web y envía comandos por puerto serie.
  - `server/server.js` - servidor Express + lógica para detectar/abrir puerto serie y exponer API.
  - `server/public/index.html` - interfaz web sencilla.
  - `server/public/script.js` - lógica front-end.
  - `server/package.json` - manifiesto para instalar dependencias.

Requisitos:
- Arduino UNO/Nano conectado por USB al PC (o cualquier Arduino que soporte Serial).
- Node.js (>=14) y npm en el PC.
- Instalar dependencias: desde `server` ejecutar `npm install`.

Pasos rápidos:
1. Abrir y cargar `arduino/arduino_serial_led.ino` en tu Arduino (velocidad 9600 bps).
2. En el PC, abrir una terminal en `c:\Users\THINKPAD\Desktop\arduino\server`.
3. Ejecutar `npm install`.
4. Exportar la variable de entorno `SERIAL_PORT` con el puerto (opcional). Si no la pones, el servidor intentará detectar automáticamente un puerto Arduino.
   - En Powershell: `$env:SERIAL_PORT = 'COM3'`
5. Ejecutar `node server.js`.
6. Abrir `http://localhost:3000` en el navegador y usar los botones para encender/apagar el LED.

Notas y alternativas:
- Si tienes un ESP8266/ESP32 y prefieres que el propio módulo sirva la página por Wi‑Fi, hay un ejemplo adicional `arduino/esp8266_web_led.ino`.
- Si el servidor no detecta el puerto, establece explícitamente `SERIAL_PORT` con el puerto que ve Windows (COMx).

Licencia: código de ejemplo, libre para modificar.
