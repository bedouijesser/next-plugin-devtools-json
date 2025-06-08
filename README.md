# Next.js Plugin for DevTools Project Settings (devtools.json)

Next.js plugin for generating the Chrome DevTools project settings file on-the-fly during development. This is the Next.js equivalent of [vite-plugin-devtools-json](https://github.com/ChromeDevTools/vite-plugin-devtools-json).

This enables seamless integration with the new Chrome DevTools features:

1. [DevTools Project Settings (devtools.json)](https://goo.gle/devtools-json-design), and
2. [Automatic Workspace folders](http://goo.gle/devtools-automatic-workspace-folders).

## Features

- ✅ **Universal compatibility**: Works with Next.js 12, 13, 14, and 15+
- ✅ **All routing systems**: Supports both `pages/` and `app/` router
- ✅ **All config formats**: JavaScript, TypeScript, CommonJS, and ESM
- ✅ **Monorepo friendly**: Works in monorepo setups
- ✅ **Zero configuration**: Auto-setup with CLI command
- ✅ **Development only**: Only runs during `npm run dev`
- ✅ **No API routes**: Uses Next.js rewrites and standalone server

## Installation

```bash
npm install --save-dev next-plugin-devtools-json
```

## Usage

Run the setup command:

```bash
npx next-plugin-devtools-json
```

Or manually add to your Next.js config:

**next.config.js (CommonJS):**
```javascript
const withDevToolsJSON = require('next-plugin-devtools-json');

const nextConfig = {
  // your config
};

module.exports = withDevToolsJSON(nextConfig);
```

**next.config.mjs (ESM):**
```javascript
import withDevToolsJSON from 'next-plugin-devtools-json';

const nextConfig = {
  // your config
};

export default withDevToolsJSON(nextConfig);
```

## How it works

This plugin runs a standalone HTTP server (on port 3001) during development and adds a Next.js rewrite to proxy the DevTools endpoint (`/__devtools_json`) to the server. This serves the Chrome DevTools project settings JSON file, enabling Chrome DevTools to automatically recognize your local development project and provide enhanced debugging capabilities.

The `/__devtools_json` endpoint serves the project settings as JSON with the following structure:

```json
{
  "workspace": {
    "root": "/path/to/project/root",
    "uuid": "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b"
  }
}
```

Where `root` is the absolute path to your project root folder, and `uuid` is a random v4 UUID, generated the first time you start the Next.js dev server with the plugin installed (it's cached in `.next/cache/` for consistency).

The plugin only runs during development (`npm run dev`) and automatically serves the required endpoint without needing any API routes or additional configuration.

## Chrome DevTools Setup

To enable automatic workspace folder detection in Chrome DevTools:

1. Open Chrome DevTools
2. Go to Settings (F1 or click the gear icon)
3. Navigate to "Workspace" 
4. Enable "Automatically add workspace folders"

Once enabled, Chrome DevTools will automatically detect your Next.js project when you visit `http://localhost:3000` during development.

## Troubleshooting

**Port 3001 already in use?** The plugin will log a warning but continue to work if port 3001 is occupied. You can specify a custom port:

```javascript
module.exports = withDevToolsJSON(nextConfig, { port: 3002 });
```

**Plugin not working?** Make sure you're running in development mode (`NODE_ENV=development` or `npm run dev`) as the plugin is disabled in production for security.

## Options

While the plugin can generate a UUID and save it in `.next/cache/`, you can also specify it in the options:

```javascript
const withDevToolsJSON = require('next-plugin-devtools-json');

module.exports = withDevToolsJSON(nextConfig, {
  uuid: "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b"
});
```

Available options:
- `uuid` - Custom UUID for the workspace (optional, auto-generated if not provided)
- `endpoint` - Custom endpoint path (optional, defaults to `/__devtools_json`)
- `enabled` - Explicitly enable/disable the plugin (optional, defaults to `true` in development)
- `port` - Custom port for the DevTools server (optional, defaults to `3001`)

## Inspiration

This plugin is inspired by and serves as the Next.js equivalent of [vite-plugin-devtools-json](https://github.com/ChromeDevTools/vite-plugin-devtools-json).

## License

MIT
