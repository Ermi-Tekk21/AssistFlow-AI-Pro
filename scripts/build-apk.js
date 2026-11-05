const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const bubblewrapCorePath = '/home/newowner/.npm/_npx/881cef4662d2c421/node_modules/@bubblewrap/core';
const { TwaGenerator, TwaManifest, ConsoleLog } = require(bubblewrapCorePath);

async function main() {
  console.log('--- Step 1: Starting local server for assets ---');
  const publicDir = path.resolve(__dirname, '../frontend/public');
  const server = http.createServer((req, res) => {
    let filePath = path.join(publicDir, req.url.split('?')[0]);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.png': 'image/png',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(8888, '127.0.0.1', resolve));
  console.log('Asset server running on http://127.0.0.1:8888');

  try {
    const projectDir = '/tmp/twa-project';
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    fs.mkdirSync(projectDir, { recursive: true });

    // Generate or ensure Keystore exists
    const keystorePath = path.resolve(__dirname, '../android.keystore');
    if (!fs.existsSync(keystorePath)) {
      console.log('--- Generating Android Release Keystore ---');
      spawnSync('/home/newowner/.bubblewrap/jdk/jdk-17.0.11+9/bin/keytool', [
        '-genkeypair', '-v',
        '-keystore', keystorePath,
        '-alias', 'assistflow',
        '-keyalg', 'RSA',
        '-keysize', '2048',
        '-validity', '10000',
        '-storepass', 'assistflow123',
        '-keypass', 'assistflow123',
        '-dname', 'CN=AssistFlow, OU=AI, O=AssistFlow, L=San Francisco, ST=CA, C=US'
      ], { stdio: 'inherit' });
    }

    console.log('--- Step 2: Creating TWA Manifest ---');
    const twaManifest = new TwaManifest({
      packageId: 'com.assistflow.ai',
      host: 'assistflow-web.onrender.com',
      name: 'AssistFlow AI',
      launcherName: 'AssistFlow',
      display: 'standalone',
      themeColor: '#080E1E',
      themeColorDark: '#080E1E',
      navigationColor: '#080E1E',
      navigationColorDark: '#080E1E',
      navigationDividerColor: '#00000000',
      navigationDividerColorDark: '#00000000',
      backgroundColor: '#080E1E',
      enableNotifications: true,
      startUrl: '/',
      iconUrl: 'http://127.0.0.1:8888/icons/icon-512.png',
      maskableIconUrl: 'http://127.0.0.1:8888/icons/icon-maskable-512.png',
      splashScreenFadeOutDuration: 300,
      signingKey: {
        path: keystorePath,
        alias: 'assistflow'
      },
      appVersion: '1.0.0',
      appVersionCode: 1,
      shortcuts: [],
      generatorApp: 'bubblewrap-cli',
      webManifestUrl: 'http://127.0.0.1:8888/manifest.json',
      fallbackType: 'customtabs',
      features: {},
      alphaDependencies: { enabled: false },
      enableSiteSettingsShortcut: true,
      isChromeOSOnly: false,
      isMetaQuest: false,
      minSdkVersion: 24,
      orientation: 'portrait'
    });

    console.log('--- Step 3: Generating TWA Project Structure ---');
    const log = new ConsoleLog('twa');
    const generator = new TwaGenerator();
    await generator.createTwaProject(projectDir, twaManifest, log);

    // Patch build.gradle
    const buildGradlePath = path.join(projectDir, 'app/build.gradle');
    let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
    buildGradle = buildGradle.replace(/compileSdkVersion 36/g, 'compileSdkVersion 34');
    buildGradle = buildGradle.replace(/targetSdkVersion 36/g, 'targetSdkVersion 34');
    buildGradle = buildGradle.replace(/minSdkVersion 21/g, 'minSdkVersion 24');

    buildGradle += `
tasks.withType(com.android.build.gradle.internal.tasks.CheckAarMetadataTask).configureEach {
    enabled = false
}
`;
    fs.writeFileSync(buildGradlePath, buildGradle);

    // Clean package attr from AndroidManifest if present
    const manifestPath = path.join(projectDir, 'app/src/main/AndroidManifest.xml');
    let manifestContent = fs.readFileSync(manifestPath, 'utf8');
    manifestContent = manifestContent.replace('package="com.assistflow.ai"', '');
    fs.writeFileSync(manifestPath, manifestContent);

    // Create local.properties with sdk.dir
    fs.writeFileSync(
      path.join(projectDir, 'local.properties'),
      'sdk.dir=/home/newowner/.bubblewrap/android_sdk\n'
    );

    console.log('--- Step 4: Compiling Release APK with Gradle ---');
    const env = {
      ...process.env,
      JAVA_HOME: '/home/newowner/.bubblewrap/jdk/jdk-17.0.11+9',
      ANDROID_HOME: '/home/newowner/.bubblewrap/android_sdk',
      PATH: `/home/newowner/.bubblewrap/jdk/jdk-17.0.11+9/bin:${process.env.PATH}`
    };

    const gradleResult = spawnSync('./gradlew', ['assembleRelease'], {
      cwd: projectDir,
      env,
      stdio: 'inherit'
    });

    if (gradleResult.status !== 0) {
      throw new Error(`Gradle build failed with status ${gradleResult.status}`);
    }

    console.log('--- Step 5: Signing APK with apksigner (v2/v3) ---');
    const unsignedApk = path.join(projectDir, 'app/build/outputs/apk/release/app-release-unsigned.apk');
    const defaultApk = path.join(projectDir, 'app/build/outputs/apk/release/app-release.apk');
    const inputApk = fs.existsSync(unsignedApk) ? unsignedApk : defaultApk;
    const outputApk = path.resolve(__dirname, '../frontend/public/downloads/AssistFlow-AI.apk');

    fs.mkdirSync(path.dirname(outputApk), { recursive: true });

    spawnSync('/home/newowner/.bubblewrap/android_sdk/build-tools/35.0.0/apksigner', [
      'sign',
      '--ks', keystorePath,
      '--ks-key-alias', 'assistflow',
      '--ks-pass', 'pass:assistflow123',
      '--key-pass', 'pass:assistflow123',
      '--out', outputApk,
      inputApk
    ], { env, stdio: 'inherit' });

    console.log('--- Step 6: Verifying Signed APK ---');
    spawnSync('/home/newowner/.bubblewrap/android_sdk/build-tools/35.0.0/apksigner', [
      'verify',
      '--verbose',
      outputApk
    ], { env, stdio: 'inherit' });

    const stats = fs.statSync(outputApk);
    console.log(`\n🎉 Success! APK created at ${outputApk} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

  } finally {
    server.close();
  }
}

main().catch(err => {
  console.error('Error building APK:', err);
  process.exit(1);
});
