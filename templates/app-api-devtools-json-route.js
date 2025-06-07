// Template for App Router API route
// Copy this to: app/api/devtools-json/route.js

import fs from 'fs';
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
  console.log(`Generated UUID '${uuid}' for DevTools project settings.`);
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
}
