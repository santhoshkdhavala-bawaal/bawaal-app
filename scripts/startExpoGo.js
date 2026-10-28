/**
 * Starts Expo Go with BAWAAL_EXPO_GO=1 so Metro stubs:
 *   - expo-av (ExponentAV) → black Video placeholder
 *   - react-native-agora
 *   - safeNative / realNativeModules bridges
 * Always clears Metro cache so stale transforms cannot linger.
 */
const { spawn } = require('child_process');

const env = { ...process.env, BAWAAL_EXPO_GO: '1' };
delete env.BAWAAL_DEV_CLIENT;
delete env.BAWAAL_USE_NATIVE_AV;

const extraArgs = process.argv.slice(2);
const args = ['expo', 'start', '--clear', ...extraArgs];

const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
