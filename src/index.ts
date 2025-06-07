interface DevToolsJSON {
  workspace?: {
    root: string;
    uuid: string;
  };
}

interface DevToolsJSONOptions {
  uuid?: string;
  enabled?: boolean;
}

interface NextConfig {
  [key: string]: any;
}

const ENDPOINT = '/.well-known/appspecific/com.chrome.devtools.json';

function withDevToolsJSON(options: DevToolsJSONOptions = {}) {
  return (nextConfig: NextConfig = {}): NextConfig => {
    const originalRewrites = nextConfig.rewrites;

    return {
      ...nextConfig,
      async rewrites() {
        const rewrites = [
          {
            source: ENDPOINT,
            destination: '/api/devtools-json',
          },
        ];

        if (typeof originalRewrites === 'function') {
          const originalResult = await originalRewrites();
          if (originalResult && typeof originalResult === 'object') {
            return {
              beforeFiles: [...((originalResult as any).beforeFiles || []), ...rewrites],
              afterFiles: (originalResult as any).afterFiles || [],
              fallback: (originalResult as any).fallback || [],
            };
          }
        } else if (originalRewrites && typeof originalRewrites === 'object') {
          return {
            beforeFiles: [...((originalRewrites as any).beforeFiles || []), ...rewrites],
            afterFiles: (originalRewrites as any).afterFiles || [],
            fallback: (originalRewrites as any).fallback || [],
          };
        }

        return {
          beforeFiles: rewrites,
          afterFiles: [],
          fallback: [],
        };
      },
    };
  };
}

export default withDevToolsJSON;
export { DevToolsJSON, DevToolsJSONOptions };
