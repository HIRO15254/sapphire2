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
				]),
		})
	);

	const markViewed = (version: string) => {
		if (viewedVersions.has(version)) {
			return;
		}
		setOptimisticallyViewed((prev) => new Set([...prev, version]));
		markViewedMutation.mutate({ version });
	};

	const handleAccordionChange = (value: string[]) => {
		for (const version of value) {
			markViewed(version);
		}
	};

	return {
		viewedVersions,
		isViewedListLoaded: viewedList !== undefined,
		markViewed,
		handleAccordionChange,
	};
}
