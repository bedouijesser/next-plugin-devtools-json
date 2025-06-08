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
    configType: 'js', // Changed from 'ts' - Next.js doesn't support .ts config files
    structure: 'app',
    typescript: true
  },
  {
    name: 'Next.js 15 + Pages Router + TypeScript',
    nextVersion: '^15.0.0',
    configType: 'js', // Changed from 'ts' - Next.js doesn't support .ts config files
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

  // Add module type for ESM configs
  if (config.configType === 'mjs') {
    packageJson.type = 'module';
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

  // Create minimal Next.js config file of the expected type
  // This ensures the setup script will update the right file instead of creating next.config.js
  const configFile = `next.config.${config.configType}`;
  let configContent;
  
  if (config.configType === 'js') {
    configContent = `/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
};

module.exports = nextConfig;`;
  } else if (config.configType === 'mjs') {
    configContent = `/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
};

export default nextConfig;`;
  } else if (config.configType === 'ts') {
    configContent = `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Your Next.js config here
};

export default nextConfig;`;
  }
  
  await fs.promises.writeFile(path.join(testDir, configFile), configContent);

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

  console.log('🔧 Setting up plugin (using local build)...');
  
  try {
    // Copy the local build instead of installing from npm
    const projectRoot = process.cwd();
    const distPath = path.join(projectRoot, 'dist');
    const packageJsonPath = path.join(projectRoot, 'package.json');
    
    if (!fs.existsSync(distPath)) {
      console.error('❌ Local build not found. Run `npm run build` first.');
      return false;
    }
    
    // Create node_modules/next-plugin-devtools-json directory
    const nodeModulesDir = path.join(testDir, 'node_modules', 'next-plugin-devtools-json');
    await fs.promises.mkdir(nodeModulesDir, { recursive: true });
    
    // Copy dist directory
    await fs.promises.cp(distPath, path.join(nodeModulesDir, 'dist'), { recursive: true });
    
    // Copy package.json
    await fs.promises.copyFile(packageJsonPath, path.join(nodeModulesDir, 'package.json'));
    
    // Copy bin directory if it exists
    const binPath = path.join(projectRoot, 'bin');
    if (fs.existsSync(binPath)) {
      await fs.promises.cp(binPath, path.join(nodeModulesDir, 'bin'), { recursive: true });
    }
    
    // Update the test project's package.json to include the plugin as a dev dependency
    const testPackageJsonPath = path.join(testDir, 'package.json');
    const testPackageJson = JSON.parse(await fs.promises.readFile(testPackageJsonPath, 'utf-8'));
    
    if (!testPackageJson.devDependencies) {
      testPackageJson.devDependencies = {};
    }
    testPackageJson.devDependencies['next-plugin-devtools-json'] = 'file:./node_modules/next-plugin-devtools-json';
    
    await fs.promises.writeFile(testPackageJsonPath, JSON.stringify(testPackageJson, null, 2));
    
    console.log('✅ Local plugin build installed');
    
    // Now run the setup script
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
    } else if (config.configType === 'mjs') {
      // For ESM files, we can't easily validate syntax without actual import
      // But we can check for basic ESM structure
      if (!configContent.includes('import') || !configContent.includes('export default')) {
        throw new Error('ESM file must contain import and export default statements');
      }
      // Skip syntax validation for ESM files as it requires module context
    } else {
      // For CommonJS, we can try to validate syntax
      // Remove JSDoc comments which can cause issues with Function constructor
      const cleanedContent = configContent
        .replace(/\/\*\*[\s\S]*?\*\//g, '') // Remove JSDoc comments
        .replace(/module\.exports\s*=\s*([^;]+);?/, 'return $1;'); // Better replacement
      new Function(cleanedContent);
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
  
  // Clean up test directory
  console.log('\n🧹 Cleaning up test directory...');
  try {
    await fs.promises.rm(baseTestDir, { recursive: true, force: true });
    console.log('✅ Test directory cleaned up successfully');
  } catch (error) {
    console.warn('⚠️ Could not clean up test directory:', error.message);
  }
  
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
