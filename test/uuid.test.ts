import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

/**
 * Validates if a string is a valid UUID v4
 * @param uuid - The string to validate
 * @returns true if valid UUID v4, false otherwise
 */
function isValidUUID(uuid: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uuid);
}

/**
 * Test implementation of UUID utility function
 * @param projectRoot - The project root directory
 * @param providedUuid - Optional UUID to use instead of generating one
 * @returns The UUID string
 */
async function getOrCreateUUID(
	projectRoot: string,
	providedUuid?: string,
): Promise<string> {
	if (providedUuid) {
		return providedUuid;
	}

	const cacheDir = path.resolve(projectRoot, ".next", "cache");
	const uuidPath = path.resolve(cacheDir, "devtools-uuid.json");

	try {
		const uuidContent = await fs.promises.readFile(uuidPath, {
			encoding: "utf-8",
		});
		const uuid = uuidContent.trim();
		if (isValidUUID(uuid)) {
			return uuid;
		}
	} catch (error) {
		// File doesn't exist or is invalid, will create new one
	}

	try {
		await fs.promises.mkdir(cacheDir, { recursive: true });
	} catch (error) {
		// Directory might already exist
	}

	const uuid = crypto.randomUUID();
	await fs.promises.writeFile(uuidPath, uuid, { encoding: "utf-8" });
	return uuid;
}

describe("#UUIDUtils", () => {
	const testProjectRoot = path.resolve(process.cwd(), "test-temp");
	const testCacheDir = path.resolve(testProjectRoot, ".next", "cache");
	const testUuidPath = path.resolve(testCacheDir, "devtools-uuid.json");

	beforeEach(async () => {
		// Clean up any existing test files
		try {
			await fs.promises.rm(testProjectRoot, { recursive: true, force: true });
		} catch (error) {
			// Directory might not exist
		}
	});

	afterEach(async () => {
		// Clean up test files
		try {
			await fs.promises.rm(testProjectRoot, { recursive: true, force: true });
		} catch (error) {
			// Directory might not exist
		}
	});

	describe("#getOrCreateUUID", () => {
		it("should return provided UUID when given", async () => {
			const customUuid = "custom-test-uuid";
			const result = await getOrCreateUUID(testProjectRoot, customUuid);

			expect(result).toBe(customUuid);
		});

		it("should generate and cache a new UUID", async () => {
			const result = await getOrCreateUUID(testProjectRoot);

			expect(isValidUUID(result)).toBe(true);
			expect(fs.existsSync(testUuidPath)).toBe(true);

			const cachedContent = await fs.promises.readFile(testUuidPath, {
				encoding: "utf-8",
			});
			expect(cachedContent.trim()).toBe(result);
		});

		it("should return cached UUID on subsequent calls", async () => {
			const firstResult = await getOrCreateUUID(testProjectRoot);
			const secondResult = await getOrCreateUUID(testProjectRoot);

			expect(firstResult).toBe(secondResult);
			expect(isValidUUID(firstResult)).toBe(true);
		});

		it("should create cache directory if it does not exist", async () => {
			expect(fs.existsSync(testCacheDir)).toBe(false);

			await getOrCreateUUID(testProjectRoot);

			expect(fs.existsSync(testCacheDir)).toBe(true);
			expect(fs.existsSync(testUuidPath)).toBe(true);
		});

		it("should handle invalid cached UUID by generating new one", async () => {
			// Create cache directory and write invalid UUID
			await fs.promises.mkdir(testCacheDir, { recursive: true });
			await fs.promises.writeFile(testUuidPath, "invalid-uuid", {
				encoding: "utf-8",
			});

			const result = await getOrCreateUUID(testProjectRoot);

			expect(isValidUUID(result)).toBe(true);
			expect(result).not.toBe("invalid-uuid");

			const newCachedContent = await fs.promises.readFile(testUuidPath, {
				encoding: "utf-8",
			});
			expect(newCachedContent.trim()).toBe(result);
		});

		it("should handle corrupted cache file", async () => {
			// Create cache directory and write corrupted file
			await fs.promises.mkdir(testCacheDir, { recursive: true });
			// Create a file that exists but can't be read as UTF-8
			await fs.promises.writeFile(testUuidPath, Buffer.from([0xff, 0xfe]));

			const result = await getOrCreateUUID(testProjectRoot);

			expect(isValidUUID(result)).toBe(true);

			const newCachedContent = await fs.promises.readFile(testUuidPath, {
				encoding: "utf-8",
			});
			expect(newCachedContent.trim()).toBe(result);
		});
	});
});