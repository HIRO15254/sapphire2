import { fileURLToPath } from "node:url";
import { unstable_readConfig } from "wrangler";

export function readWorkerCompatibility(
	configPath = fileURLToPath(
		new URL("../apps/server/wrangler.toml", import.meta.url)
	)
) {
	const config = unstable_readConfig(
		{ config: configPath },
		{ hideWarnings: true }
	);
	if (!config.compatibility_date) {
		throw new Error(`Missing compatibility_date in ${configPath}`);
	}
	return {
		compatibilityDate: config.compatibility_date,
		compatibilityFlags: config.compatibility_flags,
	};
}
