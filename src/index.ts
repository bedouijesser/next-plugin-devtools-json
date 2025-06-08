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
}

function withDevToolsJSON(options: DevToolsJSONOptions = {}) {
  return (nextConfig: NextConfig = {}): NextConfig => {
    // Only enable in development mode
    if (process.env.NODE_ENV !== 'development' || options.enabled === false) {
      return nextConfig;
    }

    const originalWebpack = nextConfig.webpack;

    return {
      ...nextConfig,
      webpack(config: any, context: any) {
        // Set up dev server middleware if we're in dev mode
        if (context.dev && context.isServer) {
          const originalBeforeFiles = config.devServer?.setupMiddlewares;
          config.devServer = config.devServer || {};
          
          config.devServer.setupMiddlewares = (middlewares: any, devServer: any) => {
            if (devServer && devServer.app) {
              const endpoint = options.endpoint || '/.well-known/appspecific/com.chrome.devtools.json';
              
              devServer.app.get(endpoint, (req: any, res: any) => {
                try {
                  const projectRoot = process.cwd();
                  
                  // Simple UUID generation function
                  function generateUUID(): string {
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                      const r = Math.random() * 16 | 0;
                      const v = c === 'x' ? r : (r & 0x3 | 0x8);
                      return v.toString(16);
                    });
                  }

                  function getOrCreateUUID(projectRoot: string): string {
                    const path = require('path');
                    const fs = require('fs');
                    
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

                  const uuid = options.uuid || getOrCreateUUID(projectRoot);

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
              });
            }

            if (originalBeforeFiles) {
              return originalBeforeFiles(middlewares, devServer);
            }
            return middlewares;
          };
        }

        if (originalWebpack) {
          return originalWebpack(config, context);
        }

        return config;
      },
    };
  };
}

export default withDevToolsJSON;
export { DevToolsJSON, DevToolsJSONOptions };
