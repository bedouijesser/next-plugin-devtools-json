#!/usr/bin/env node

/**
 * Enhanced compatibility testing script for next-plugin-devtools-json
 * Tests multiple Next.js versions, configurations, and project structures
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Test matrices
const nextVersions = [
  { version: '^12.3.4', name: 'Next.js 12', minNode: '14.6.0' },
  { version: '^13.5.6', name: 'Next.js 13', minNode: '16.8.0' },
  { version: '^14.2.5', name: 'Next.js 14', minNode: '18.17.0' },
  { version: '^15.0.0', name: 'Next.js 15', minNode: '18.18.0' }
];

const configTypes = [
  { ext: 'js', format: 'commonjs', name: 'CommonJS' },
  { ext: 'mjs', format: 'esm', name: 'ESM' },
  { ext: 'ts', format: 'typescript', name: 'TypeScript' }
];

const projectStructures = [
  { type: 'pages', name: 'Pages Router', files: [{ path: 'pages/index.js', content: 'export default function Home() { return <div>Hello Pages</div>; }' }] },
  { type: 'app', name: 'App Router', files: [
    { path: 'app/page.js', content: 'export default function Page() { return <div>Hello App</div>; }' },
    { path: 'app/layout.js', content: 'export default function RootLayout({ children }) { return <html><body>{children}</body></html>; }' }
  ]},
  { type: 'src-pages', name: 'Src + Pages Router', files: [{ path: 'src/pages/index.js', content: 'export default function Home() { return <div>Hello Src Pages</div>; }' }] },
  { type: 'src-app', name: 'Src + App Router', files: [
    { path: 'src/app/page.js', content: 'export default function Page() { return <div>Hello Src App</div>; }' },
    { path: 'src/app/layout.js', content: 'export default function RootLayout({ children }) { return <html><body>{children}</body></html>; }' }
  ]}
];

const specialConfigs = [
  {
    name: 'Complex Webpack Config',
    config: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    config.module.rules.push({
      test: /\\.svg$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
  images: {
    domains: ['example.com'],
    formats: ['image/webp', 'image/avif'],
  },
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['@prisma/client'],
  },
};

module.exports = nextConfig;`
  },
  {
    name: 'ESM with Complex Config',
    config: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://api.example.com/:path*',
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/old-path',
        destination: '/new-path',
        permanent: true,
      },
    ];
  },
  env: {
    CUSTOM_KEY: 'custom-value',
  },
};

export default nextConfig;`,
    ext: 'mjs'
  }
];

const monorepoConfigs = [
  { name: 'Yarn Workspaces', packageManager: 'yarn' },
  { name: 'NPM Workspaces', packageManager: 'npm' },
  { name: 'PNPM Workspaces', packageManager: 'pnpm' }
];

async function createBasicProject(config, testDir) {
  console.log(`📦 Creating ${config.name} project...`);

  // Create package.json
  const packageJson = {
    name: `test-${config.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start'
    },
    dependencies: {
      next: config.nextVersion,
      react: '^18.0.0',
      'react-dom': '^18.0.0'
    },
    devDependencies: {}
  };

  // Add TypeScript if needed
  if (config.typescript) {
    packageJson.devDependencies = {
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
      '@types/react': '^18.0.0',
      '@types/react-dom': '^18.0.0'
    };

    // Add ESM type if using ESM
    if (config.format === 'esm') {
      packageJson.type = 'module';
    }
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

  return packageJson;
}

async function createProjectStructure(structure, testDir, isTypescript = false) {
  console.log(`📁 Creating ${structure.name} structure...`);

  for (const file of structure.files) {
    const filePath = path.join(testDir, file.path);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    
    // Convert to TypeScript if needed
    let content = file.content;
    let fileName = file.path;
    
    if (isTypescript && path.extname(file.path) === '.js') {
      fileName = file.path.replace('.js', '.tsx');
      if (content.includes('export default function')) {
        content = `import React from 'react';\n\n${content}`;
      }
    }
    
    await fs.promises.writeFile(path.join(testDir, fileName), content);
  }
}

async function testSetupScript(testDir, expectedConfigFile) {
  console.log('🔧 Testing plugin setup...');
  
  const setupScript = path.resolve(process.cwd(), 'bin/setup.js');
  
  try {
    const { stdout, stderr } = await execAsync(`node "${setupScript}"`, { 
      cwd: testDir,
      timeout: 30000 
    });
    
    if (stderr) console.log('Setup warnings:', stderr);
    
    if (!stdout.includes('Setup complete!') && !stdout.includes('already configured')) {
      throw new Error('Setup did not complete successfully');
    }
    
    // Verify config file was created
    const configPath = path.join(testDir, expectedConfigFile);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file ${expectedConfigFile} was not created`);
    }

    const configContent = await fs.promises.readFile(configPath, 'utf-8');
    
    // Verify package.json was updated
    const packageJsonPath = path.join(testDir, 'package.json');
    const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));
    
    if (!packageJson.devDependencies || !packageJson.devDependencies['next-plugin-devtools-json']) {
      throw new Error('Package was not added to devDependencies');
    }

    console.log('✅ Setup successful');
    return { configContent, packageJson };
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    throw error;
  }
}

async function testBuild(testDir) {
  console.log('🏗️  Testing Next.js build...');
  
  try {
    // Install dependencies first
    await execAsync('npm install --silent', { 
      cwd: testDir, 
      timeout: 120000 
    });
    
    const { stdout: buildOutput } = await execAsync('npm run build', { 
      cwd: testDir, 
      timeout: 180000 
    });
    
    if (buildOutput.includes('✓') || buildOutput.includes('Compiled successfully')) {
      console.log('✅ Build successful');
      return true;
    } else {
      console.log('⚠️  Build completed with warnings');
      return true; // Still consider it a success
    }
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    return false;
  }
}

async function runBasicCompatibilityTests() {
  console.log('\n🧪 Running Basic Compatibility Tests\n');
  
  const results = [];
  const baseTestDir = path.join('/tmp', 'nextjs-plugin-basic-tests');
  
  // Clean up any existing test directory
  if (fs.existsSync(baseTestDir)) {
    await fs.promises.rm(baseTestDir, { recursive: true, force: true });
  }
  await fs.promises.mkdir(baseTestDir, { recursive: true });

  // Test each Next.js version with different config types
  for (const nextVersion of nextVersions.slice(1, 3)) { // Test 13 and 14 for speed
    for (const configType of configTypes) {
      const testName = `${nextVersion.name} + ${configType.name}`;
      const testDir = path.join(baseTestDir, testName.toLowerCase().replace(/[^a-z0-9]/g, '-'));
      await fs.promises.mkdir(testDir, { recursive: true });

      try {
        console.log(`\n🧪 Testing: ${testName}`);
        console.log(`📁 Directory: ${testDir}`);

        const config = {
          name: testName,
          nextVersion: nextVersion.version,
          format: configType.format,
          typescript: configType.format === 'typescript'
        };

        await createBasicProject(config, testDir);
        
        // Create basic pages structure
        await createProjectStructure(projectStructures[0], testDir, config.typescript);
        
        const expectedConfigFile = `next.config.${configType.ext}`;
        const { configContent } = await testSetupScript(testDir, expectedConfigFile);
        
        // Verify config content
        if (configType.format === 'commonjs') {
          if (!configContent.includes('require(\'next-plugin-devtools-json\')')) {
            throw new Error('CommonJS config missing require statement');
          }
          if (!configContent.includes('module.exports')) {
            throw new Error('CommonJS config missing module.exports');
          }
        } else {
          if (!configContent.includes('import withDevToolsJSON from \'next-plugin-devtools-json\'')) {
            throw new Error('ESM/TS config missing import statement');
          }
          if (!configContent.includes('export default')) {
            throw new Error('ESM/TS config missing export default');
          }
        }
        
        if (!configContent.includes('process.env.NODE_ENV === \'development\'')) {
          throw new Error('Config missing development environment check');
        }

        results.push({
          name: testName,
          success: true,
          directory: testDir
        });
        
        console.log(`✅ ${testName} - PASSED`);
      } catch (error) {
        console.error(`❌ ${testName} - FAILED:`, error.message);
        results.push({
          name: testName,
          success: false,
          error: error.message,
          directory: testDir
        });
      }
      
      console.log('─'.repeat(60));
    }
  }

  return results;
}

async function runProjectStructureTests() {
  console.log('\n📁 Running Project Structure Tests\n');
  
  const results = [];
  const baseTestDir = path.join('/tmp', 'nextjs-plugin-structure-tests');
  
  if (fs.existsSync(baseTestDir)) {
    await fs.promises.rm(baseTestDir, { recursive: true, force: true });
  }
  await fs.promises.mkdir(baseTestDir, { recursive: true });

  for (const structure of projectStructures) {
    const testName = `Structure: ${structure.name}`;
    const testDir = path.join(baseTestDir, structure.type);
    await fs.promises.mkdir(testDir, { recursive: true });

    try {
      console.log(`\n🧪 Testing: ${testName}`);
      
      const config = {
        name: testName,
        nextVersion: '^14.2.5',
        format: 'commonjs',
        typescript: false
      };

      await createBasicProject(config, testDir);
      await createProjectStructure(structure, testDir);
      await testSetupScript(testDir, 'next.config.js');

      results.push({
        name: testName,
        success: true,
        directory: testDir
      });
      
      console.log(`✅ ${testName} - PASSED`);
    } catch (error) {
      console.error(`❌ ${testName} - FAILED:`, error.message);
      results.push({
        name: testName,
        success: false,
        error: error.message,
        directory: testDir
      });
    }
    
    console.log('─'.repeat(60));
  }

  return results;
}

async function runSpecialConfigTests() {
  console.log('\n⚙️  Running Special Configuration Tests\n');
  
  const results = [];
  const baseTestDir = path.join('/tmp', 'nextjs-plugin-special-tests');
  
  if (fs.existsSync(baseTestDir)) {
    await fs.promises.rm(baseTestDir, { recursive: true, force: true });
  }
  await fs.promises.mkdir(baseTestDir, { recursive: true });

  for (const specialConfig of specialConfigs) {
    const testName = `Special Config: ${specialConfig.name}`;
    const testDir = path.join(baseTestDir, specialConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '-'));
    await fs.promises.mkdir(testDir, { recursive: true });

    try {
      console.log(`\n🧪 Testing: ${testName}`);
      
      const config = {
        name: testName,
        nextVersion: '^14.2.5',
        format: 'commonjs',
        typescript: false
      };

      await createBasicProject(config, testDir);
      await createProjectStructure(projectStructures[0], testDir);
      
      // Create the special config file
      const configFile = `next.config.${specialConfig.ext || 'js'}`;
      await fs.promises.writeFile(path.join(testDir, configFile), specialConfig.config);
      
      const { configContent } = await testSetupScript(testDir, configFile);
      
      // Verify original config is preserved
      if (specialConfig.name.includes('Webpack') && !configContent.includes('webpack:')) {
        throw new Error('Original webpack config was not preserved');
      }
      
      if (specialConfig.name.includes('ESM') && !configContent.includes('async rewrites()')) {
        throw new Error('Original async functions were not preserved');
      }

      results.push({
        name: testName,
        success: true,
        directory: testDir
      });
      
      console.log(`✅ ${testName} - PASSED`);
    } catch (error) {
      console.error(`❌ ${testName} - FAILED:`, error.message);
      results.push({
        name: testName,
        success: false,
        error: error.message,
        directory: testDir
      });
    }
    
    console.log('─'.repeat(60));
  }

  return results;
}

async function runFullBuildTests() {
  console.log('\n🏗️  Running Full Build Tests (Limited)\n');
  
  const results = [];
  const baseTestDir = path.join('/tmp', 'nextjs-plugin-build-tests');
  
  if (fs.existsSync(baseTestDir)) {
    await fs.promises.rm(baseTestDir, { recursive: true, force: true });
  }
  await fs.promises.mkdir(baseTestDir, { recursive: true });

  // Test only one configuration with full build to save time
  const testConfig = {
    name: 'Build Test',
    nextVersion: '^14.2.5',
    format: 'commonjs',
    typescript: false
  };

  const testDir = path.join(baseTestDir, 'build-test');
  await fs.promises.mkdir(testDir, { recursive: true });

  try {
    console.log('🧪 Testing: Full Build Process');
    
    await createBasicProject(testConfig, testDir);
    await createProjectStructure(projectStructures[0], testDir);
    await testSetupScript(testDir, 'next.config.js');
    
    const buildSuccess = await testBuild(testDir);
    
    if (!buildSuccess) {
      throw new Error('Build process failed');
    }

    results.push({
      name: 'Full Build Test',
      success: true,
      directory: testDir
    });
    
    console.log('✅ Full Build Test - PASSED');
  } catch (error) {
    console.error('❌ Full Build Test - FAILED:', error.message);
    results.push({
      name: 'Full Build Test',
      success: false,
      error: error.message,
      directory: testDir
    });
  }

  return results;
}

async function printSummary(allResults) {
  console.log('\n📊 Enhanced Compatibility Test Results Summary\n');
  
  const categories = [
    { name: 'Basic Compatibility', results: allResults.basic },
    { name: 'Project Structures', results: allResults.structures },
    { name: 'Special Configurations', results: allResults.special },
    { name: 'Build Tests', results: allResults.build }
  ];

  let totalPassed = 0;
  let totalTests = 0;

  for (const category of categories) {
    const passed = category.results.filter(r => r.success).length;
    const total = category.results.length;
    totalPassed += passed;
    totalTests += total;
    
    console.log(`📂 ${category.name}: ${passed}/${total} passed`);
    
    category.results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`   ${status} ${result.name}`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });
    console.log();
  }

  console.log(`🎯 Overall Results: ${totalPassed}/${totalTests} tests passed`);
  console.log(`📈 Success Rate: ${Math.round((totalPassed / totalTests) * 100)}%`);
  
  if (totalPassed === totalTests) {
    console.log('🎉 All tests passed! The plugin is highly compatible.');
  } else {
    console.log('⚠️  Some tests failed. Check individual results above.');
  }

  // Cleanup recommendation
  console.log(`\n🧹 Test directories created in /tmp/nextjs-plugin-*-tests/`);
  console.log('💡 You can examine failed test directories for debugging.');
}

async function main() {
  console.log('🚀 Enhanced Next.js Plugin Compatibility Testing');
  console.log('🔍 Testing multiple versions, configurations, and structures\n');

  try {
    const results = {};
    
    results.basic = await runBasicCompatibilityTests();
    results.structures = await runProjectStructureTests();
    results.special = await runSpecialConfigTests();
    results.build = await runFullBuildTests();
    
    await printSummary(results);
    
    const allResults = Object.values(results).flat();
    const failed = allResults.filter(r => !r.success);
    
    if (failed.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runEnhancedCompatibilityTests };
