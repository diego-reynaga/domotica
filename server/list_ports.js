// Script para listar puertos serie usando @serialport/list si está disponible
(async () => {
  try {
    let list;
    try {
      const spList = require('@serialport/list');
      if (spList && spList.list) {
        list = await spList.list();
      }
    } catch (e) {
      // fallback
      const SerialPort = require('serialport');
      if (SerialPort && SerialPort.list) {
        list = await SerialPort.list();
      }
    }

    if (!list) {
      console.error('No se pudo obtener la lista de puertos. Asegúrate de tener instaladas las dependencias.');
      process.exit(1);
    }

    console.log('Puertos serie detectados:');
    list.forEach(p => {
      console.log('- ' + (p.path || p.comName || p.device || 'unknown') + '  | manufacturer=' + (p.manufacturer || '') + ' | vendorId=' + (p.vendorId || '') + ' | productId=' + (p.productId || ''));
    });
  } catch (err) {
    console.error('Error listando puertos:', err.message || err);
    process.exit(1);
  }
})();
