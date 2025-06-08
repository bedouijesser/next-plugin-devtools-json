#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function detectPackageManager() {
  // Check for lock files to detect package manager
  if (fs.existsSync('bun.lockb')) {
    return 'bun';
  }
  if (fs.existsSync('pnpm-lock.yaml')) {
    return 'pnpm';
  }
  if (fs.existsSync('yarn.lock')) {
    return 'yarn';
  }
  if (fs.existsSync('package-lock.json')) {
    return 'npm';
  }
  
  // If no lock files, check if alternative package managers are available
  try {
    execSync('bun --version', { stdio: 'ignore' });
    return 'bun';
  } catch {}
  
  try {
    execSync('pnpm --version', { stdio: 'ignore' });
    return 'pnpm';
  } catch {}
  
  try {
    execSync('yarn --version', { stdio: 'ignore' });
    return 'yarn';
  } catch {}
  
  // Default to npm
  return 'npm';
}

function getInstallCommand(packageManager) {
  const commands = {
    npm: 'npm install --save-dev next-plugin-devtools-json',
    yarn: 'yarn add --dev next-plugin-devtools-json',
    pnpm: 'pnpm add --save-dev next-plugin-devtools-json',
    bun: 'bun add --dev next-plugin-devtools-json'
  };
  
  return commands[packageManager] || commands.npm;
}

function detectNextConfigFile() {
  const configFiles = [
    'next.config.js',
    'next.config.mjs',
    'next.config.ts'
  ];

  for (const file of configFiles) {
    if (fs.existsSync(file)) {
      return file;
    }
  }

  return null;
}

function detectConfigFormat(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  
  if (filePath.endsWith('.ts')) {
    return 'typescript';
  }
  
  if (filePath.endsWith('.mjs') || content.includes('export default')) {
    return 'esm';
  }
  
  return 'commonjs';
}

function createNextConfig(format) {
  const pluginImport = format === 'commonjs' 
    ? `const plugin = require('next-plugin-devtools-json');
const withDevToolsJSON = plugin.default || plugin;`
    : "import withDevToolsJSON from 'next-plugin-devtools-json';";

  const exportStatement = format === 'commonjs'
    ? `module.exports = withDevToolsJSON(nextConfig);`
    : `export default withDevToolsJSON(nextConfig);`;

  return `${pluginImport}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
};

${exportStatement}`;
}

function updateExistingConfig(filePath, content, format) {
  const pluginImport = format === 'commonjs' 
    ? "const plugin = require('next-plugin-devtools-json');\nconst withDevToolsJSON = plugin.default || plugin;"
    : "import withDevToolsJSON from 'next-plugin-devtools-json';";

  let updatedContent = content;

  // Add import at the top
  if (!content.includes('next-plugin-devtools-json')) {
    if (format === 'commonjs') {
      // Add after other requires
      const requireMatch = content.match(/^((?:.*require\(.*\).*\n)*)/m);
      if (requireMatch) {
        updatedContent = content.replace(requireMatch[0], requireMatch[0] + pluginImport + '\n');
      } else {
        updatedContent = pluginImport + '\n\n' + content;
      }
    } else {
      // Add after other imports
      const importMatch = content.match(/^((?:.*import.*from.*\n)*)/m);
      if (importMatch) {
        updatedContent = content.replace(importMatch[0], importMatch[0] + pluginImport + '\n');
      } else {
        updatedContent = pluginImport + '\n\n' + content;
      }
    }
  }

  // Update the export
  if (format === 'commonjs') {
    // Look for module.exports pattern
    if (content.includes('module.exports = ')) {
      updatedContent = updatedContent.replace(
        /module\.exports\s*=\s*([^;]+);?/,
        `module.exports = withDevToolsJSON($1);`
      );
    }
  } else {
    // Look for export default pattern
    if (content.includes('export default ')) {
      updatedContent = updatedContent.replace(
        /export\s+default\s+([^;]+);?/,
        `export default withDevToolsJSON($1);`
      );
    }
  }

  return updatedContent;
}

function main() {
  console.log('🔧 Setting up next-plugin-devtools-json...');
  
  // Check if we're in a Next.js project
  if (!fs.existsSync('package.json')) {
    console.error('❌ Error: package.json not found. Please run this command in a Next.js project root.');
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  if (!packageJson.dependencies?.next && !packageJson.devDependencies?.next) {
    console.error('❌ Error: Next.js not found in dependencies. Please run this command in a Next.js project.');
    process.exit(1);
  }

  // Detect package manager
  const packageManager = detectPackageManager();
  console.log(`📦 Detected package manager: ${packageManager}`);

  // Check if package is already installed
  const isAlreadyInstalled = packageJson.devDependencies?.['next-plugin-devtools-json'] || 
                             packageJson.dependencies?.['next-plugin-devtools-json'];
  
  if (!isAlreadyInstalled) {
    console.log('📦 Installing next-plugin-devtools-json as dev dependency...');
    try {
      const installCommand = getInstallCommand(packageManager);
      console.log(`🏃 Running: ${installCommand}`);
      execSync(installCommand, { stdio: 'inherit' });
      console.log('✅ Package installed successfully!');
    } catch (error) {
      console.error('❌ Failed to install package:', error.message);
      console.error('\n💡 You can install manually with:');
      console.error(`   ${getInstallCommand(packageManager)}`);
      process.exit(1);
    }
  } else {
    console.log('✅ Package already installed');
  }

  try {
    // Handle Next.js config
    const existingConfigFile = detectNextConfigFile();
    
    if (existingConfigFile) {
      console.log(`📝 Updating existing config file: ${existingConfigFile}`);
      const content = fs.readFileSync(existingConfigFile, 'utf-8');
      const format = detectConfigFormat(existingConfigFile);
      
      if (content.includes('next-plugin-devtools-json')) {
        console.log('✅ Plugin already configured in next.config file');
      } else {
        const updatedContent = updateExistingConfig(existingConfigFile, content, format);
        fs.writeFileSync(existingConfigFile, updatedContent);
        console.log('✅ Updated next.config file with DevTools JSON plugin');
      }
    } else {
      console.log('📝 Creating new next.config.js file');
      const newConfig = createNextConfig('commonjs');
      fs.writeFileSync('next.config.js', newConfig);
      console.log('✅ Created next.config.js with DevTools JSON plugin');
    }

    console.log('\n🎉 Setup complete!');
    console.log('\n📖 The DevTools JSON endpoints will be available at:');
    console.log('   /__devtools_json');
    console.log('   /.well-known/appspecific/com.chrome.devtools.json');
    
    const packageManager = detectPackageManager();
    const runCommand = packageManager === 'yarn' ? 'yarn dev' : 
                      packageManager === 'pnpm' ? 'pnpm dev' :
                      packageManager === 'bun' ? 'bun dev' : 'npm run dev';
    
    console.log(`\n🚀 Start your development server with: ${runCommand}`);
    console.log('\n💡 The endpoints are only available in development mode for security.');
    console.log('\n📚 Manual installation alternative:');
    console.log(`   1. Install: ${getInstallCommand(packageManager)}`);
    console.log('   2. Update your next.config file with withDevToolsJSON()');
    console.log('\n📚 For more information, visit: https://github.com/bedouijesser/next-plugin-devtools-json');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
