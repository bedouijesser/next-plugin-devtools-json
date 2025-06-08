# next-plugin-devtools-json

Serves DevTools JSON at `/.well-known/appspecific/com.chrome.devtools.json` during Next.js development using webpack middleware.

## Install

```bash
npm install --save-dev next-plugin-devtools-json
```

## How it works

This plugin adds a webpack middleware to your Next.js development server that serves a special JSON file at `/.well-known/appspecific/com.chrome.devtools.json`. This file tells Chrome DevTools where to find your local development server, enabling features like:

- Live editing of CSS and JavaScript
- Hot reload integration
- Remote debugging capabilities
- Network inspection of your local app

The plugin only runs during development (`npm run dev`) and automatically serves the required endpoint without needing any API routes or additional configuration.

## Setup

Run the setup command:

```bash
npx next-plugin-devtools-json
```

Or manually add to `next.config.js`:

```javascript
const withDevToolsJSON = require('next-plugin-devtools-json');

module.exports = process.env.NODE_ENV === 'development' 
  ? withDevToolsJSON({
      // your config
    })
  : {
      // your config
    };
```

Or `next.config.mjs`:

```javascript
import withDevToolsJSON from 'next-plugin-devtools-json';

export default process.env.NODE_ENV === 'development'
  ? withDevToolsJSON({
      // your config
    })
  : {
      // your config
    };
```

## License

MIT
