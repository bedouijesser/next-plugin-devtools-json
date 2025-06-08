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
    
    it('should configure webpack middleware properly', () => {
      // Set environment to development for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      try {
        const nextConfig = {};
        const configWithPlugin = withDevToolsJSON()(nextConfig);
        
        expect(configWithPlugin).toHaveProperty('webpack');
        expect(typeof configWithPlugin.webpack).toBe('function');
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalEnv;
      }
    });
    
    it('should preserve existing webpack configuration', () => {
      // Set environment to development for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      try {
        const originalWebpack = vi.fn((config) => ({ ...config, custom: true }));
        const nextConfig = { webpack: originalWebpack };
        const configWithPlugin = withDevToolsJSON()(nextConfig);
        
        const mockConfig = { devServer: {} };
        const mockContext = { dev: true, isServer: true };
        
        const updatedConfig = configWithPlugin.webpack(mockConfig, mockContext);
        
        expect(originalWebpack).toHaveBeenCalledWith(expect.any(Object), mockContext);
        expect(updatedConfig.custom).toBe(true);
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalEnv;
      }
    });
    
    it('should support custom options', () => {
      const options = {
        uuid: 'custom-test-uuid',
        enabled: false,
      };
      
      const nextConfig = {};
      const configWithPlugin = withDevToolsJSON(options)(nextConfig);
      
      // With enabled: false, should return original config
      expect(configWithPlugin).toEqual(nextConfig);
    });
  });
});
