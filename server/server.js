const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const os = require('os');
// SerialPort API puede exportar de formas distintas según la versión; normalizamos aquí.
const SerialPortModule = require('serialport');
const { exec } = require('child_process');
let SerialPortList;
try {
  SerialPortList = require('@serialport/list');
} catch (e) {
  SerialPortList = SerialPortModule && SerialPortModule.list ? SerialPortModule.list : null; // fallback
}
let ReadlineParser;
try {
  ReadlineParser = require('@serialport/parser-readline');
  // normalize default export
  if (ReadlineParser && ReadlineParser.default) ReadlineParser = ReadlineParser.default;
} catch (e) {
  ReadlineParser = SerialPortModule && SerialPortModule.parsers && SerialPortModule.parsers.Readline ? SerialPortModule.parsers.Readline : null;
}
// resolver constructor/clase SerialPort según export
let SerialPortCtor = null;
if (typeof SerialPortModule === 'function') {
  SerialPortCtor = SerialPortModule;
} else if (SerialPortModule && (SerialPortModule.SerialPort || SerialPortModule.default)) {
  SerialPortCtor = SerialPortModule.SerialPort || SerialPortModule.default;
} else {
  SerialPortCtor = SerialPortModule;
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
let port; // instancia SerialPort
let portPath = process.env.SERIAL_PORT || null;
let writer;
let pendingResponse = false;

function writeAndWait(cmd, timeout = 1500) {
  return new Promise((resolve, reject) => {
    if (!port || !port.isOpen) return reject(new Error('Puerto serie no abierto'));
    if (pendingResponse) return reject(new Error('Puerto ocupado, intenta de nuevo')); // simple mutex
    pendingResponse = true;
    let buffer = '';
    const onData = (data) => {
      buffer += data.toString();
      if (buffer.indexOf('\n') >= 0) {
        const line = buffer.split(/\r?\n/)[0].trim();
        port.removeListener('data', onData);
        pendingResponse = false;
        clearTimeout(to);
        resolve(line);
      }
    };

    // Primero vaciar buffers pendientes para evitar lecturas antiguas
    port.flush(flushErr => {
      if (flushErr) console.warn('Warning: flush error', flushErr && flushErr.message);

      // attach listener
      port.on('data', onData);

      // write command (log buffer en hex para diagnosticar)
      const buf = Buffer.from(cmd + '\n', 'utf8');
      console.log('Escribiendo al serial (hex):', buf.toString('hex'), 'text:', cmd + '\n');
      port.write(buf, err => {
        if (err) {
          port.removeListener('data', onData);
          pendingResponse = false;
          clearTimeout(to);
          return reject(err);
        }
      });
    });

    // timeout
    const to = setTimeout(() => {
      try { port.removeListener('data', onData); } catch (e) {}
      pendingResponse = false;
      reject(new Error('timeout'));
    }, timeout);
  });
}

async function listAndOpenPort() {
  let ports = await (SerialPortList && SerialPortList.list ? SerialPortList.list() : (SerialPortModule && SerialPortModule.list ? SerialPortModule.list() : []));
  console.log('Puertos serie detectados (api):', (ports || []).map(p => p.path || p.comName || p.device));

  // Si la API no devuelve puertos en Windows, intentar fallback usando PowerShell
  if ((!ports || ports.length === 0) && process.platform === 'win32') {
    console.log('No se detectaron puertos con la API; intentando fallback PowerShell para listar COMs...');
    try {
      ports = await new Promise((resolve, reject) => {
        // Ejecuta PowerShell y recoge los nombres de puerto
        exec('powershell -NoProfile -Command "[System.IO.Ports.SerialPort]::GetPortNames()"', { windowsHide: true }, (err, stdout, stderr) => {
          if (err) return reject(err);
          const lines = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          const out = lines.map(p => ({ path: p }));
          resolve(out);
        });
      });
      console.log('Puertos serie detectados (powershell):', ports.map(p => p.path));
    } catch (psErr) {
      console.error('Fallback PowerShell falló:', psErr.message || psErr);
    }
  }

  if (portPath) {
    // intentar abrir el especificado (soporta COM3 o \\.\\COM3)
    const p = (ports || []).find(pp => {
      const candidate = (pp.path || pp.comName || pp.device || '').toString();
      return candidate === portPath || candidate.endsWith(portPath) || portPath.endsWith(candidate);
    });
    if (!p) throw new Error(`No se encontró el puerto especificado: ${portPath}`);
    return openPort(p.path || p.comName || p.device);
  }

  // Si sólo hay uno, usarlo
  if (ports.length === 1) {
    return openPort(ports[0].path);
  }

  // Si hay varios, intentar adivinar por fabricante/ven/pid
  const arduinoLike = ports.find(p => {
    const info = `${p.manufacturer || ''} ${p.vendorId || ''} ${p.productId || ''}`.toLowerCase();
    return info.includes('arduino') || info.includes('usb') || info.includes('ch340') || info.includes('ftdi');
  });
  if (arduinoLike) return openPort(arduinoLike.path);

  // fallback: usar el primero
  if (ports.length > 0) return openPort(ports[0].path);

  throw new Error('No se encontraron puertos serie');
}

function openPort(pathStr) {
  console.log('Abriendo puerto serie en', pathStr);
  // Construir la instancia usando la firma soportada por la versión instalada
  if (!SerialPortCtor) {
    throw new Error('No se pudo resolver el constructor de SerialPort');
  }

  try {
    // Intento API moderna: new SerialPort({ path, baudRate })
    port = new SerialPortCtor({ path: pathStr, baudRate: 9600, autoOpen: false });
  } catch (e1) {
    try {
      // Intento API clásica: new SerialPort(path, options)
      port = new SerialPortCtor(pathStr, { baudRate: 9600, autoOpen: false });
    } catch (e2) {
      console.error('Fallo al crear instancia SerialPort (intentos modernos y clásicos):', e2.message || e2);
      throw e2;
    }
  }

  // configurar parser readline según la versión instalada
  if (ReadlineParser && (typeof ReadlineParser === 'function' || typeof ReadlineParser === 'object')) {
    try {
      const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
      parser.on('data', data => console.log('Desde Arduino:', data));
    } catch (parserErr) {
      console.warn('ReadlineParser no es constructible, intentando parser integrado...', parserErr && parserErr.message);
      if (SerialPortModule && SerialPortModule.parsers && SerialPortModule.parsers.Readline) {
        const Readline = SerialPortModule.parsers.Readline;
        const p = new Readline({ delimiter: '\r\n' });
        port.pipe(p);
        p.on('data', data => console.log('Desde Arduino:', data));
      } else {
        port.on('data', data => console.log('Desde Arduino (raw):', data.toString()));
      }
    }
  } else if (SerialPortModule && SerialPortModule.parsers && SerialPortModule.parsers.Readline) {
    const Readline = SerialPortModule.parsers.Readline;
    const p = new Readline({ delimiter: '\r\n' });
    port.pipe(p);
    p.on('data', data => console.log('Desde Arduino:', data));
  } else {
    // fallback: leer raw
    port.on('data', data => {
      try {
        const txt = data.toString();
        const hx = Buffer.from(data).toString('hex');
        console.log('Desde Arduino (raw):', txt);
        console.log('Desde Arduino (hex):', hx);
      } catch (e) {
        console.log('Desde Arduino (raw):', data.toString());
      }
    });
  }

  return new Promise((resolve, reject) => {
    port.open(err => {
      if (err) return reject(err);
      writer = port; // usamos port.write
      // darle un momento al Arduino para reiniciar
      setTimeout(() => resolve(), 1000);
    });
  });
}

app.post('/api/led', async (req, res) => {
  const action = (req.body.action || '').toString().toUpperCase();
  if (!writer || !port || !port.isOpen) return res.status(500).json({ error: 'Puerto serie no abierto' });
  if (action !== 'ON' && action !== 'OFF' && action !== 'STATUS') return res.status(400).json({ error: 'Action debe ser ON, OFF o STATUS' });

  const cmd = action === 'STATUS' ? 'STATUS' : (action === 'ON' ? 'ON' : 'OFF');
  console.log(`API /api/led -> enviar: ${cmd}`);
  try {
    const resp = await writeAndWait(cmd, 2000);
    // devolver la respuesta recibida del Arduino
    return res.json({ result: 'sent', cmd, arduino: resp });
  } catch (err) {
    console.error('Error al escribir/esperar respuesta:', err.message || err);
    return res.status(500).json({ error: 'Error enviando al serial o timeout', details: err.message || err });
  }
});

// Endpoint de debug para probar envío crudo
app.post('/api/send-debug', (req, res) => {
  const payload = req.body.payload || '';
  if (!writer || !port || !port.isOpen) return res.status(500).json({ error: 'Puerto serie no abierto' });
  console.log('API /api/send-debug ->', payload);
  writer.write(payload + '\n', err => {
    if (err) return res.status(500).json({ error: 'Error enviando', details: err.message });
    res.json({ result: 'sent', payload });
  });
});

app.get('/api/status', (req, res) => {
  res.json({ serialOpen: !!writer, portPath: port ? port.path : null });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Servidor web escuchando en http://localhost:${PORT}`);
  // Mostrar las IPs LAN para acceso desde otros dispositivos
  const nets = os.networkInterfaces();
  Object.values(nets).forEach(list => {
    (list || []).forEach(i => {
      if (i.family === 'IPv4' && !i.internal) {
        console.log(`Acceso LAN: http://${i.address}:${PORT}`);
      }
    });
  });
  try {
    await listAndOpenPort();
    console.log('Puerto serie abierto correctamente');
  } catch (err) {
    console.error('No se pudo abrir el puerto serie:', err.message);
    console.log('Puedes definir SERIAL_PORT en el entorno (ej. COM3) o conectar el Arduino y reiniciar el servidor.');
  }
});
