const statusEl = document.getElementById('status');
const msgEl = document.getElementById('message');
const btnOn = document.getElementById('btnOn');
const btnOff = document.getElementById('btnOff');
const pirStatusEl = document.getElementById('pirStatus');

function setButtonsEnabled(enabled) {
  btnOn.disabled = btnOff.disabled = !enabled;
}

function setButtonLoading(button, loading) {
  if (loading) {
    button.classList.add('loading');
  } else {
    button.classList.remove('loading');
  }
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
    statusEl.textContent = connected ? `✅ Conectado: ${s.portPath}` : '❌ No conectado al Arduino';
    setButtonsEnabled(connected);
    
    if (!connected && !preserveMsg) {
      msgEl.textContent = 'No hay conexión serial. Revisa el servidor o fija SERIAL_PORT.';
    }
    
    // Verificar estado del Arduino para mostrar PIR
    if (connected) {
      try {
        const statusResponse = await api('/api/led', 'POST', { action: 'STATUS' });
        const state = statusResponse.arduino || '';
        
        if (state.includes('PIR_ON')) {
          pirStatusEl.classList.add('active');
        } else {
          pirStatusEl.classList.remove('active');
        }
      } catch (e) {
        // Si falla la consulta de status, no mostrar error crítico
        console.warn('Error obteniendo estado:', e);
      }
    } else {
      pirStatusEl.classList.remove('active');
    }
  } catch (e) {
    statusEl.textContent = '⚠️ Error consultando estado';
    if (!preserveMsg) msgEl.textContent = 'Error de red al consultar /api/status';
    setButtonsEnabled(false);
    pirStatusEl.classList.remove('active');
  }
}

btnOn.addEventListener('click', async () => {
  setButtonsEnabled(false);
  setButtonLoading(btnOn, true);
  msgEl.textContent = 'Encendiendo luz...';
  
  try {
    const r = await api('/api/led', 'POST', { action: 'ON' });
    msgEl.textContent = `✅ ${r.arduino || 'Luz encendida'}`;
  } catch (err) {
    console.error(err);
    msgEl.textContent = `❌ Error: ${err.body ? JSON.stringify(err.body) : err}`;
  } finally {
    setButtonLoading(btnOn, false);
    setButtonsEnabled(true);
    await updateStatus(true);
  }
});

btnOff.addEventListener('click', async () => {
  setButtonsEnabled(false);
  setButtonLoading(btnOff, true);
  msgEl.textContent = 'Apagando luz...';
  
  try {
    const r = await api('/api/led', 'POST', { action: 'OFF' });
    msgEl.textContent = `✅ ${r.arduino || 'Luz apagada'}`;
  } catch (err) {
    console.error(err);
    msgEl.textContent = `❌ Error: ${err.body ? JSON.stringify(err.body) : err}`;
  } finally {
    setButtonLoading(btnOff, false);
    setButtonsEnabled(true);
    await updateStatus(true);
  }
});

// Inicializar
updateStatus();
setInterval(updateStatus, 3000);
