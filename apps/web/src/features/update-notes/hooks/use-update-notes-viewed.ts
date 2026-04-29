import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc } from "@/utils/trpc";

export function useUpdateNotesViewed() {
	const queryClient = useQueryClient();
	const [optimisticallyViewed, setOptimisticallyViewed] = useState<Set<string>>(
		new Set()
	);

	const { data: viewedList } = useQuery(
		trpc.updateNoteView.list.queryOptions()
	);

	const serverViewedVersions = new Set(viewedList?.map((v) => v.version));
	const viewedVersions = new Set([
		...serverViewedVersions,
		...optimisticallyViewed,
	]);

	const markViewedMutation = useMutation(
		trpc.updateNoteView.markViewed.mutationOptions({
			onSettled: () =>
				invalidateTargets(queryClient, [
					{ queryKey: trpc.updateNoteView.list.queryOptions().queryKey },
					{
						queryKey:
							trpc.updateNoteView.getLatestViewedVersion.queryOptions()
								.queryKey,
					},
				]),
		})
	);

	const handleAccordionChange = (value: string[]) => {
		for (const version of value) {
			if (!viewedVersions.has(version)) {
				setOptimisticallyViewed((prev) => new Set([...prev, version]));
				markViewedMutation.mutate({ version });
			}
		}
	};

	return { viewedVersions, handleAccordionChange };
}
