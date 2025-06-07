const ENDPOINT = '/.well-known/appspecific/com.chrome.devtools.json';

function withDevToolsJSON(options = {}) {
  return (nextConfig = {}) => {
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
              beforeFiles: [...(originalResult.beforeFiles || []), ...rewrites],
              afterFiles: originalResult.afterFiles || [],
              fallback: originalResult.fallback || [],
            };
          }
        } else if (originalRewrites && typeof originalRewrites === 'object') {
          return {
            beforeFiles: [...(originalRewrites.beforeFiles || []), ...rewrites],
            afterFiles: originalRewrites.afterFiles || [],
            fallback: originalRewrites.fallback || [],
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

module.exports = withDevToolsJSON;
module.exports.default = withDevToolsJSON;
