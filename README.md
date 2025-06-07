# Next.js Plugin for DevTools Project Settings (devtools.json)

Next.js plugin for generating the Chrome DevTools project settings file on-the-fly in the dev server.

This enables seamless integration with the new Chrome DevTools features:

- **DevTools Project Settings (devtools.json)**, and
- **Automatic Workspace folders**.

## Installation

```bash
npm install -D next-plugin-devtools-json
```

## Usage

Add it to your Next.js config (`next.config.js`):

```javascript
const withDevToolsJSON = require('next-plugin-devtools-json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // your existing config
};

module.exports = withDevToolsJSON()(nextConfig);
```

Or with ES modules (`next.config.mjs`):

```javascript
import withDevToolsJSON from 'next-plugin-devtools-json';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // your existing config
};

export default withDevToolsJSON()(nextConfig);
```

While the plugin can generate a UUID and save it in Next.js cache, you can also specify it in the options like in the following:

```javascript
module.exports = withDevToolsJSON({ 
  uuid: "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b" 
})(nextConfig);
```

### API Route Setup

The plugin requires an API route to handle the DevTools JSON endpoint. You can set this up manually or use our CLI tool:

#### Automatic Setup (Recommended)

```bash
npx setup-devtools-json
```

This will automatically detect your Next.js structure (Pages Router vs App Router) and create the appropriate API route.

#### Manual Setup

**For Pages Router**, create `pages/api/devtools-json.js`:

```javascript
import fs from 'fs';
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
}
```

**For App Router**, create `app/api/devtools-json/route.js`:

```javascript
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
}
```

Don't forget to install the `uuid` dependency:

```bash
npm install uuid
```

The `/.well-known/appspecific/com.chrome.devtools.json` endpoint will serve the project settings as JSON with the following structure:

```json
{
  "workspace": {
    "root": "/path/to/project/root",
    "uuid": "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b"
  }
}
```

where `root` is the absolute path to your project root folder, and `uuid` is a random v4 UUID, generated the first time that you start the Next.js dev server with the plugin installed (it is henceforth cached in the Next.js cache folder).

## Configuration Options

You can customize the plugin behavior:

```javascript
const withDevToolsJSON = require('next-plugin-devtools-json');

module.exports = withDevToolsJSON({
  uuid: 'custom-uuid-here', // Optional: provide a custom UUID
  enabled: process.env.NODE_ENV === 'development', // Optional: control when enabled
})(nextConfig);
```

### Options

- **`uuid`** (string, optional): Provide a custom UUID instead of auto-generating one
- **`enabled`** (boolean, optional): Control when the plugin is active (defaults to development mode only)

## Troubleshooting

### The endpoint returns 404

1. Make sure you've added the plugin to your `next.config.js`
2. Ensure you've created the API route file in the correct location
3. Restart your Next.js development server after making configuration changes

### UUID keeps changing

The UUID is stored in `.next/cache/devtools-uuid.json`. If this file gets deleted (e.g., when clearing the Next.js cache), a new UUID will be generated. You can provide a custom UUID in the plugin options to prevent this.

### Not working in production

This is intentional! The plugin is designed for development use only. If you need it in production, set `enabled: true` in the plugin options.

## License

MIT
