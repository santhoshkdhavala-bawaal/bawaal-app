/**
 * Starts the Expo dev-client packager with real native modules enabled.
 * Sets BAWAAL_DEV_CLIENT=1 so Metro resolves expo-av / Agora for native builds.
 */
const { spawn } = require('child_process');

process.env.BAWAAL_DEV_CLIENT = '1';
// Ensure Expo Go stub flag cannot leak into a native session.
delete process.env.BAWAAL_EXPO_GO;

const extraArgs = process.argv.slice(2);
const args = ['expo', 'start', '--dev-client', ...extraArgs];

const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    BAWAAL_DEV_CLIENT: '1',
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
