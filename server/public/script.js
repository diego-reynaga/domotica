const statusEl = document.getElementById('status');
const msgEl = document.getElementById('message');
const rbOn = document.getElementById('rbOn');
const rbOff = document.getElementById('rbOff');

function setRadiosEnabled(enabled) {
  rbOn.disabled = rbOff.disabled = !enabled ? true : false;
}

async function api(path, method = 'GET', body) {
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, body: json };
    return json;
  } catch (err) {
    throw err;
  }
}

async function updateStatus(preserveMsg = false) {
  try {
    const s = await api('/api/status');
    const connected = s.serialOpen;
    statusEl.textContent = connected ? `Conectado: ${s.portPath}` : 'No conectado al Arduino';
    setRadiosEnabled(connected);
    if (!connected && !preserveMsg) {
      msgEl.textContent = 'No hay conexión serial. Revisa el servidor o fija SERIAL_PORT.';
    }
  } catch (e) {
    statusEl.textContent = 'Error consultando estado';
    if (!preserveMsg) msgEl.textContent = 'Error de red al consultar /api/status';
    setRadiosEnabled(false);
  }
}

rbOn.addEventListener('change', async () => {
  if (!rbOn.checked) return;
  setRadiosEnabled(false);
  msgEl.textContent = 'Enviando OFF...';
  try {
    const r = await api('/api/led', 'POST', { action: 'OFF' });
    msgEl.textContent = `Arduino: ${r.arduino || JSON.stringify(r)}`;
    if (r.arduino && r.arduino.toUpperCase().includes('OK OFF')) {
      rbOn.checked = true;
      rbOff.checked = false;
    }
  } catch (err) {
    console.error(err);
    msgEl.textContent = `Error enviando OFF: ${err.body ? JSON.stringify(err.body) : err}`;
  } finally {
    setRadiosEnabled(true);
    await updateStatus(true);
  }
});

rbOff.addEventListener('change', async () => {
  if (!rbOff.checked) return;
  setRadiosEnabled(false);
  msgEl.textContent = 'Enviando ON...';
  try {
    const r = await api('/api/led', 'POST', { action: 'ON' });
    msgEl.textContent = `Arduino: ${r.arduino || JSON.stringify(r)}`;
    if (r.arduino && r.arduino.toUpperCase().includes('OK ON')) {
      rbOff.checked = true;
      rbOn.checked = false;
    }
  } catch (err) {
    console.error(err);
    msgEl.textContent = `Error enviando ON: ${err.body ? JSON.stringify(err.body) : err}`;
  } finally {
    setRadiosEnabled(true);
    await updateStatus(true);
  }
});

updateStatus();
setInterval(updateStatus, 3000);
