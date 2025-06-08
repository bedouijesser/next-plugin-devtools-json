# next-plugin-devtools-json

A Next.js plugin that provides a plug-and-play solution for serving a Chrome DevTools project settings JSON endpoint at `/.well-known/appspecific/com.chrome.devtools.json`. This plugin uses webpack middleware to serve the endpoint dynamically **without requiring any API route files**.

## ✨ Features

- 🔌 **One-command setup** - Automatic configuration with `npx`
- 🔧 **Auto-config** - Automatically updates your `next.config.js`
- 🔄 **Automatic UUID management** - Generates and persists project UUIDs
- ⚡ **No API routes needed** - Uses webpack middleware for cleaner integration
- 🚫 **No external dependencies** - UUID generation built-in
- 💻 **Dev-only serving** - Endpoint only available in development mode
- 🏗️ **Universal compatibility** - Works with any Next.js project structure
- ⚡ **Zero configuration** - Works out of the box with sensible defaults

## 🚀 Quick Start

### One-command setup (Recommended)

```bash
npx next-plugin-devtools-json
```

**That's it!** This single command will:
- ✅ Automatically add the plugin to your `next.config.js` (or create one)
- ✅ Configure webpack middleware to serve the DevTools JSON endpoint
- ✅ No physical API route files needed - everything is handled in memory

Start your Next.js development server and the endpoint will be available at:
```
/.well-known/appspecific/com.chrome.devtools.json
```

### Manual Installation

If you prefer manual setup:

```bash
npm install next-plugin-devtools-json
```

Then update your `next.config.js`:

```javascript
const withDevToolsJSON = require('next-plugin-devtools-json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // your existing config
};

module.exports = withDevToolsJSON(nextConfig);
```

**No API routes needed!** The plugin handles everything through webpack middleware.

## 📖 How It Works

The plugin uses **webpack development middleware** to serve the DevTools JSON endpoint:

1. **Hooks into webpack dev server** during development
2. **Serves the endpoint directly** via middleware (no physical API files)
3. **Manages UUIDs** automatically in `.next/cache/devtools-uuid.json`
4. **Zero overhead** - only active in development mode
5. **No external dependencies** - uses built-in UUID generation

## 🔧 Configuration

### Basic usage

```javascript
const withDevToolsJSON = require('next-plugin-devtools-json');

module.exports = withDevToolsJSON(nextConfig);
```

### With options

```javascript
const withDevToolsJSON = require('next-plugin-devtools-json');

module.exports = withDevToolsJSON({
  uuid: 'your-custom-uuid', // Optional: provide a custom UUID
  enabled: process.env.NODE_ENV === 'development', // Optional: control when enabled
  endpoint: '/.well-known/appspecific/com.chrome.devtools.json' // Optional: custom endpoint
})(nextConfig);
```

### TypeScript/ESM Configuration

```typescript
import withDevToolsJSON from 'next-plugin-devtools-json';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // your config
};

export default withDevToolsJSON(nextConfig);
```

## 📁 Universal Project Support

The new webpack-based approach works with **any Next.js project structure** automatically:

- ✅ App Router
- ✅ Pages Router  
- ✅ Root directory layout
- ✅ `src/` directory layout
- ✅ TypeScript projects
- ✅ JavaScript projects
- ✅ CommonJS configs
- ✅ ESM configs

**No file structure detection needed** - everything works through webpack middleware!

## 🔍 API Response

The endpoint returns a JSON response with your workspace information:

```json
{
  "workspace": {
    "root": "/path/to/your/project",
    "uuid": "generated-or-custom-uuid"
  }
}
```

## 🛠️ Development

### Building the plugin

```bash
npm run build
```

### Running tests

```bash
npm test
```

## 📋 Requirements

- Next.js 12.0.0 or later
- Node.js 14.0.0 or later

## 🔄 Migrating from Manual Setup

If you previously set up the plugin manually:

1. Run `npx next-plugin-devtools-json` in your project
2. The CLI will detect existing configurations and update them as needed
3. Remove any manual `uuid` dependencies if desired (the plugin includes its own generator)

## 🆚 Comparison

| Feature | Before | After |
|---------|--------|-------|
| Setup steps | 5+ manual steps | 1 command |
| Dependencies | Requires `uuid` package | Zero dependencies |
| Config updates | Manual editing | Automatic |
| Structure detection | Manual | Automatic |
| File creation | Manual | Automatic |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT
- Handle both `app/api/devtools-json/route.js` and `pages/api/devtools-json.js` patterns

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

## Available Commands

The package provides multiple ways to set up the webpack middleware:

### npx next-plugin-devtools-json@latest (Recommended)
```bash
npx next-plugin-devtools-json@latest
```
- ✅ Always uses the latest version
- ✅ No installation required
- ✅ Works immediately in any Next.js project

### npx setup-devtools-json
```bash
npm install next-plugin-devtools-json
npx setup-devtools-json
```
- ✅ Use after installing the package
- ✅ Available as a local command
- ✅ Same functionality as above

Both commands will:
- Detect and update your `next.config.js` (or create one)
- Configure webpack middleware automatically
- No physical files created - everything works in memory

## Troubleshooting

### The endpoint returns 404

1. Make sure you've added the plugin to your `next.config.js`
2. Ensure you're in development mode (`NODE_ENV=development`)
3. Restart your Next.js development server after making configuration changes

### UUID keeps changing

The UUID is stored in `.next/cache/devtools-uuid.json`. If this file gets deleted (e.g., when clearing the Next.js cache), a new UUID will be generated. You can provide a custom UUID in the plugin options to prevent this.

### Not working in production

This is intentional! The plugin is designed for development use only. If you need it in production, set `enabled: true` in the plugin options.

## License

MIT
