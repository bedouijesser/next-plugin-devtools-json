#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Simplified API templates without external uuid dependency
const PAGES_API_TEMPLATE = `import fs from 'fs';
import path from 'path';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getOrCreateUUID(projectRoot) {
  const cacheDir = path.resolve(projectRoot, '.next', 'cache');
  const uuidPath = path.resolve(cacheDir, 'devtools-uuid.json');

  if (fs.existsSync(uuidPath)) {
    try {
      const uuidContent = fs.readFileSync(uuidPath, { encoding: 'utf-8' });
      const uuid = uuidContent.trim();
      if (uuid.length === 36 && uuid.split('-').length === 5) {
        return uuid;
      }
    } catch (error) {
      console.warn('Failed to read existing UUID, generating new one:', error);
    }
  }

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const uuid = generateUUID();
  fs.writeFileSync(uuidPath, uuid, { encoding: 'utf-8' });
  console.log('Generated UUID \\'' + uuid + '\\' for DevTools project settings.');
  return uuid;
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end('Method ' + req.method + ' Not Allowed');
    return;
  }

  try {
    const projectRoot = process.cwd();
    const uuid = getOrCreateUUID(projectRoot);

    const devtoolsJson = {
      workspace: {
        root: projectRoot,
        uuid,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(devtoolsJson);
  } catch (error) {
    console.error('Error generating DevTools JSON:', error);
    res.status(500).json({});
  }
}`;

const APP_API_TEMPLATE = `import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getOrCreateUUID(projectRoot) {
  const cacheDir = path.resolve(projectRoot, '.next', 'cache');
  const uuidPath = path.resolve(cacheDir, 'devtools-uuid.json');

  if (fs.existsSync(uuidPath)) {
    try {
      const uuidContent = fs.readFileSync(uuidPath, { encoding: 'utf-8' });
      const uuid = uuidContent.trim();
      if (uuid.length === 36 && uuid.split('-').length === 5) {
        return uuid;
      }
    } catch (error) {
      console.warn('Failed to read existing UUID, generating new one:', error);
    }
  }

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const uuid = generateUUID();
  fs.writeFileSync(uuidPath, uuid, { encoding: 'utf-8' });
  console.log('Generated UUID \\'' + uuid + '\\' for DevTools project settings.');
  return uuid;
}

export async function GET() {
  try {
    const projectRoot = process.cwd();
    const uuid = getOrCreateUUID(projectRoot);

    const devtoolsJson = {
      workspace: {
        root: projectRoot,
        uuid,
      },
    };

    return NextResponse.json(devtoolsJson, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error generating DevTools JSON:', error);
    return NextResponse.json({}, { status: 500 });
  }
}`;

function detectNextJsStructure() {
  const cwd = process.cwd();
  
  // Check for app directory (App Router) - both root and src structure
  if (fs.existsSync(path.join(cwd, 'app')) || fs.existsSync(path.join(cwd, 'src', 'app'))) {
    return 'app';
  }
  
  // Check for pages directory (Pages Router) - both root and src structure
  if (fs.existsSync(path.join(cwd, 'pages')) || fs.existsSync(path.join(cwd, 'src', 'pages'))) {
    return 'pages';
  }
  
  return null;
}

function createApiRoute() {
  const routerType = detectNextJsStructure();
  
  if (!routerType) {
    console.error('❌ Could not detect Next.js structure. Please make sure you are in a Next.js project directory.');
    process.exit(1);
  }
  
  if (routerType === 'pages') {
    // Determine if using src structure
    const pagesDir = fs.existsSync(path.join(process.cwd(), 'src', 'pages')) 
      ? path.join(process.cwd(), 'src', 'pages')
      : path.join(process.cwd(), 'pages');
    
    const apiDir = path.join(pagesDir, 'api');
    const filePath = path.join(apiDir, 'devtools-json.js');
    
    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
    }
    
    if (fs.existsSync(filePath)) {
      console.log('⚠️  API route already exists at ' + path.relative(process.cwd(), filePath));
      return filePath;
    }
    
    fs.writeFileSync(filePath, PAGES_API_TEMPLATE);
    console.log('✅ Created API route at ' + path.relative(process.cwd(), filePath));
    return filePath;
    
  } else if (routerType === 'app') {
    // Determine if using src structure
    const appDir = fs.existsSync(path.join(process.cwd(), 'src', 'app'))
      ? path.join(process.cwd(), 'src', 'app')
      : path.join(process.cwd(), 'app');
    
    const apiDir = path.join(appDir, 'api', 'devtools-json');
    const filePath = path.join(apiDir, 'route.js');
    
    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
    }
    
    if (fs.existsSync(filePath)) {
      console.log('⚠️  API route already exists at ' + path.relative(process.cwd(), filePath));
      return filePath;
    }
    
    fs.writeFileSync(filePath, APP_API_TEMPLATE);
    console.log('✅ Created API route at ' + path.relative(process.cwd(), filePath));
    return filePath;
  }
}

function findNextConfigFile() {
  const cwd = process.cwd();
  const possibleConfigs = [
    'next.config.js',
    'next.config.mjs', 
    'next.config.ts',
    'next.config.cjs'
  ];
  
  for (const config of possibleConfigs) {
    const configPath = path.join(cwd, config);
    if (fs.existsSync(configPath)) {
      return { path: configPath, name: config };
    }
  }
  
  return null;
}

function updateNextConfig() {
  const configFile = findNextConfigFile();
  
  if (!configFile) {
    console.log('⚠️  No next.config.js found. Creating one...');
    const defaultConfig = `const withDevToolsJSON = require('next-plugin-devtools-json');

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = withDevToolsJSON()(nextConfig);
`;
    fs.writeFileSync(path.join(process.cwd(), 'next.config.js'), defaultConfig);
    console.log('✅ Created next.config.js with DevTools JSON plugin');
    return;
  }
  
  const configPath = configFile.path;
  const configContent = fs.readFileSync(configPath, 'utf-8');
  
  // Check if plugin is already added
  if (configContent.includes('next-plugin-devtools-json') || configContent.includes('withDevToolsJSON')) {
    console.log('⚠️  Plugin already configured in next.config');
    return;
  }
  
  // Determine if it's TypeScript or JavaScript
  const isTypeScript = configFile.name.endsWith('.ts');
  const isESM = configFile.name.endsWith('.mjs') || configContent.includes('import ') || configContent.includes('export ');
  
  let newConfigContent;
  
  if (isESM) {
    // Handle ES modules
    const importLine = "import withDevToolsJSON from 'next-plugin-devtools-json';\n";
    
    if (configContent.includes('export default')) {
      // Handle different export default patterns
      if (configContent.match(/export\s+default\s+\w+\s*;?\s*$/m)) {
        // Pattern: export default variableName;
        newConfigContent = importLine + configContent.replace(
          /export\s+default\s+(\w+)\s*;?\s*$/m,
          'export default withDevToolsJSON()($1);'
        );
      } else {
        // Pattern: export default { ... } or other inline exports
        newConfigContent = importLine + configContent.replace(
          /export\s+default\s+([^;]+);?/,
          'export default withDevToolsJSON()($1);'
        );
      }
    } else {
      // Fallback - add at the end
      newConfigContent = importLine + configContent + '\n\nexport default withDevToolsJSON()(nextConfig);';
    }
  } else {
    // Handle CommonJS
    const requireLine = "const withDevToolsJSON = require('next-plugin-devtools-json');\n";
    
    if (configContent.includes('module.exports')) {
      // Handle different module.exports patterns
      if (configContent.match(/module\.exports\s*=\s*\w+\s*;?\s*$/m)) {
        // Pattern: module.exports = variableName;
        newConfigContent = requireLine + configContent.replace(
          /module\.exports\s*=\s*(\w+)\s*;?\s*$/m,
          'module.exports = withDevToolsJSON()($1);'
        );
      } else {
        // Pattern: module.exports = { ... } or other inline exports
        newConfigContent = requireLine + configContent.replace(
          /module\.exports\s*=\s*([^;]+);?/,
          'module.exports = withDevToolsJSON()($1);'
        );
      }
    } else {
      // Fallback - add at the end
      newConfigContent = requireLine + configContent + '\n\nmodule.exports = withDevToolsJSON()(nextConfig);';
    }
  }
  
  // Write back the updated config
  fs.writeFileSync(configPath, newConfigContent);
  console.log('✅ Updated ' + configFile.name + ' to include DevTools JSON plugin');
}

function main() {
  console.log('🔧 Setting up Next.js DevTools JSON plugin...');
  
  // Step 1: Create API route
  const apiRoutePath = createApiRoute();
  
  // Step 2: Update next.config.js
  updateNextConfig();
  
  console.log('\n✨ Setup complete! Your DevTools JSON endpoint will be available at:');
  console.log('   /.well-known/appspecific/com.chrome.devtools.json');
  console.log('\n📝 What was configured:');
  console.log('✅ API route created (no external dependencies needed)');
  console.log('✅ Next.js config updated with plugin');
  console.log('\n🚀 Start your Next.js development server to test the endpoint!');
}

// Run the main function since this is a CLI script
main();
