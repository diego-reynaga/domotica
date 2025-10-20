// Sketch: arduino_serial_led.ino
// Función: escuchar por Serial los comandos 'ON' / 'OFF' o '1' / '0' y controlar el LED integrado.

const int LED_PIN = LED_BUILTIN; // suele ser 13 en muchas placas

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
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
      digitalWrite(LED_PIN, HIGH);
      Serial.println("OK ON");
    } else if (cmd == "OFF" || cmd == "0") {
      digitalWrite(LED_PIN, LOW);
      Serial.println("OK OFF");
    } else if (cmd.length() == 0) {
      // si llegó sólo un newline vacío, ignorar
    } else {
      // respuesta de error indicando el contenido
      Serial.print("ERR:");
      Serial.println(cmd);
    }
  }
}
