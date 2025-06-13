#!/usr/bin/env node

/**
 * Cleanup script for next-plugin-devtools-json
 * Removes any leftover temporary test directories from interrupted test runs
 */

import { execSync } from "node:child_process";

console.log("🧹 Cleaning up leftover test directories...");

const patterns = [
	"/tmp/quick-test-*",
	"/tmp/nextjs-plugin-tests*",
	"/tmp/test-devtools-*",
	"/tmp/debug-test*",
];

let cleaned = 0;

for (const pattern of patterns) {
	try {
		const result = execSync(
			`find /tmp -maxdepth 1 -type d -name "${pattern.replace("/tmp/", "")}" 2>/dev/null`,
			{ encoding: "utf8" },
		);
		const directories = result
			.trim()
			.split("\n")
			.filter((dir) => dir && dir.length > 0);

		if (directories.length > 0) {
			console.log(
				`📁 Found ${directories.length} directories matching ${pattern}:`,
			);
			for (const dir of directories) {
				console.log(`   ${dir}`);
			}

			execSync(`rm -rf ${pattern}`, { stdio: "inherit" });
			cleaned += directories.length;
			console.log(`✅ Cleaned up ${directories.length} directories`);
		}
	} catch (error) {
		// No directories found or error - this is usually fine
	}
}

if (cleaned === 0) {
	console.log("✨ No leftover test directories found - everything is clean!");
} else {
	console.log(`🎉 Cleaned up ${cleaned} leftover test directories`);
}
