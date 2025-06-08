#!/usr/bin/env node

/**
 * Quick runtime test for the plugin
 * Tests that the DevTools endpoint is actually served
 */

import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testDevToolsEndpoint(port = 3000) {
  const maxRetries = 10;
  const retryDelay = 2000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/__devtools_json`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ DevTools endpoint responding');
        console.log('📄 Response:', JSON.stringify(data, null, 2));
        return true;
      }
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error('❌ DevTools endpoint not responding after retries');
        return false;
      }
      console.log(`⏳ Waiting for dev server... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  return false;
}

async function createQuickTest() {
  const testDir = path.join('/tmp', `quick-test-${Date.now()}`);
  await fs.promises.mkdir(testDir, { recursive: true });
  
  console.log('🧪 Creating quick test project...');
  
  // Create minimal Next.js project
  const packageJson = {
    name: 'quick-test',
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build'
    },
    dependencies: {
      next: '^14.2.5',
      react: '^18.0.0',
      'react-dom': '^18.0.0'
    }
  };
  
  await fs.promises.writeFile(
    path.join(testDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create both pages and app directories for compatibility
  await fs.promises.mkdir(path.join(testDir, 'pages'), { recursive: true });
  await fs.promises.writeFile(
    path.join(testDir, 'pages', 'index.js'),
    `export default function Home() {
      return <div><h1>DevTools Test</h1></div>;
    }`
  );
  
  // Add _app.js to pages to reduce warnings
  await fs.promises.writeFile(
    path.join(testDir, 'pages', '_app.js'),
    `export default function App({ Component, pageProps }) {
      return <Component {...pageProps} />;
    }`
  );
  
  // Create pages/api directory to satisfy Next.js expectations
  await fs.promises.mkdir(path.join(testDir, 'pages', 'api'), { recursive: true });
  
  // Also create app directory for Next.js 13+ compatibility
  await fs.promises.mkdir(path.join(testDir, 'app'), { recursive: true });
  await fs.promises.writeFile(
    path.join(testDir, 'app', 'page.js'),
    `export default function Page() {
      return <div><h1>DevTools Test (App Router)</h1></div>;
    }`
  );
  
  console.log('📦 Installing dependencies...');
  await execAsync('npm install', { cwd: testDir });
  
  console.log('🔧 Setting up plugin (using local build)...');
  
  // Install our plugin from the local directory
  const localPluginPath = path.resolve(process.cwd());
  await execAsync(`npm install "${localPluginPath}" --save-dev`, { cwd: testDir });
  
  const setupScript = path.join(testDir, 'node_modules/next-plugin-devtools-json/bin/setup.js');
  await execAsync(`node "${setupScript}"`, { cwd: testDir });
  
  console.log('🚀 Starting dev server...');
  const devServer = spawn('npm', ['run', 'dev'], { 
    cwd: testDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  let serverOutput = '';
  devServer.stdout.on('data', (data) => {
    const output = data.toString();
    serverOutput += output;
    // Only log important lines, filter out noise
    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.includes('DevTools JSON server') || 
          line.includes('Next.js') || 
          line.includes('Local:') || 
          line.includes('Ready in') ||
          line.includes('Generated UUID')) {
        console.log('📝', line);
      }
    }
  });
  
  devServer.stderr.on('data', (data) => {
    const output = data.toString();
    // Filter out known harmless warnings
    if (!output.includes('ENOENT') && 
        !output.includes('unhandledRejection') &&
        !output.includes('webpack.cache.PackFileCacheStrategy') &&
        !output.includes('DEP0060')) {
      console.log('⚠️', output.trim());
    }
  });
  
  // Wait for server to start
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server startup timeout'));
    }, 30000); // 30 second timeout
    
    const checkServer = () => {
      if (serverOutput.includes('Ready in') || serverOutput.includes('Local:')) {
        clearTimeout(timeout);
        resolve();
      } else {
        setTimeout(checkServer, 1000);
      }
    };
    checkServer();
  });
  
  console.log('🌐 Testing DevTools endpoint...');
  const endpointWorking = await testDevToolsEndpoint();
  
  // Kill the dev server and any child processes
  try {
    devServer.kill('SIGTERM');
    // Give it a moment to shut down gracefully
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Force kill if still running
    devServer.kill('SIGKILL');
  } catch (error) {
    // Ignore errors during cleanup
  }
  
  // Clean up
  await fs.promises.rm(testDir, { recursive: true, force: true });
  
  return endpointWorking;
}

async function runQuickTest() {
  console.log('🏃 Running quick runtime test...');
  
  try {
    const success = await createQuickTest();
    
    if (success) {
      console.log('🎉 Quick test PASSED - DevTools endpoint is working!');
    } else {
      console.log('❌ Quick test FAILED - DevTools endpoint not working');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Quick test ERROR:', error.message);
    process.exit(1);
  }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.log('⚠️  Fetch not available, installing node-fetch...');
  await execAsync('npm install --no-save node-fetch');
  const fetch = (await import('node-fetch')).default;
  global.fetch = fetch;
}

runQuickTest();
