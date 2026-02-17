import dns from 'dns';

/**
 * Fix para errores de resolución DNS (ECONNREFUSED) en entornos donde Node.js 
 * no hereda correctamente los servidores DNS del sistema y falla al intentar 
 * resolver registros SRV de MongoDB Atlas.
 */
try {
  const servers = dns.getServers();
  // Solo intervenimos si Node detecta únicamente un servidor DNS en localhost (127.0.0.1)
  if (servers.length === 1 && servers[0] === '127.0.0.1') {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
} catch (e) {
  // Silencioso, no queremos romper el arranque por un fix de red
}
