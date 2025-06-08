#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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

  const typeAnnotation = format === 'typescript' ? ': import(\'next\').NextConfig' : '';

  return `${pluginImport}

/** @type {import('next').NextConfig} */
const nextConfig${typeAnnotation} = {
  // Your Next.js config here
};

${exportStatement}`;
}

function updateExistingConfig(filePath, content, format) {
  const pluginImport = format === 'commonjs' 
    ? "const { default: withDevToolsJSON } = require('next-plugin-devtools-json');"
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

  // Check if package is already installed
  const isAlreadyInstalled = packageJson.devDependencies?.['next-plugin-devtools-json'] || 
                             packageJson.dependencies?.['next-plugin-devtools-json'];
  
  if (!isAlreadyInstalled) {
    console.log('📦 Installing next-plugin-devtools-json as dev dependency...');
    try {
      execSync('npm install --save-dev next-plugin-devtools-json', { stdio: 'inherit' });
      console.log('✅ Package installed successfully!');
    } catch (error) {
      console.error('❌ Failed to install package:', error.message);
      process.exit(1);
    }
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
    console.log('\n📖 The DevTools JSON endpoint will be available at:');
    console.log('   /.well-known/appspecific/com.chrome.devtools.json');
    console.log('\n🚀 Start your development server with: npm run dev');
    console.log('\n💡 The endpoint is only available in development mode for security.');
    console.log('\n📚 For more information, visit: https://github.com/bedouijesser/next-plugin-devtools-json');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
