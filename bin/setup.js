#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const PAGES_API_TEMPLATE = `import fs from 'fs';
import path from 'path';
import { v4, validate } from 'uuid';

async function getOrCreateUUID(projectRoot, providedUuid) {
  if (providedUuid) {
    return providedUuid;
  }

  const cacheDir = path.resolve(projectRoot, '.next', 'cache');
  const uuidPath = path.resolve(cacheDir, 'devtools-uuid.json');

  if (fs.existsSync(uuidPath)) {
    try {
      const uuidContent = fs.readFileSync(uuidPath, { encoding: 'utf-8' });
      const uuid = uuidContent.trim();
      if (validate(uuid)) {
        return uuid;
      }
    } catch (error) {
      console.warn('Failed to read existing UUID, generating new one:', error);
    }
  }

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const uuid = v4();
  fs.writeFileSync(uuidPath, uuid, { encoding: 'utf-8' });
  console.log(\`Generated UUID '\${uuid}' for DevTools project settings.\`);
  return uuid;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(\`Method \${req.method} Not Allowed\`);
    return;
  }

  try {
    const projectRoot = process.cwd();
    const uuid = await getOrCreateUUID(projectRoot);

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
import { v4, validate } from 'uuid';
import { NextResponse } from 'next/server';

async function getOrCreateUUID(projectRoot, providedUuid) {
  if (providedUuid) {
    return providedUuid;
  }

  const cacheDir = path.resolve(projectRoot, '.next', 'cache');
  const uuidPath = path.resolve(cacheDir, 'devtools-uuid.json');

  if (fs.existsSync(uuidPath)) {
    try {
      const uuidContent = fs.readFileSync(uuidPath, { encoding: 'utf-8' });
      const uuid = uuidContent.trim();
      if (validate(uuid)) {
        return uuid;
      }
    } catch (error) {
      console.warn('Failed to read existing UUID, generating new one:', error);
    }
  }

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const uuid = v4();
  fs.writeFileSync(uuidPath, uuid, { encoding: 'utf-8' });
  console.log(\`Generated UUID '\${uuid}' for DevTools project settings.\`);
  return uuid;
}

export async function GET() {
  try {
    const projectRoot = process.cwd();
    const uuid = await getOrCreateUUID(projectRoot);

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
      console.log(`⚠️  API route already exists at ${path.relative(process.cwd(), filePath)}`);
      return;
    }
    
    fs.writeFileSync(filePath, PAGES_API_TEMPLATE);
    console.log(`✅ Created API route at ${path.relative(process.cwd(), filePath)}`);
    
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
      console.log(`⚠️  API route already exists at ${path.relative(process.cwd(), filePath)}`);
      return;
    }
    
    fs.writeFileSync(filePath, APP_API_TEMPLATE);
    console.log(`✅ Created API route at ${path.relative(process.cwd(), filePath)}`);
  }
}

function main() {
  console.log('🔧 Setting up Next.js DevTools JSON plugin...');
  createApiRoute();
  console.log('\\n📝 Next steps:');
  console.log('1. Add the plugin to your next.config.js:');
  console.log('   const withDevToolsJSON = require("next-plugin-devtools-json");');
  console.log('   module.exports = withDevToolsJSON()(nextConfig);');
  console.log('\\n2. Install the uuid dependency if not already installed:');
  console.log('   npm install uuid');
  console.log('\\n✨ Setup complete! Your DevTools JSON endpoint will be available at:');
  console.log('   /.well-known/appspecific/com.chrome.devtools.json');
}

// Run the main function since this is a CLI script
main();
