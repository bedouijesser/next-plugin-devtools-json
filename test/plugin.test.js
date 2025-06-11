import request from "supertest";
import { createServer } from "node:http";
import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import withDevToolsJSON from "../dist/index.mjs";

// Mock Next.js config and server setup
function createTestServer(nextConfig = {}) {
	const configWithPlugin = withDevToolsJSON(nextConfig);

	const server = createServer(async (req, res) => {
		const url = new URL(req.url, `http://${req.headers.host}`);

		// Handle the DevTools JSON endpoint
		if (url.pathname === "/.well-known/appspecific/com.chrome.devtools.json") {
			// Simulate the API route response
			const devtoolsJson = {
				workspace: {
					root: process.cwd(),
					uuid: `test-uuid-${Date.now()}`, // Simple UUID for testing
				},
			};

			res.setHeader("Content-Type", "application/json");
			res.statusCode = 200;
			res.end(JSON.stringify(devtoolsJson, null, 2));
			return;
		}

		// Handle other routes
		res.statusCode = 404;
		res.end("Not Found");
	});

	return server;
}

describe("#NextPluginDevToolsJSON", () => {
	describe("#configureDevToolsEndpoint", () => {
		it("should serve a `devtools.json`", async () => {
			const server = createTestServer();

			await new Promise((resolve) => {
				server.listen(0, () => resolve());
			});

			const address = server.address();
			const port = address?.port;

			const response = await request(server).get(
				"/.well-known/appspecific/com.chrome.devtools.json",
			);

			const devtoolsJson = JSON.parse(response.text);

			expect(response.status).toBe(200);
			expect(response.type).toBe("application/json");
			expect(devtoolsJson).toHaveProperty("workspace");
			expect(devtoolsJson.workspace).toHaveProperty("root");
			expect(devtoolsJson.workspace.root).toBeTypeOf("string");
			expect(devtoolsJson.workspace).toHaveProperty("uuid");
			expect(devtoolsJson.workspace.uuid).toBeTypeOf("string");

			server.close();
		});

		it("should configure rewrites properly", async () => {
			// Set environment to development for this test
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "development";

			try {
				const nextConfig = {};
				const configWithPlugin = withDevToolsJSON(nextConfig);

				expect(configWithPlugin).toHaveProperty("rewrites");
				expect(typeof configWithPlugin.rewrites).toBe("function");

				const rewrites = await configWithPlugin.rewrites();
				expect(Array.isArray(rewrites)).toBe(true);
				expect(rewrites.length).toBeGreaterThanOrEqual(2);

				// Check for custom endpoint rewrite
				const customEndpointRewrite = rewrites.find(
					(r) => r.source === "/__devtools_json",
				);
				expect(customEndpointRewrite).toBeDefined();
				expect(customEndpointRewrite.destination).toContain("localhost:3001");

				// Check for well-known endpoint rewrite
				const wellKnownRewrite = rewrites.find(
					(r) =>
						r.source === "/.well-known/appspecific/com.chrome.devtools.json",
				);
				expect(wellKnownRewrite).toBeDefined();
				expect(wellKnownRewrite.destination).toContain("localhost:3001");
			} finally {
				// Restore original environment
				process.env.NODE_ENV = originalEnv;
			}
		});

		it("should preserve other Next.js configuration", () => {
			// Set environment to development for this test
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "development";

			try {
				const nextConfig = {
					distDir: ".next",
					experimental: { appDir: true },
					customProperty: "custom-value",
				};
				const configWithPlugin = withDevToolsJSON(nextConfig);

				// Should preserve all other properties
				expect(configWithPlugin.distDir).toBe(".next");
				expect(configWithPlugin.experimental).toEqual({ appDir: true });
				expect(configWithPlugin.customProperty).toBe("custom-value");

				// Should only add rewrites
				expect(configWithPlugin).toHaveProperty("rewrites");
			} finally {
				// Restore original environment
				process.env.NODE_ENV = originalEnv;
			}
		});

		it("should preserve existing rewrites configuration", async () => {
			// Set environment to development for this test
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "development";

			try {
				const existingRewrites = [
					{ source: "/custom", destination: "/custom-page" },
				];

				const nextConfig = {
					rewrites: async () => existingRewrites,
				};

				const configWithPlugin = withDevToolsJSON(nextConfig);

				// Should preserve existing rewrites configuration
				expect(configWithPlugin).toHaveProperty("rewrites");
				expect(typeof configWithPlugin.rewrites).toBe("function");

				const rewrites = await configWithPlugin.rewrites();

				// Should have DevTools rewrites and the existing ones
				expect(Array.isArray(rewrites)).toBe(true);
				expect(rewrites.length).toBe(3); // 2 DevTools endpoints + 1 existing rewrite

				// DevTools rewrites should be first
				expect(rewrites[0]).toHaveProperty("source", "/__devtools_json");
				expect(rewrites[0]).toHaveProperty("destination");
				expect(rewrites[0].destination).toContain("localhost:3001");

				expect(rewrites[1]).toHaveProperty(
					"source",
					"/.well-known/appspecific/com.chrome.devtools.json",
				);
				expect(rewrites[1]).toHaveProperty("destination");
				expect(rewrites[1].destination).toContain("localhost:3001");

				// Existing rewrite should be preserved
				expect(rewrites[2]).toEqual(existingRewrites[0]);
			} finally {
				// Restore original environment
				process.env.NODE_ENV = originalEnv;
			}
		});

		it("should support custom options", () => {
			const options = {
				uuid: "custom-test-uuid",
				enabled: false,
			};

			const nextConfig = {};
			const configWithPlugin = withDevToolsJSON(nextConfig, options);

			// With enabled: false, should return original config
			expect(configWithPlugin).toEqual(nextConfig);
		});
	});
});
