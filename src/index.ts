import http from "node:http";
import url from "node:url";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import type { NextConfig } from "next";
import { type Result, ok, err, tryCatch } from "./result";

interface DevToolsJSON {
	workspace: {
		root: string;
		uuid: string;
	};
}

interface DevToolsJSONOptions {
	readonly uuid?: string;
	readonly enabled?: boolean;
	readonly endpoint?: string;
	readonly port?: number;
	readonly maxPortAttempts?: number;
	readonly shutdownTimeoutMs?: number;
}

interface ServerConfig {
	readonly endpoint: string;
	readonly initialPort: number;
	readonly maxPortAttempts: number;
	readonly shutdownTimeoutMs: number;
	readonly uuid?: string;
}

type ServerState =
	| { readonly type: "idle" }
	| { readonly type: "starting"; readonly port: number }
	| {
			readonly type: "running";
			readonly server: http.Server;
			readonly port: number;
	  }
	| { readonly type: "stopping" }
	| { readonly type: "stopped" };

type DevToolsError =
	| PortExhaustedError
	| UUIDError
	| ServerError
	| FileSystemError
	| ConfigError;

type PortExhaustedError = {
	readonly _tag: "PortExhaustedError";
	readonly attempts: number;
	readonly lastPort: number;
};

type UUIDError = {
	readonly _tag: "UUIDError";
	readonly operation: "read" | "write" | "generate" | "validate";
	readonly path?: string;
	readonly cause?: Error;
};

type ServerError = {
	readonly _tag: "ServerError";
	readonly operation: "start" | "stop" | "listen";
	readonly port?: number;
	readonly cause: Error;
};

type FileSystemError = {
	readonly _tag: "FileSystemError";
	readonly path: string;
	readonly operation: "read" | "write" | "mkdir" | "exists";
	readonly cause: Error;
};

type ConfigError = {
	readonly _tag: "ConfigError";
	readonly message: string;
};

const DEFAULT_CONFIG: Readonly<{
	endpoint: string;
	port: number;
	maxPortAttempts: number;
	shutdownTimeoutMs: number;
}> = {
	endpoint: "/__devtools_json",
	port: 3001,
	maxPortAttempts: 10,
	shutdownTimeoutMs: 3000,
};

const CHROME_DEVTOOLS_PATH =
	"/.well-known/appspecific/com.chrome.devtools.json";

class UUIDManager {
	constructor(
		private readonly fs: typeof import("node:fs"),
		private readonly path: typeof import("node:path"),
		private readonly crypto: typeof import("node:crypto"),
	) {}

	/**
	 * Gets an existing UUID or creates a new one for the project
	 * @param projectRoot - The root directory of the project
	 * @param providedUuid - Optional UUID to use instead of generating/reading one
	 * @returns Result containing the UUID string or a UUIDError
	 */
	getOrCreate(
		projectRoot: string,
		providedUuid?: string,
	): Result<string, UUIDError> {
		if (providedUuid) {
			return this.validate(providedUuid);
		}

		const cacheDir = this.path.resolve(projectRoot, ".next", "cache");
		const uuidPath = this.path.resolve(cacheDir, "devtools-uuid.json");

		const existingUuid = this.read(uuidPath);
		if (existingUuid.isOk()) {
			return existingUuid;
		}

		return this.createAndPersist(cacheDir, uuidPath);
	}

	private validate(uuid: string): Result<string, UUIDError> {
		const uuidRegex =
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		if (uuidRegex.test(uuid)) {
			return ok(uuid);
		}
		return err({
			_tag: "UUIDError",
			operation: "validate",
			cause: new Error(`Invalid UUID format: ${uuid}`),
		});
	}

	private read(uuidPath: string): Result<string, UUIDError> {
		return tryCatch(
			() => {
				if (!this.fs.existsSync(uuidPath)) {
					throw new Error("UUID file does not exist");
				}
				const content = this.fs.readFileSync(uuidPath, { encoding: "utf-8" });
				return content.trim();
			},
			(error) => ({
				_tag: "UUIDError" as const,
				operation: "read" as const,
				path: uuidPath,
				cause: error as Error,
			}),
		).andThen((uuid) => this.validate(uuid));
	}

	private createAndPersist(
		cacheDir: string,
		uuidPath: string,
	): Result<string, UUIDError> {
		return tryCatch(
			() => {
				if (!this.fs.existsSync(cacheDir)) {
					this.fs.mkdirSync(cacheDir, { recursive: true });
				}
				const uuid = this.crypto.randomUUID();
				this.fs.writeFileSync(uuidPath, uuid, { encoding: "utf-8" });
				return uuid;
			},
			(error) => ({
				_tag: "UUIDError" as const,
				operation: "write" as const,
				path: uuidPath,
				cause: error as Error,
			}),
		);
	}
}

class DevToolsServer extends EventEmitter {
	private state: ServerState = { type: "idle" };

	constructor(
		private readonly config: ServerConfig,
		private readonly uuidManager: UUIDManager,
	) {
		super();
	}

	/**
	 * Starts the DevTools server on an available port
	 * @returns Promise resolving to Result with server instance and port number, or DevToolsError
	 */
	async start(): Promise<
		Result<{ server: http.Server; port: number }, DevToolsError>
	> {
		if (this.state.type !== "idle") {
			return err({
				_tag: "ServerError",
				operation: "start",
				cause: new Error(`Cannot start server in state: ${this.state.type}`),
			});
		}

		const projectRoot = process.cwd();
		const uuidResult = this.uuidManager.getOrCreate(
			projectRoot,
			this.config.uuid,
		);

		if (uuidResult.isErr()) {
			return err(uuidResult.unwrapErr());
		}

		const uuid = uuidResult.unwrap();
		const serverResult = await this.tryStartServer(uuid, projectRoot);

		if (serverResult.isOk()) {
			const { server, port } = serverResult.unwrap();
			this.state = {
				type: "running",
				server,
				port,
			};
			this.emit("started", port);
		}

		return serverResult;
	}

	/**
	 * Stops the DevTools server gracefully
	 * @returns Promise resolving to Result with void or ServerError
	 */
	async stop(): Promise<Result<void, ServerError>> {
		if (this.state.type !== "running") {
			return ok(undefined);
		}

		const { server } = this.state;
		this.state = { type: "stopping" };

		try {
			await this.gracefulShutdown(server);
			this.state = { type: "stopped" };
			this.emit("stopped");
			return ok(undefined);
		} catch (error) {
			this.state = { type: "stopped" };
			return err({
				_tag: "ServerError",
				operation: "stop",
				cause: error as Error,
			});
		}
	}

	getPort(): number | undefined {
		return this.state.type === "running" ? this.state.port : undefined;
	}

	private async tryStartServer(
		uuid: string,
		projectRoot: string,
	): Promise<Result<{ server: http.Server; port: number }, DevToolsError>> {
		let currentPort = this.config.initialPort;
		let attempts = 0;

		while (attempts < this.config.maxPortAttempts) {
			const result = await this.startServerOnPort(
				currentPort,
				uuid,
				projectRoot,
			);

			if (result.isOk()) {
				return result;
			}

			const error = result.unwrapErr();
			if (
				error._tag === "ServerError" &&
				error.cause.message.includes("EADDRINUSE")
			) {
				attempts++;
				currentPort++;
				continue;
			}

			return result;
		}

		return err({
			_tag: "PortExhaustedError",
			attempts: this.config.maxPortAttempts,
			lastPort: currentPort - 1,
		});
	}

	private startServerOnPort(
		port: number,
		uuid: string,
		projectRoot: string,
	): Promise<Result<{ server: http.Server; port: number }, ServerError>> {
		return new Promise((resolve) => {
			const server = http.createServer((req, res) => {
				this.handleRequest(req, res, uuid, projectRoot);
			});

			server.on("error", (error: NodeJS.ErrnoException) => {
				resolve(
					err({
						_tag: "ServerError",
						operation: "listen",
						port,
						cause: error,
					}),
				);
			});

			server.listen(port, "localhost", () => {
				resolve(ok({ server, port }));
			});
		});
	}

	private handleRequest(
		req: http.IncomingMessage,
		res: http.ServerResponse,
		uuid: string,
		projectRoot: string,
	): void {
		if (!req.url) {
			res.statusCode = 404;
			res.end("Not Found");
			return;
		}

		const parsedUrl = url.parse(req.url, true);

		if (parsedUrl.pathname === this.config.endpoint) {
			const devtoolsJson: DevToolsJSON = {
				workspace: {
					root: projectRoot,
					uuid,
				},
			};

			res.setHeader("Content-Type", "application/json");
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.statusCode = 200;
			res.end(JSON.stringify(devtoolsJson, null, 2));
		} else {
			res.statusCode = 404;
			res.end("Not Found");
		}
	}

	private gracefulShutdown(server: http.Server): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error("Server shutdown timed out"));
			}, this.config.shutdownTimeoutMs);

			server.close((error) => {
				clearTimeout(timeout);
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});

			// Force close all connections
			server.closeAllConnections?.();
		});
	}
}

class ServerManager {
	private static instance: ServerManager | null = null;
	private server: DevToolsServer | null = null;
	private cleanupRegistered = false;

	static getInstance(): ServerManager {
		if (!ServerManager.instance) {
			ServerManager.instance = new ServerManager();
		}
		return ServerManager.instance;
	}

	/**
	 * Starts the DevTools server with the provided configuration
	 * @param config - Server configuration including endpoint, port, and UUID settings
	 * @returns Promise resolving to Result with the port number or DevToolsError
	 */
	async startServer(
		config: ServerConfig,
	): Promise<Result<number, DevToolsError>> {
		if (this.server) {
			const existingPort = this.server.getPort();
			if (existingPort !== undefined) {
				return ok(existingPort);
			}
		}

		const uuidManager = new UUIDManager(fs, path, crypto);
		this.server = new DevToolsServer(config, uuidManager);

		if (!this.cleanupRegistered) {
			this.registerCleanupHandlers();
		}

		const result = await this.server.start();
		return result.map(({ port }) => port);
	}

	/**
	 * Stops the managed DevTools server instance
	 * @returns Promise resolving to Result with void or ServerError
	 */
	async stopServer(): Promise<Result<void, ServerError>> {
		if (!this.server) {
			return ok(undefined);
		}

		const result = await this.server.stop();
		this.server = null;
		return result;
	}

	private registerCleanupHandlers(): void {
		this.cleanupRegistered = true;

		const cleanup = async () => {
			await this.stopServer();
		};

		process.once("SIGTERM", cleanup);
		process.once("SIGINT", cleanup);
		process.once("SIGHUP", cleanup);
		process.once("exit", cleanup);
		process.once("beforeExit", cleanup);
	}
}

/**
 * Builds server configuration from user-provided options
 * @param options - Plugin configuration options
 * @returns Complete server configuration with defaults applied
 */
function buildServerConfig(options: DevToolsJSONOptions): ServerConfig {
	return {
		endpoint: options.endpoint ?? DEFAULT_CONFIG.endpoint,
		initialPort: options.port ?? DEFAULT_CONFIG.port,
		maxPortAttempts: options.maxPortAttempts ?? DEFAULT_CONFIG.maxPortAttempts,
		shutdownTimeoutMs:
			options.shutdownTimeoutMs ?? DEFAULT_CONFIG.shutdownTimeoutMs,
		uuid: options.uuid,
	};
}

/**
 * Creates Next.js rewrite rules for devtools JSON endpoints
 * @param endpoint - The devtools JSON endpoint path
 * @param port - The port where the devtools server is running
 * @returns Array of rewrite rule objects for Next.js configuration
 */
function createRewrites(endpoint: string, port: number) {
	return [
		{
			source: endpoint,
			destination: `http://localhost:${port}${endpoint}`,
		},
		{
			source: CHROME_DEVTOOLS_PATH,
			destination: `http://localhost:${port}${endpoint}`,
		},
	];
}

/**
 * Enhances Next.js configuration to serve devtools JSON metadata
 * @param nextConfig - The Next.js configuration object to extend
 * @param options - Plugin configuration options for devtools JSON
 * @returns Modified Next.js configuration with devtools JSON support
 */
function withDevToolsJSON(
	nextConfig: NextConfig = {},
	options: DevToolsJSONOptions = {},
): NextConfig {
	// Only enable in development mode and if not explicitly disabled
	if (process.env.NODE_ENV !== "development" || options.enabled === false) {
		return nextConfig;
	}

	const config = buildServerConfig(options);
	const manager = ServerManager.getInstance();

	// Start server asynchronously
	let actualPort = config.initialPort;
	manager.startServer(config).then((result) => {
		result
			.tap((port) => {
				actualPort = port;
			})
			.tapErr((error) => {
				console.error(
					"[next-plugin-devtools-json] Failed to start server:",
					error,
				);
			});
	});

	// Return config with rewrites
	const originalRewrites = nextConfig.rewrites;

	return {
		...nextConfig,
		async rewrites() {
			const existingRewrites = originalRewrites
				? await (typeof originalRewrites === "function"
						? originalRewrites()
						: originalRewrites)
				: [];

			const devToolsRewrites = createRewrites(config.endpoint, actualPort);

			// Handle different rewrite structures
			if (Array.isArray(existingRewrites)) {
				return [...devToolsRewrites, ...existingRewrites];
			}

			if (existingRewrites && typeof existingRewrites === "object") {
				return {
					...existingRewrites,
					beforeFiles: [
						...devToolsRewrites,
						...(existingRewrites.beforeFiles || []),
					],
				};
			}

			return devToolsRewrites;
		},
	};
}

/**
 * Stops and cleans up the devtools JSON server
 * @returns Promise that resolves when cleanup is complete
 */
async function cleanupDevToolsServer(): Promise<void> {
	const manager = ServerManager.getInstance();
	const result = await manager.stopServer();

	result.tapErr((error) => {
		console.error("[next-plugin-devtools-json] Cleanup failed:", error);
	});
}

export default withDevToolsJSON;
export {
	withDevToolsJSON,
	cleanupDevToolsServer,
	type DevToolsJSON,
	type DevToolsJSONOptions,
	type DevToolsError,
};

export { Result, ok, err } from "./result";
