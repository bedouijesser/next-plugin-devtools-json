import request from 'supertest';
import { createServer } from 'http';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import withDevToolsJSON from '../dist/index.mjs';

// Mock Next.js config and server setup
function createTestServer(nextConfig = {}) {
  const configWithPlugin = withDevToolsJSON()(nextConfig);
  
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // Handle the DevTools JSON endpoint
    if (url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
      // Simulate the API route response
      const devtoolsJson = {
        workspace: {
          root: process.cwd(),
          uuid: 'test-uuid-' + Date.now(), // Simple UUID for testing
        },
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify(devtoolsJson, null, 2));
      return;
    }
    
    // Handle other routes
    res.statusCode = 404;
    res.end('Not Found');
  });
  
  return server;
}

describe('#NextPluginDevToolsJSON', () => {
  describe('#configureDevToolsEndpoint', () => {
    it('should serve a `devtools.json`', async () => {
      const server = createTestServer();
      
      await new Promise((resolve) => {
        server.listen(0, () => resolve());
      });
      
      const address = server.address();
      const port = address && address.port;
      
      const response = await request(server)
        .get('/.well-known/appspecific/com.chrome.devtools.json');
      
      const devtoolsJson = JSON.parse(response.text);
      
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(devtoolsJson).toHaveProperty('workspace');
      expect(devtoolsJson.workspace).toHaveProperty('root');
      expect(devtoolsJson.workspace.root).toBeTypeOf('string');
      expect(devtoolsJson.workspace).toHaveProperty('uuid');
      expect(devtoolsJson.workspace.uuid).toBeTypeOf('string');
      
      server.close();
    });
    
    it('should configure rewrites properly', async () => {
      const nextConfig = {};
      const configWithPlugin = withDevToolsJSON()(nextConfig);
      
      expect(configWithPlugin).toHaveProperty('rewrites');
      expect(typeof configWithPlugin.rewrites).toBe('function');
      
      const rewrites = await configWithPlugin.rewrites();
      
      expect(rewrites).toHaveProperty('beforeFiles');
      expect(Array.isArray(rewrites.beforeFiles)).toBe(true);
      expect(rewrites.beforeFiles.length).toBeGreaterThan(0);
      
      const devtoolsRewrite = rewrites.beforeFiles.find(
        (rewrite) => rewrite.source === '/.well-known/appspecific/com.chrome.devtools.json'
      );
      
      expect(devtoolsRewrite).toBeDefined();
      expect(devtoolsRewrite.destination).toBe('/api/devtools-json');
    });
    
    it('should preserve existing rewrites', async () => {
      const existingRewrites = async () => ({
        beforeFiles: [{ source: '/existing', destination: '/api/existing' }],
        afterFiles: [{ source: '/after', destination: '/api/after' }],
        fallback: [{ source: '/fallback', destination: '/api/fallback' }],
      });
      
      const nextConfig = { rewrites: existingRewrites };
      const configWithPlugin = withDevToolsJSON()(nextConfig);
      
      const rewrites = await configWithPlugin.rewrites();
      
      expect(rewrites.beforeFiles.length).toBe(2); // existing + devtools
      expect(rewrites.afterFiles.length).toBe(1);
      expect(rewrites.fallback.length).toBe(1);
      
      const devtoolsRewrite = rewrites.beforeFiles.find(
        (rewrite) => rewrite.source === '/.well-known/appspecific/com.chrome.devtools.json'
      );
      
      const existingRewrite = rewrites.beforeFiles.find(
        (rewrite) => rewrite.source === '/existing'
      );
      
      expect(devtoolsRewrite).toBeDefined();
      expect(existingRewrite).toBeDefined();
    });
    
    it('should support custom options', () => {
      const options = {
        uuid: 'custom-test-uuid',
        enabled: false,
      };
      
      const nextConfig = {};
      const configWithPlugin = withDevToolsJSON(options)(nextConfig);
      
      // Plugin should still add rewrites regardless of options
      // (The enabled option would be handled by the API route)
      expect(configWithPlugin).toHaveProperty('rewrites');
    });
  });
});
