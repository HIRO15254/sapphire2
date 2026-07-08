/**
 * Decide whether the update-notes sheet should auto-open on app load.
 *
 * Auto-open iff there is a latest release the user has not yet viewed. The
 * previous implementation compared the user's *most recently viewed* version
 * against the latest and, critically, skipped every user with no view records
 * at all — which is the common case (all existing users right after the feature
 * shipped, plus anyone who never expanded a note). That left the sheet never
 * auto-opening for the majority of users (SA2-185). Checking membership in the
 * full viewed set fixes that and also covers the edge case of the latest being
 * viewed before an older note.
 *
 * Returns false while the viewed list is still loading (`undefined`) so the
 * sheet never flashes open before we know what the user has already seen.
 */
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
