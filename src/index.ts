import * as http from 'http';
import * as url from 'url';
import * as path from 'path';
import * as fs from 'fs';

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
  port?: number;
}

interface NextConfig {
  [key: string]: any;
  webpack?: (config: any, context: any) => any;
  rewrites?: () => Promise<any> | any;
}

// Global server instance to ensure we only start one
let devToolsServer: any = null;
let serverStarted = false;
let cleanupHandlersRegistered = false;
let cleanupTimeout: NodeJS.Timeout | null = null;
let isCleaningUp = false;

function withDevToolsJSON(nextConfig: NextConfig = {}, options: DevToolsJSONOptions = {}): NextConfig {
  // Only enable in development mode and if not explicitly disabled
  if (process.env.NODE_ENV !== 'development' || options.enabled === false) {
    return nextConfig;
  }

  // Start the DevTools server only once
  if (!devToolsServer && !serverStarted) {
    serverStarted = true;
    startDevToolsServer(options);
  }

  // Return config with optional rewrites for the main endpoint
  const originalRewrites = nextConfig.rewrites;
  const endpoint = options.endpoint || '/__devtools_json';
  const port = options.port || 3001;

  return {
    ...nextConfig,
    async rewrites() {
      const existingRewrites = originalRewrites ? await (typeof originalRewrites === 'function' ? originalRewrites() : originalRewrites) : [];
      
      // Add rewrites for both endpoints to the auxiliary server
      const devToolsRewrites = [
        {
          source: endpoint,
          destination: `http://localhost:${port}${endpoint}`,
        },
        // Also support the traditional Chrome DevTools well-known path
        {
          source: '/.well-known/appspecific/com.chrome.devtools.json',
          destination: `http://localhost:${port}${endpoint}`,
        }
      ];

      // Handle different rewrite structures
      if (Array.isArray(existingRewrites)) {
        return [...devToolsRewrites, ...existingRewrites];
      } else if (existingRewrites && typeof existingRewrites === 'object') {
        return {
          ...existingRewrites,
          beforeFiles: [...devToolsRewrites, ...(existingRewrites.beforeFiles || [])],
        };
      } else {
        return devToolsRewrites;
      }
    },
  };
}

function startDevToolsServer(options: DevToolsJSONOptions = {}) {
  const endpoint = options.endpoint || '/__devtools_json';
  let port = options.port || 3001;

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
        // Silent fallback to generating new UUID
      }
    }

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const uuid = generateUUID();
    fs.writeFileSync(uuidPath, uuid, { encoding: 'utf-8' });
    return uuid;
  }

  function tryStartServer(attempts = 0): void {
    if (attempts > 10) {
      // Silent failure after 10 attempts
      return;
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
          res.statusCode = 500;
          res.end('{}');
        }
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    server.listen(port, 'localhost', () => {
      devToolsServer = server;
      
      // Register cleanup handlers only once
      if (!cleanupHandlersRegistered) {
        cleanupHandlersRegistered = true;
        
        const cleanup = () => {
          // Prevent multiple simultaneous cleanup calls
          if (isCleaningUp || !devToolsServer) {
            return;
          }
          isCleaningUp = true;
          
          // Clear any pending timeout
          if (cleanupTimeout) {
            clearTimeout(cleanupTimeout);
            cleanupTimeout = null;
          }
          
          try {
            // Force close all connections first
            devToolsServer.closeAllConnections?.();
            
            // Close the server with proper callback
            devToolsServer.close((err: Error | undefined) => {
              if (err) {
                // Force kill if graceful close fails
                try {
                  devToolsServer?.destroy?.();
                } catch (destroyError) {
                  // Silent cleanup
                }
              }
              devToolsServer = null;
              serverStarted = false;
              isCleaningUp = false;
            });
            
            // Add a timeout for forceful cleanup
            cleanupTimeout = setTimeout(() => {
              if (devToolsServer) {
                try {
                  devToolsServer.destroy?.();
                  devToolsServer = null;
                  serverStarted = false;
                } catch (error) {
                  // Silent cleanup
                }
              }
              isCleaningUp = false;
              cleanupTimeout = null;
            }, 3000); // 3 second timeout
            
          } catch (error) {
            // Silent cleanup
            devToolsServer = null;
            serverStarted = false;
            isCleaningUp = false;
          }
        };

        // Handle various termination scenarios
        // Note: We don't need to remove these listeners since they're cleaned up
        // automatically when the process exits
        process.on('SIGTERM', cleanup);
        process.on('SIGINT', cleanup);
        process.on('SIGHUP', cleanup);
        process.on('exit', cleanup);
        process.on('beforeExit', cleanup);
        
        // Handle uncaught exceptions and promise rejections
        process.on('uncaughtException', (error) => {
          cleanup();
          // Re-throw after cleanup
          throw error;
        });
        
        process.on('unhandledRejection', (reason, promise) => {
          cleanup();
          // Log but don't crash
          console.error('Unhandled promise rejection:', reason);
        });
      }
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        port++;
        tryStartServer(attempts + 1);
      }
    });
  }

  tryStartServer();
}

// Export cleanup function for external use
function cleanupDevToolsServer() {
  // Prevent multiple simultaneous cleanup calls
  if (isCleaningUp || !devToolsServer) {
    return;
  }
  isCleaningUp = true;
  
  // Clear any pending timeout
  if (cleanupTimeout) {
    clearTimeout(cleanupTimeout);
    cleanupTimeout = null;
  }
  
  try {
    // Force close all connections first
    devToolsServer.closeAllConnections?.();
    
    // Close the server with proper callback
    devToolsServer.close((err: Error | undefined) => {
      if (err) {
        // Force kill if graceful close fails
        try {
          devToolsServer?.destroy?.();
        } catch (destroyError) {
          // Silent cleanup
        }
      }
      devToolsServer = null;
      serverStarted = false;
      cleanupHandlersRegistered = false;
      isCleaningUp = false;
    });
    
    // Add a timeout for forceful cleanup
    cleanupTimeout = setTimeout(() => {
      if (devToolsServer) {
        try {
          devToolsServer.destroy?.();
          devToolsServer = null;
          serverStarted = false;
          cleanupHandlersRegistered = false;
        } catch (error) {
          // Silent cleanup
        }
      }
      isCleaningUp = false;
      cleanupTimeout = null;
    }, 3000); // 3 second timeout
    
  } catch (error) {
    // Silent cleanup
    devToolsServer = null;
    serverStarted = false;
    cleanupHandlersRegistered = false;
    isCleaningUp = false;
  }
}

export default withDevToolsJSON;
export { withDevToolsJSON, DevToolsJSON, DevToolsJSONOptions, cleanupDevToolsServer };
