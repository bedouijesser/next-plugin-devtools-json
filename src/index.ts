interface DevToolsJSON {
  workspace?: {
    root: string;
    uuid: string;
  };
}

interface DevToolsJSONOptions {
  uuid?: string;
  enabled?: boolean;
  endpoint?: string;
}

interface NextConfig {
  [key: string]: any;
  webpack?: (config: any, context: any) => any;
  rewrites?: () => Promise<any> | any;
}

// Global server instance to ensure we only start one
let devToolsServer: any = null;

function withDevToolsJSON(nextConfig: NextConfig = {}, options: DevToolsJSONOptions = {}): NextConfig {
  // Only enable in development mode and if not explicitly disabled
  if (process.env.NODE_ENV !== 'development' || options.enabled === false) {
    return nextConfig;
  }

  // Start the DevTools server only once
  if (!devToolsServer) {
    startDevToolsServer(options);
  }

  // Return config with optional rewrites for the main endpoint
  const originalRewrites = nextConfig.rewrites;
  const endpoint = options.endpoint || '/__devtools_json';

  return {
    ...nextConfig,
    async rewrites() {
      const existingRewrites = originalRewrites ? await (typeof originalRewrites === 'function' ? originalRewrites() : originalRewrites) : [];
      
      // Add rewrite for our DevTools endpoint to the auxiliary server
      const devToolsRewrite = {
        source: endpoint,
        destination: `http://localhost:3001${endpoint}`,
      };

      // Handle different rewrite structures
      if (Array.isArray(existingRewrites)) {
        return [devToolsRewrite, ...existingRewrites];
      } else if (existingRewrites && typeof existingRewrites === 'object') {
        return {
          ...existingRewrites,
          beforeFiles: [devToolsRewrite, ...(existingRewrites.beforeFiles || [])],
        };
      } else {
        return [devToolsRewrite];
      }
    },
  };
}

function startDevToolsServer(options: DevToolsJSONOptions = {}) {
  const http = require('http');
  const url = require('url');
  const path = require('path');
  const fs = require('fs');
  
  const endpoint = options.endpoint || '/__devtools_json';
  const port = 3001;

  // Simple UUID generation function
  function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getOrCreateUUID(projectRoot: string): string {
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
    console.log(`Generated UUID '${uuid}' for DevTools project settings.`);
    return uuid;
  }

  const server = http.createServer((req: any, res: any) => {
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === endpoint) {
      try {
        const projectRoot = process.cwd();
        const uuid = options.uuid || getOrCreateUUID(projectRoot);

        const devtoolsJson = {
          workspace: {
            root: projectRoot,
            uuid,
          },
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.statusCode = 200;
        res.end(JSON.stringify(devtoolsJson, null, 2));
      } catch (error) {
        console.error('Error generating DevTools JSON:', error);
        res.statusCode = 500;
        res.end(JSON.stringify({}));
      }
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  server.listen(port, 'localhost', () => {
    console.log(`🔧 DevTools JSON server running on http://localhost:${port}${endpoint}`);
    devToolsServer = server;
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} is in use. DevTools endpoint may not work correctly.`);
    } else {
      console.error('DevTools server error:', err);
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => server.close());
  process.on('SIGINT', () => server.close());
}

export default withDevToolsJSON;
export { withDevToolsJSON, DevToolsJSON, DevToolsJSONOptions };
