import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
	fetchLatestReleaseNotes,
	lastSeenReleaseVersionStorageKey,
	latestReleaseNotesQueryKey,
} from "@/lib/release-notes";
import { ReleaseNotesDialog } from "@/shared/components/release-notes-dialog";

export function ReleaseNotesGate() {
	const releaseNotesQuery = useQuery({
		queryKey: latestReleaseNotesQueryKey,
		queryFn: fetchLatestReleaseNotes,
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
	});
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!releaseNotesQuery.data) {
			return;
		}

		const lastSeenVersion = window.localStorage.getItem(
			lastSeenReleaseVersionStorageKey
		);

		if (lastSeenVersion !== releaseNotesQuery.data.version) {
			setOpen(true);
		}
	}, [releaseNotesQuery.data]);

	if (!releaseNotesQuery.data) {
		return null;
	}

	return (
		<ReleaseNotesDialog
			notes={releaseNotesQuery.data}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) {
					window.localStorage.setItem(
						lastSeenReleaseVersionStorageKey,
						releaseNotesQuery.data.version
					);
				}
			}}
			open={open}
		/>
	);
}
