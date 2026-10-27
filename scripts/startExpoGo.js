/**
 * Starts Expo Go with BAWAAL_EXPO_GO=1 so Metro stubs Agora / real native bridges.
 * Always clears Metro cache so stale `require(moduleId)` transforms cannot linger.
 */
const { spawn } = require('child_process');

process.env.BAWAAL_EXPO_GO = '1';

const extraArgs = process.argv.slice(2);
const args = ['expo', 'start', '--clear', ...extraArgs];

const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    BAWAAL_EXPO_GO: '1',
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
