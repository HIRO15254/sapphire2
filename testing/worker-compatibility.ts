import { fileURLToPath } from "node:url";
import { unstable_readConfig } from "wrangler";

const SERVER_CONFIG_PATH = fileURLToPath(
	new URL("../apps/server/wrangler.toml", import.meta.url)
);

function readConfig(configPath: string) {
	return unstable_readConfig({ config: configPath }, { hideWarnings: true });
}

export function readWorkerCompatibility(configPath = SERVER_CONFIG_PATH) {
	const config = readConfig(configPath);
	if (!config.compatibility_date) {
		throw new Error(`Missing compatibility_date in ${configPath}`);
	}
	return {
		compatibilityDate: config.compatibility_date,
		compatibilityFlags: config.compatibility_flags,
	};
}

export function readWorkerVars(configPath = SERVER_CONFIG_PATH) {
	return readConfig(configPath).vars;
}
