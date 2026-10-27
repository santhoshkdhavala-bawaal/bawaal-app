/**
 * Starts Expo Go with BAWAAL_EXPO_GO=1 so Metro stubs Agora / real native bridges.
 */
const { spawn } = require('child_process');

process.env.BAWAAL_EXPO_GO = '1';

const child = spawn(
  'npx',
  ['expo', 'start', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
