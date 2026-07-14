export function normalizeRulePath(path: string): string {
	return path.replaceAll("\\", "/");
}
