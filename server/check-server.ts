import http from 'http';

const ports = [3001, 3002, 3003];
const paths = ['/', '/api/test', '/api/notifications', '/test'];

console.log('Verifica dei server in esecuzione...');

for (const port of ports) {
  console.log(`\nControllo porta ${port}:`);
  
  for (const path of paths) {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      console.log(`${path} - Stato: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (data.length < 100) {
          console.log(`Risposta: ${data}`);
        } else {
          console.log(`Risposta: ${data.substring(0, 100)}...`);
        }
      });
    });

    req.on('error', (e) => {
      console.log(`${path} - Errore: ${e.message}`);
    });

    req.on('timeout', () => {
      console.log(`${path} - Timeout`);
      req.destroy();
    });

    req.end();
  }
}