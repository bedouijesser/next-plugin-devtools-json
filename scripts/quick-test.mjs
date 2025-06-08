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
  
  console.log('🛑 Shutting down server...');
  // Kill the dev server and any child processes
  let usedForceKill = false;
  try {
    // Get the process ID first
    const mainPid = devServer.pid;
    console.log(`   Main process PID: ${mainPid}`);
    
    // Find all processes related to our test directory (more comprehensive)
    let relatedPids = [];
    try {
      const { stdout } = await execAsync(`pgrep -f "${path.basename(testDir)}"`, { stdio: 'pipe' });
      relatedPids = stdout.trim().split('\n').filter(pid => pid && pid !== '');
      if (relatedPids.length > 0) {
        console.log(`   Found related PIDs: ${relatedPids.join(', ')}`);
      }
    } catch (error) {
      console.log('   No related processes found via pgrep');
    }
    
    console.log('   Sending SIGTERM to main process...');
    devServer.kill('SIGTERM');
    
    // Also send SIGTERM to all related processes
    for (const pid of relatedPids) {
      if (pid !== mainPid.toString()) {
        try {
          console.log(`   Sending SIGTERM to related process ${pid}...`);
          await execAsync(`kill -TERM ${pid}`);
        } catch (error) {
          // Process might have already exited
        }
      }
    }
    
    // Give it more time to shut down gracefully
    console.log('   Waiting 8 seconds for graceful shutdown...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Check if still running before force kill
    if (!devServer.killed) {
      console.log('   Main process still running, force killing...');
      devServer.kill('SIGKILL');
      usedForceKill = true;
      
      // Force kill remaining related processes
      for (const pid of relatedPids) {
        if (pid !== mainPid.toString()) {
          try {
            console.log(`   Force killing related process ${pid}...`);
            await execAsync(`kill -9 ${pid}`);
          } catch (error) {
            // Process might have already exited
          }
        }
      }
      
      // Additional wait after force kill
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log('   Main process shut down gracefully');
    }
  } catch (error) {
    console.log('   Error during shutdown:', error.message);
  }

  // Check that ports were properly cleaned up - this should FAIL the test if ports are still in use
  const portsToCheck = [3000, 3001, 3002, 3003, 3004, 3005];
  const cleanedUp = await checkPortsCleanedUp(portsToCheck);
  
  // Clean up test directory
  try {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('⚠️ Could not clean up test directory:', error.message);
  }
  
  // If we had to force kill, that's also a failure (servers should clean up gracefully)
  if (usedForceKill) {
    console.error('❌ Had to force kill server - graceful shutdown failed');
  }
  
  // Return success only if: endpoint worked AND cleanup succeeded AND no force kill needed
  return endpointWorking && cleanedUp && !usedForceKill;
}

async function runQuickTest() {
  console.log('🏃 Running quick runtime test...');
  
  try {
    const success = await createQuickTest();
    
    if (success) {
      console.log('🎉 Quick test PASSED - DevTools endpoint working, server properly cleaned up, and graceful shutdown!');
    } else {
      console.log('❌ Quick test FAILED - Either DevTools endpoint not working, server not properly cleaned up, or forced shutdown required');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Quick test ERROR:', error.message);
    process.exit(1);
  }
}

async function checkPortsCleanedUp(ports) {
  console.log('🔍 Checking if ports were properly cleaned up...');
  const stillRunning = [];
  
  for (const port of ports) {
    try {
      const { stdout } = await execAsync(`lsof -ti :${port}`, { stdio: 'pipe' });
      const pids = stdout.trim().split('\n').filter(pid => pid && pid.match(/^\d+$/));
      
      if (pids.length > 0) {
        // Get process details for better debugging
        try {
          const { stdout: processInfo } = await execAsync(`ps -p ${pids.join(',')} -o pid,ppid,command --no-headers`, { stdio: 'pipe' });
          
          // Also check what's listening on this specific port
          let portInfo = '';
          try {
            const { stdout: lsofOutput } = await execAsync(`lsof -i :${port}`, { stdio: 'pipe' });
            portInfo = lsofOutput;
          } catch (error) {
            portInfo = 'Could not get port info';
          }
          
          stillRunning.push({ port, pids, processInfo: processInfo.trim(), portInfo });
        } catch (error) {
          stillRunning.push({ port, pids, processInfo: 'Could not get process info', portInfo: '' });
        }
      }
    } catch (error) {
      // Port is not in use, which is good
      // lsof returns exit code 1 when no processes found
    }
  }
  
  if (stillRunning.length > 0) {
    console.error('❌ Server cleanup FAILED - processes still running:');
    stillRunning.forEach(({ port, pids, processInfo, portInfo }) => {
      console.error(`   Port ${port}: PIDs ${pids.join(', ')}`);
      console.error(`   Process info: ${processInfo}`);
      if (portInfo) {
        console.error(`   Port details:\n${portInfo}`);
      }
      console.error('');
    });
    
    // Try to kill remaining processes
    console.log('🔨 Attempting to kill remaining processes...');
    for (const { pids } of stillRunning) {
      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid}`);
          console.log(`   Killed PID ${pid}`);
        } catch (error) {
          console.log(`   Could not kill PID ${pid}: ${error.message}`);
        }
      }
    }
    
    return false;
  }
  
  console.log('✅ All ports properly cleaned up');
  return true;
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.log('⚠️  Fetch not available, installing node-fetch...');
  await execAsync('npm install --no-save node-fetch');
  const fetch = (await import('node-fetch')).default;
  global.fetch = fetch;
}

runQuickTest();
