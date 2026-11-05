const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const androidDir = path.join(rootDir, 'android');
  const outputApk = path.join(rootDir, 'frontend/public/downloads/AssistFlow-AI.apk');

  console.log('--- Step 1: Building Android Release APK ---');
  const env = {
    ...process.env,
    JAVA_HOME: process.env.JAVA_HOME || '/home/newowner/.bubblewrap/jdk/jdk-17.0.11+9',
    ANDROID_HOME: process.env.ANDROID_HOME || '/home/newowner/.bubblewrap/android_sdk',
    PATH: `${process.env.JAVA_HOME || '/home/newowner/.bubblewrap/jdk/jdk-17.0.11+9'}/bin:${process.env.PATH}`
  };

  // Ensure local.properties
  fs.writeFileSync(
    path.join(androidDir, 'local.properties'),
    `sdk.dir=${env.ANDROID_HOME}\n`
  );

  const gradleResult = spawnSync('./gradlew', ['assembleRelease'], {
    cwd: androidDir,
    env,
    stdio: 'inherit'
  });

  if (gradleResult.status !== 0) {
    throw new Error(`Gradle build failed with code ${gradleResult.status}`);
  }

  const builtApk = path.join(androidDir, 'app/build/outputs/apk/release/app-release.apk');
  console.log('Built APK at:', builtApk);

  console.log('--- Step 2: Signing APK with apksigner (v1, v2, v3) ---');
  fs.mkdirSync(path.dirname(outputApk), { recursive: true });

  const apksigner = `${env.ANDROID_HOME}/build-tools/35.0.0/apksigner`;
  const keystorePath = '/tmp/android.keystore';

  spawnSync(apksigner, [
    'sign',
    '--ks', keystorePath,
    '--ks-key-alias', 'assistflow',
    '--ks-pass', 'pass:assistflow123',
    '--key-pass', 'pass:assistflow123',
    '--v1-signing-enabled', 'true',
    '--v2-signing-enabled', 'true',
    '--v3-signing-enabled', 'true',
    '--out', outputApk,
    builtApk
  ], { env, stdio: 'inherit' });

  console.log('--- Step 3: Verifying Signature ---');
  spawnSync(apksigner, ['verify', '--verbose', outputApk], { env, stdio: 'inherit' });

  const stats = fs.statSync(outputApk);
  console.log(`\n🎉 Verified & ready: ${outputApk} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
