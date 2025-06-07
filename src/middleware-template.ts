import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// UUID management utility
function getOrCreateUUID(projectRoot: string): string {
  const cacheDir = path.resolve(projectRoot, '.next', 'cache');
  const uuidPath = path.resolve(cacheDir, 'devtools-uuid.json');

  if (fs.existsSync(uuidPath)) {
    try {
      const uuidContent = fs.readFileSync(uuidPath, { encoding: 'utf-8' });
      const uuid = uuidContent.trim();
      // Basic UUID validation (36 chars with 4 hyphens)
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

  // Generate UUID without external dependency
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  
  fs.writeFileSync(uuidPath, uuid, { encoding: 'utf-8' });
  console.log(`Generated UUID '${uuid}' for DevTools project settings.`);
  return uuid;
}

export function middleware(request: NextRequest) {
  // Handle DevTools JSON endpoint
  if (request.nextUrl.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
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
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/.well-known/appspecific/com.chrome.devtools.json',
};
