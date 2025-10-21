// Sketch: arduino_serial_led.ino
// Función: escuchar por Serial los comandos 'ON' / 'OFF' o '1' / '0' y controlar un relé conectado al pin digital 8.
//          Además soporta un sensor PIR en D9 que, al detectar movimiento, enciende la luz y la mantiene
//          encendida (latch) hasta que se reciba 'OFF' desde la web.

// Pin al que está conectado el IN del módulo relé
const int RELAY_PIN = 8;
// Pin del sensor PIR (señal)
const int PIR_PIN = 9;
// Si tu sensor PIR saca HIGH cuando detecta movimiento, deja true.
// Algunos módulos (o cableados) devuelven LOW cuando detectan; en ese caso pon false.
const bool PIR_ACTIVE_HIGH = true;

// Muchos módulos relé son "active LOW" (es decir, LOW activa el relé).
// Si tu módulo es activo en HIGH, pon esto a false.
const bool RELAY_ACTIVE_LOW = false;

// Estado físico actual del relé (true = ON lógico)
bool outputState = false;

// Si PIR detecta movimiento ponemos este latch a true y la luz se mantiene encendida
// hasta que la web envíe OFF (o se resetee el Arduino).
bool pirLatched = false;

// Debounce/estabilidad para el PIR
const unsigned long PIR_DEBOUNCE_MS = 150; // requiere que la señal se mantenga estable X ms
int lastPirReading = LOW;
unsigned long lastPirChangeMillis = 0;
// Warmup: algunos sensores PIR necesitan tiempo tras alimentación para estabilizarse
const unsigned long PIR_WARMUP_MS = 30000; // 30 segundos
unsigned long bootMillis = 0;

// Escribe el nivel físico en el pin acorde a RELAY_ACTIVE_LOW
void writeRelay(bool on) {
  int level;
  if (RELAY_ACTIVE_LOW) {
    level = on ? LOW : HIGH; // ON -> LOW
  } else {
    level = on ? HIGH : LOW;  // ON -> HIGH
  }
  digitalWrite(RELAY_PIN, level);
  outputState = on;
}

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(PIR_PIN, INPUT);
  // Asegurar estado inicial: apagado
  writeRelay(false);
  Serial.begin(9600);
  // Mensaje inicial para comprobar que Arduino arrancó
  Serial.println("READY");
  bootMillis = millis();
}

void loop() {
  unsigned long now = millis();
  // Leer PIR y aplicar pequeña ventana de estabilidad para evitar falsos positivos
  int rawPirVal = digitalRead(PIR_PIN);
  int pirVal = PIR_ACTIVE_HIGH ? rawPirVal : (rawPirVal == HIGH ? LOW : HIGH);
  if (pirVal != lastPirReading) {
    lastPirChangeMillis = now;
    lastPirReading = pirVal;
    Serial.print("PIR_CHANGE:"); Serial.println(pirVal);
  }
  // Si la señal lleva estable más tiempo que PIR_DEBOUNCE_MS y está en HIGH
  if (lastPirReading == HIGH && !pirLatched && (now - lastPirChangeMillis) >= PIR_DEBOUNCE_MS) {
    // Ignorar disparos durante el periodo de warmup
    if ((now - bootMillis) < PIR_WARMUP_MS) {
      Serial.println("PIR:IGNORED_WARMUP");
    } else {
    // activar latch: permanecer encendido hasta OFF por la web
    pirLatched = true;
    writeRelay(true);
    Serial.println("PIR:TRIGGERED");
    }
  }

  // Leemos hasta newline de forma robusta
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();
    // debug: mostrar exactamente lo recibido
    Serial.print("RX:");
    Serial.println(cmd);

    if (cmd == "ON" || cmd == "1") {
      // ON desde la web: encender (no limpiamos el latch PIR, OFF debe limpiar)
      writeRelay(true);
      Serial.println("OK ON");
    } else if (cmd == "OFF" || cmd == "0") {
      // OFF desde la web: desactivar latch PIR y apagar
      pirLatched = false;
      writeRelay(false);
      Serial.println("OK OFF");
    } else if (cmd.length() == 0) {
      // si llegó sólo un newline vacío, ignorar
    } else if (cmd == "STATUS") {
      Serial.print("STATE:");
      if (pirLatched) Serial.println("PIR_ON");
      else Serial.println(outputState ? "ON" : "OFF");
    } else {
      // respuesta de error indicando el contenido
      Serial.print("ERR:");
      Serial.println(cmd);
    }
  }
}
