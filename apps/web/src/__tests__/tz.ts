const ORIGINAL_TZ = process.env.TZ;

export const TZ_WEST = "America/Los_Angeles";
export const TZ_EAST = "Asia/Tokyo";

export function withTz<T>(tz: string, fn: () => T): T {
	process.env.TZ = tz;
	try {
		return fn();
	} finally {
		if (ORIGINAL_TZ === undefined) {
			Reflect.deleteProperty(process.env, "TZ");
		} else {
			process.env.TZ = ORIGINAL_TZ;
		}
	}
}
