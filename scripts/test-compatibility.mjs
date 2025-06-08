#!/usr/bin/env node

/**
 * Manual testing script for different Next.js versions and configurations
 * This script creates real Next.js projects and tests our plugin
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const testConfigs = [
  {
    name: 'Next.js 12 + Pages Router + CommonJS',
    nextVersion: '^12.3.4',
    configType: 'js',
    structure: 'pages',
    typescript: false
  },
  {
    name: 'Next.js 13 + App Router + ESM',
    nextVersion: '^13.5.6',
    configType: 'mjs',
    structure: 'app',
    typescript: false
  },
  {
    name: 'Next.js 14 + App Router + TypeScript',
    nextVersion: '^14.2.5',
    configType: 'ts',
    structure: 'app',
    typescript: true
  },
  {
    name: 'Next.js 15 + Pages Router + TypeScript',
    nextVersion: '^15.0.0',
    configType: 'ts',
    structure: 'pages',
    typescript: true
  }
];

async function createTestProject(config, testDir) {
  console.log(`\n🧪 Creating test: ${config.name}`);
  console.log(`📁 Directory: ${testDir}`);

  // Create package.json
  const packageJson = {
    name: `test-${config.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: 'next lint'
    },
    dependencies: {
      next: config.nextVersion,
      react: '^18.0.0',
      'react-dom': '^18.0.0'
    },
    devDependencies: {}
  };

  // Add TypeScript dependencies if needed
  if (config.typescript) {
    packageJson.devDependencies = {
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
      '@types/react': '^18.0.0',
      '@types/react-dom': '^18.0.0'
    };
  }

  await fs.promises.writeFile(
    path.join(testDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create TypeScript config if needed
  if (config.typescript) {
    const tsConfig = {
      compilerOptions: {
        target: 'es5',
        lib: ['dom', 'dom.iterable', 'es6'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./src/*'] }
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules']
    };

    await fs.promises.writeFile(
      path.join(testDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
  }

  // Create project structure
  if (config.structure === 'pages') {
    await fs.promises.mkdir(path.join(testDir, 'pages'), { recursive: true });
    
    const indexFile = config.typescript ? 'index.tsx' : 'index.js';
    const indexContent = config.typescript
      ? `import React from 'react';

export default function Home() {
  return (
    <div>
      <h1>Hello from Next.js {process.env.NODE_ENV}</h1>
      <p>This is a Pages Router project with TypeScript</p>
    </div>
  );
}`
      : `export default function Home() {
  return (
    <div>
      <h1>Hello from Next.js {process.env.NODE_ENV}</h1>
      <p>This is a Pages Router project</p>
    </div>
  );
}`;

    await fs.promises.writeFile(path.join(testDir, 'pages', indexFile), indexContent);
  } else {
    // App Router
    await fs.promises.mkdir(path.join(testDir, 'app'), { recursive: true });
    
    const pageFile = config.typescript ? 'page.tsx' : 'page.js';
    const layoutFile = config.typescript ? 'layout.tsx' : 'layout.js';
    
    const pageContent = config.typescript
      ? `import React from 'react';

export default function Page() {
  return (
    <div>
      <h1>Hello from Next.js App Router</h1>
      <p>This is an App Router project with TypeScript</p>
    </div>
  );
}`
      : `export default function Page() {
  return (
    <div>
      <h1>Hello from Next.js App Router</h1>
      <p>This is an App Router project</p>
    </div>
  );
}`;

    const layoutContent = config.typescript
      ? `import React from 'react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`
      : `export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`;

    await fs.promises.writeFile(path.join(testDir, 'app', pageFile), pageContent);
    await fs.promises.writeFile(path.join(testDir, 'app', layoutFile), layoutContent);
  }

  console.log('✅ Project structure created');
  return testDir;
}

async function testPluginSetup(testDir, config) {
  console.log('📦 Installing dependencies...');
  
  try {
    // Install Next.js and dependencies
    await execAsync('npm install', { cwd: testDir, timeout: 120000 });
    console.log('✅ Dependencies installed');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    return false;
  }

  console.log('🔧 Running plugin setup...');
  
  try {
    const setupScript = path.resolve(process.cwd(), 'bin/setup.js');
    const { stdout, stderr } = await execAsync(`node "${setupScript}"`, { 
      cwd: testDir,
      timeout: 30000 
    });
    
    console.log('Setup output:', stdout);
    if (stderr) console.log('Setup warnings:', stderr);
    
    if (!stdout.includes('Setup complete!')) {
      console.error('❌ Setup did not complete successfully');
      return false;
    }
    
    console.log('✅ Plugin setup completed');
  } catch (error) {
    console.error('❌ Plugin setup failed:', error.message);
    return false;
  }

  // Verify config file was created
  const configFile = `next.config.${config.configType}`;
  const configPath = path.join(testDir, configFile);
  
  if (!fs.existsSync(configPath)) {
    console.error(`❌ Config file ${configFile} was not created`);
    return false;
  }

  const configContent = await fs.promises.readFile(configPath, 'utf-8');
  console.log(`📄 Generated ${configFile}:`);
  console.log(configContent);

  // Verify package.json was updated
  const packageJsonPath = path.join(testDir, 'package.json');
  const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));
  
  if (!packageJson.devDependencies || !packageJson.devDependencies['next-plugin-devtools-json']) {
    console.error('❌ Package was not added to devDependencies');
    return false;
  }

  console.log('✅ Package added to devDependencies');

  // Test that the config file is valid (no syntax errors)
  try {
    if (config.typescript) {
      // For TypeScript, just check that it can be parsed
      const ts = await import('typescript');
      const result = ts.transpile(configContent, { module: ts.ModuleKind.CommonJS });
      if (!result) throw new Error('TypeScript compilation failed');
    } else {
      // For JS, we can try to require it (but need to be careful about Next.js not being available)
      // Instead, just check for basic syntax
      new Function(configContent.replace(/module\.exports|export default/, 'return'));
    }
    console.log('✅ Config file syntax is valid');
  } catch (error) {
    console.error('❌ Config file has syntax errors:', error.message);
    return false;
  }

  // Try to run Next.js build to see if config works
  console.log('🏗️  Testing Next.js build...');
  try {
    const { stdout: buildOutput } = await execAsync('npm run build', { 
      cwd: testDir, 
      timeout: 180000 // 3 minutes for build
    });
    
    if (buildOutput.includes('✓') || buildOutput.includes('Compiled successfully')) {
      console.log('✅ Next.js build succeeded');
    } else {
      console.log('⚠️  Build completed but might have issues');
      console.log('Build output:', buildOutput);
    }
  } catch (error) {
    console.error('❌ Next.js build failed:', error.message);
    return false;
  }

  return true;
}

async function runTests() {
  const baseTestDir = path.join('/tmp', 'nextjs-plugin-tests');
  
  // Clean up any existing test directory
  if (fs.existsSync(baseTestDir)) {
    await fs.promises.rm(baseTestDir, { recursive: true, force: true });
  }
  
  await fs.promises.mkdir(baseTestDir, { recursive: true });
  
  console.log('🚀 Starting Next.js Plugin Compatibility Tests');
  console.log(`📁 Test directory: ${baseTestDir}`);
  
  const results = [];
  
  for (const config of testConfigs) {
    const testDir = path.join(baseTestDir, config.name.toLowerCase().replace(/[^a-z0-9]/g, '-'));
    await fs.promises.mkdir(testDir, { recursive: true });
    
    try {
      await createTestProject(config, testDir);
      const success = await testPluginSetup(testDir, config);
      
      results.push({
        name: config.name,
        success,
        directory: testDir
      });
      
      if (success) {
        console.log(`✅ ${config.name} - PASSED`);
      } else {
        console.log(`❌ ${config.name} - FAILED`);
      }
    } catch (error) {
      console.error(`❌ ${config.name} - ERROR:`, error.message);
      results.push({
        name: config.name,
        success: false,
        error: error.message,
        directory: testDir
      });
    }
    
    console.log('─'.repeat(80));
  }
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log(`   Directory: ${result.directory}`);
  });
  
  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! The plugin is compatible with all tested configurations.');
  } else {
    console.log('⚠️  Some tests failed. Check the individual test outputs above.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}
