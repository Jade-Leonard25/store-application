import { spawn } from 'node:child_process';
import electron from 'electron';

// When running inside VS Code, Antigravity, or other Electron-based IDEs,
// ELECTRON_RUN_AS_NODE is often inherited in terminal sessions.
// We delete it so Electron boots into its desktop runtime rather than Node.js mode.
delete process.env.ELECTRON_RUN_AS_NODE;

const args = ['.', ...process.argv.slice(2)];

// Linux containers and sandboxes without unprivileged user namespaces require --no-sandbox
if (process.platform === 'linux' && !args.includes('--no-sandbox')) {
  args.push('--no-sandbox');
}

const child = spawn(electron, args, { stdio: 'inherit' });

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

