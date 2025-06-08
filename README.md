# Next.js Plugin for DevTools Project Settings (devtools.json)

[![npm version](https://badge.fury.io/js/next-plugin-devtools-json.svg)](https://badge.fury.io/js/next-plugin-devtools-json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Next.js plugin for generating the Chrome DevTools project settings file on-the-fly during development. This is the Next.js equivalent of [vite-plugin-devtools-json](https://github.com/ChromeDevTools/vite-plugin-devtools-json).

This enables seamless integration with the new Chrome DevTools features:

1. [DevTools Project Settings (devtools.json)](https://goo.gle/devtools-json-design), and
2. [Automatic Workspace folders](http://goo.gle/devtools-automatic-workspace-folders).

## Features

- ✅ **Universal compatibility**: Works with Next.js 12, 13, 14, and 15+
- ✅ **All routing systems**: Supports both `pages/` and `app/` router
- ✅ **All config formats**: JavaScript, TypeScript, CommonJS, and ESM
- ✅ **All package managers**: npm, yarn, pnpm, and bun support
- ✅ **Monorepo friendly**: Works in monorepo setups
- ✅ **Zero configuration**: Auto-setup with CLI command
- ✅ **Development only**: Only runs during `npm run dev`
- ✅ **No API routes**: Uses Next.js rewrites and standalone server
- ✅ **Robust cleanup**: Ensures no lingering processes after shutdown

## Installation & Setup

### Automatic Setup (Recommended)

Run the setup command in your Next.js project:

```bash
npx next-plugin-devtools-json
```

This will:
- ✅ Auto-detect your package manager (npm, yarn, pnpm, bun)
- ✅ Install the plugin as a dev dependency 
- ✅ Update/create your next.config file with the plugin
- ✅ Handle all config formats (CommonJS, ESM, TypeScript)
- ✅ Configure both required DevTools endpoints

**Works with all Next.js project types:**
- Next.js 12+ with Pages Router
- Next.js 13+ with App Router  
- TypeScript and JavaScript projects
- Monorepo setups

### Manual Installation

If you prefer manual setup:

1. **Install the package:**
```bash
# npm
npm install --save-dev next-plugin-devtools-json

# yarn  
yarn add --dev next-plugin-devtools-json

# pnpm
pnpm add --save-dev next-plugin-devtools-json

# bun
bun add --dev next-plugin-devtools-json
```

2. **Add to your Next.js config:**

**next.config.js (CommonJS):**
```javascript
const withDevToolsJSON = require('next-plugin-devtools-json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // your config
};

module.exports = withDevToolsJSON(nextConfig);
```

**next.config.mjs (ESM):**
```javascript
import withDevToolsJSON from 'next-plugin-devtools-json';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // your config
};

export default withDevToolsJSON(nextConfig);
```

## How it works

This plugin runs a standalone HTTP server (on port 3001) during development and adds Next.js rewrites to proxy the DevTools endpoints to the server. This approach ensures compatibility with both Webpack and Turbopack while providing a truly plug-and-play experience without generating any files in your project.

The plugin serves the Chrome DevTools project settings JSON file at the well-known path (`/.well-known/appspecific/com.chrome.devtools.json`) as required by the [Chrome DevTools specification](https://goo.gle/devtools-json-design), enabling Chrome DevTools to automatically recognize your local development project.

**Endpoints available:**
- `/.well-known/appspecific/com.chrome.devtools.json` (Chrome DevTools standard)
- `/__devtools_json` (alternative endpoint)

The endpoint serves the project settings as JSON with the following structure:

```json
{
  "workspace": {
    "root": "/path/to/project/root",
    "uuid": "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b"
  }
}
```

Where `root` is the absolute path to your project root folder, and `uuid` is a random v4 UUID, generated the first time you start the Next.js dev server with the plugin installed (it's cached in `.next/cache/` for consistency).

**Why not a pure Next.js solution?**

We investigated using API routes, middleware, or static files, but each approach has significant limitations:
- **API routes**: Would require generating files in your project (not plug-and-play)
- **Middleware**: Limited to Edge runtime (no file system access for UUID persistence)
- **Static files**: Cannot generate dynamic content (workspace paths, UUIDs)

Our standalone server approach provides the best balance of plug-and-play setup, universal compatibility (Webpack + Turbopack), and reliable functionality. See [`docs/INVESTIGATION.md`](docs/INVESTIGATION.md) for detailed analysis.

## Chrome DevTools Setup

To enable automatic workspace folder detection in Chrome DevTools:

1. Open Chrome DevTools
2. Go to Settings (F1 or click the gear icon)
3. Navigate to "Workspace" 
4. Enable "Automatically add workspace folders"

Once enabled, Chrome DevTools will automatically detect your Next.js project when you visit `http://localhost:3000` during development.

## Verification

To verify the plugin is working correctly:

1. **Start your Next.js dev server:**
   ```bash
   npm run dev
   ```

2. **Check the endpoints are responding:**
   - Visit `http://localhost:3000/__devtools_json`
   - Visit `http://localhost:3000/.well-known/appspecific/com.chrome.devtools.json`
   
   Both should return a JSON response like:
   ```json
   {
     "workspace": {
       "root": "/path/to/your/project",
       "uuid": "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b"
     }
   }
   ```

3. **Check Chrome DevTools console:**
   - Open DevTools while visiting your Next.js app
   - Look for automatic workspace detection messages

## Troubleshooting

### Common Issues

**Plugin not working?** 
- Ensure you're running in development mode (`NODE_ENV=development` or `npm run dev`) 
- The plugin is disabled in production for security

**Port 3001 already in use?** 
- The plugin will log a warning but continue to work
- You can specify a custom port (see Options section below)

**Setup command not working?**
- Make sure you're in a Next.js project root (contains `package.json` with Next.js dependency)
- The setup command auto-detects your package manager and config format

**TypeScript config issues?**
- Use `.js` extension for Next.js config files (Next.js doesn't support `.ts` config files)
- The setup command handles this automatically

**Monorepo setup?**
- Run the setup command in each Next.js app directory
- The plugin works independently in each package

### Debugging

To enable debug output, set the environment variable:
```bash
DEBUG=next-plugin-devtools-json npm run dev
```

## Options

The plugin accepts optional configuration:

```javascript
const withDevToolsJSON = require('next-plugin-devtools-json');

module.exports = withDevToolsJSON(nextConfig, {
  uuid: "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b", // Custom UUID
  port: 3002,                                   // Custom port
  endpoint: "/__devtools_json",                 // Custom endpoint
  enabled: true                                 // Explicitly enable/disable
});
```

**Available options:**
- `uuid` - Custom UUID for the workspace (optional, auto-generated if not provided)
- `port` - Custom port for the DevTools server (optional, defaults to `3001`)
- `endpoint` - Custom endpoint path (optional, defaults to `/__devtools_json`)
- `enabled` - Explicitly enable/disable the plugin (optional, defaults to `true` in development)

## Architecture

**Why an extra server?** This approach ensures compatibility with both Webpack and Turbopack while avoiding file generation in your project. See our [investigation](docs/INVESTIGATION.md) for details on why pure Next.js solutions aren't feasible.

## Inspiration

This plugin is inspired by and serves as the Next.js equivalent of [vite-plugin-devtools-json](https://github.com/ChromeDevTools/vite-plugin-devtools-json).

## Contributing

Contributions are welcome! The project includes comprehensive tests:

```bash
# Run all tests
npm run test:all

# Run individual test suites
npm test                    # Unit tests
npm run test:quick         # Quick integration test
npm run test:compatibility # Full compatibility tests
```

The test suite verifies compatibility across:
- Next.js 12, 13, 14, and 15+
- CommonJS, ESM, and TypeScript configurations
- Pages Router and App Router
- All package managers

## License

MIT
