// Sketch: arduino_serial_led.ino
// Función: escuchar por Serial los comandos 'ON' / 'OFF' o '1' / '0' y controlar un relé conectado al pin digital 8.

// Pin al que está conectado el IN del módulo relé
const int RELAY_PIN = 8;

// Muchos módulos relé son "active LOW" (es decir, LOW activa el relé).
// Si tu módulo es activo en HIGH, pon esto a false.
const bool RELAY_ACTIVE_LOW = true;

// Estado interno (true = encendido)
bool relayState = false;

// Escribe el nivel físico en el pin acorde a RELAY_ACTIVE_LOW
void writeRelay(bool on) {
  int level;
  if (RELAY_ACTIVE_LOW) {
    level = on ? LOW : HIGH; // ON -> LOW
  } else {
    level = on ? HIGH : LOW;  // ON -> HIGH
  }
  digitalWrite(RELAY_PIN, level);
  relayState = on;
}

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  // Asegurar estado inicial: apagado
  writeRelay(false);
  Serial.begin(9600);
  // Mensaje inicial para comprobar que Arduino arrancó
  Serial.println("READY");
}

void loop() {
  // Leemos hasta newline de forma robusta
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();
    // debug: mostrar exactamente lo recibido
    Serial.print("RX:");
    Serial.println(cmd);

    if (cmd == "ON" || cmd == "1") {
      writeRelay(true);
      Serial.println("OK ON");
    } else if (cmd == "OFF" || cmd == "0") {
      writeRelay(false);
      Serial.println("OK OFF");
    } else if (cmd.length() == 0) {
      // si llegó sólo un newline vacío, ignorar
    } else if (cmd == "STATUS") {
      Serial.print("STATE:");
      Serial.println(relayState ? "ON" : "OFF");
    } else {
      // respuesta de error indicando el contenido
      Serial.print("ERR:");
      Serial.println(cmd);
    }
  }
}
