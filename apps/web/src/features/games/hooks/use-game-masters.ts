import type { AppRouter } from "@sapphire2/api/routers/index";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useCallback } from "react";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc } from "@/utils/trpc";

type Outputs = inferRouterOutputs<AppRouter>;

export type GameGroup = Outputs["gameGroup"]["list"][number];
export type GameVariant = Outputs["gameVariant"]["list"][number];
export type GameMix = Outputs["gameMix"]["list"][number];

export function useGameGroups() {
	return useQuery(trpc.gameGroup.list.queryOptions({ includeArchived: true }));
}

export function useGameVariants() {
	return useQuery(
		trpc.gameVariant.list.queryOptions({ includeArchived: true })
	);
}

export function useGameMixes() {
	return useQuery(trpc.gameMix.list.queryOptions({ includeArchived: true }));
}

export function useInvalidateGameMasters() {
	const queryClient = useQueryClient();
	return useCallback(
		() =>
			invalidateTargets(queryClient, [
				{ filters: { queryKey: trpc.gameGroup.pathKey() } },
				{ filters: { queryKey: trpc.gameVariant.pathKey() } },
				{ filters: { queryKey: trpc.gameMix.pathKey() } },
			]),
		[queryClient]
	);
}
