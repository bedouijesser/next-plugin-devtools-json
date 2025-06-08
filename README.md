# next-plugin-devtools-json

Serves DevTools JSON at `/.well-known/appspecific/com.chrome.devtools.json` during Next.js development.

## Install

```bash
npm install next-plugin-devtools-json
```

## Setup

Run the setup command:

```bash
npx next-plugin-devtools-json
```

Or manually add to `next.config.js`:

```javascript
const withDevToolsJSON = require('next-plugin-devtools-json');

module.exports = withDevToolsJSON()({
  // your config
});
```

## License

MIT
