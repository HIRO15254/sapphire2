export function shouldAutoOpenUpdateNotes(params: {
	latestVersion: string | null;
	viewedVersions: readonly string[] | undefined;
}): boolean {
	const { latestVersion, viewedVersions } = params;

	if (!latestVersion) {
		return false;
	}

	if (viewedVersions === undefined) {
		return false;
	}

	return !viewedVersions.includes(latestVersion);
}
