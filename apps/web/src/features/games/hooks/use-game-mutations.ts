import { useRef } from "react";
import { useUndoableMutation } from "@/shared/hooks/use-undoable-mutation";
import { trpcErrorCode } from "@/shared/lib/query-failure";
import { trpc, trpcClient } from "@/utils/trpc";
import { useInvalidateGameMasters } from "./use-game-masters";

export interface MasterTarget {
	id: string;
	label: string;
}

type Reason = (id: string) => string | null;

function useMasterFeedback() {
	const invalidate = useInvalidateGameMasters();
	const labels = useRef(new Map<string, string>());
	return {
		invalidate,
		label: (id: string) => labels.current.get(id) ?? "",
		remember: (target: MasterTarget) => {
			labels.current.set(target.id, target.label);
			return { id: target.id };
		},
		undo: async (run: () => Promise<unknown>) => {
			try {
				await run();
			} finally {
				await invalidate();
			}
		},
	};
}

function rejection(
	error: unknown,
	code: "BAD_REQUEST" | "CONFLICT",
	title: string,
	description: string
) {
	return trpcErrorCode(error) === code ? { description, title } : undefined;
}

const IN_USE = "It’s in use. Archive it instead.";

export function useCreateVariant() {
	const { invalidate, undo } = useMasterFeedback();
	return useUndoableMutation(
		trpc.gameVariant.create.mutationOptions({ onSettled: invalidate }),
		{
			describe: (variables) => variables.label,
			inverse: (_variables, variant) =>
				undo(() =>
					trpcClient.gameVariant.delete.mutate({ id: variant?.id ?? "" })
				),
			message: "Game added",
		}
	);
}

export interface VariantSnapshot {
	groupId: string;
	label: string;
	shortLabel: string | null;
}

export function useUpdateVariant() {
	const { invalidate, undo } = useMasterFeedback();
	const previous = useRef(new Map<string, VariantSnapshot>());
	const mutation = useUndoableMutation(
		trpc.gameVariant.update.mutationOptions({ onSettled: invalidate }),
		{
			inverse: ({ id }) =>
				undo(() =>
					trpcClient.gameVariant.update.mutate({
						...previous.current.get(id),
						id,
					})
				),
			message: "Game saved",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (
			variables: Parameters<typeof mutation.mutateAsync>[0],
			snapshot: VariantSnapshot
		) => {
			previous.current.set(variables.id, snapshot);
			return mutation.mutateAsync(variables);
		},
	};
}

export function useArchiveVariant(reason: Reason) {
	const { invalidate, label, remember, undo } = useMasterFeedback();
	const mutation = useUndoableMutation(
		trpc.gameVariant.archive.mutationOptions({ onSettled: invalidate }),
		{
			describe: ({ id }) => label(id),
			failure: (error, { id }) =>
				rejection(
					error,
					"CONFLICT",
					`Couldn’t archive ${label(id)}`,
					reason(id) ?? "Used by an active mix."
				),
			inverse: ({ id }) =>
				undo(() => trpcClient.gameVariant.restore.mutate({ id })),
			message: "Game archived",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (target: MasterTarget) =>
			mutation.mutateAsync(remember(target)),
	};
}

export function useRestoreVariant(reason: Reason) {
	const { invalidate, label, remember, undo } = useMasterFeedback();
	const mutation = useUndoableMutation(
		trpc.gameVariant.restore.mutationOptions({ onSettled: invalidate }),
		{
			describe: ({ id }) => label(id),
			failure: (error, { id }) =>
				rejection(
					error,
					"BAD_REQUEST",
					`Couldn’t restore ${label(id)}`,
					reason(id) ?? "Its structure is archived."
				),
			inverse: ({ id }) =>
				undo(() => trpcClient.gameVariant.archive.mutate({ id })),
			message: "Game restored",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (target: MasterTarget) =>
			mutation.mutateAsync(remember(target)),
	};
}

export function useDeleteVariant() {
	const { invalidate, label, remember } = useMasterFeedback();
	const mutation = useUndoableMutation(
		trpc.gameVariant.delete.mutationOptions({ onSettled: invalidate }),
		{
			describe: ({ id }) => label(id),
			destructive: true,
			failure: (error, { id }) =>
				rejection(error, "CONFLICT", `Couldn’t delete ${label(id)}`, IN_USE),
			message: "Game deleted",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (target: MasterTarget) =>
			mutation.mutateAsync(remember(target)),
	};
}

export function useCreateMix() {
	const { invalidate, undo } = useMasterFeedback();
	return useUndoableMutation(
		trpc.gameMix.create.mutationOptions({ onSettled: invalidate }),
		{
			describe: (variables) => variables.label,
			inverse: (_variables, mix) =>
				undo(() => trpcClient.gameMix.delete.mutate({ id: mix?.id ?? "" })),
			message: "Mix added",
		}
	);
}

export interface MixSnapshot {
	games: string[];
	label: string;
}

export function useUpdateMix() {
	const { invalidate, undo } = useMasterFeedback();
	const previous = useRef(new Map<string, MixSnapshot>());
	const mutation = useUndoableMutation(
		trpc.gameMix.update.mutationOptions({ onSettled: invalidate }),
		{
			inverse: ({ id }) =>
				undo(() =>
					trpcClient.gameMix.update.mutate({
						...previous.current.get(id),
						id,
					})
				),
			message: "Mix saved",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (
			variables: Parameters<typeof mutation.mutateAsync>[0],
			snapshot: MixSnapshot
		) => {
			previous.current.set(variables.id, snapshot);
			return mutation.mutateAsync(variables);
		},
	};
}

export function useArchiveMix() {
	const { invalidate, label, remember, undo } = useMasterFeedback();
	const mutation = useUndoableMutation(
		trpc.gameMix.archive.mutationOptions({ onSettled: invalidate }),
		{
			describe: ({ id }) => label(id),
			inverse: ({ id }) =>
				undo(() => trpcClient.gameMix.restore.mutate({ id })),
			message: "Mix archived",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (target: MasterTarget) =>
			mutation.mutateAsync(remember(target)),
	};
}

export function useRestoreMix(reason: Reason) {
	const { invalidate, label, remember, undo } = useMasterFeedback();
	const mutation = useUndoableMutation(
		trpc.gameMix.restore.mutationOptions({ onSettled: invalidate }),
		{
			describe: ({ id }) => label(id),
			failure: (error, { id }) =>
				rejection(
					error,
					"BAD_REQUEST",
					`Couldn’t restore ${label(id)}`,
					reason(id) ?? "One of its games is archived."
				),
			inverse: ({ id }) =>
				undo(() => trpcClient.gameMix.archive.mutate({ id })),
			message: "Mix restored",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (target: MasterTarget) =>
			mutation.mutateAsync(remember(target)),
	};
}

export function useDeleteMix() {
	const { invalidate, label, remember } = useMasterFeedback();
	const mutation = useUndoableMutation(
		trpc.gameMix.delete.mutationOptions({ onSettled: invalidate }),
		{
			describe: ({ id }) => label(id),
			destructive: true,
			failure: (error, { id }) =>
				rejection(error, "CONFLICT", `Couldn’t delete ${label(id)}`, IN_USE),
			message: "Mix deleted",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (target: MasterTarget) =>
			mutation.mutateAsync(remember(target)),
	};
}

export function useCreateGroup() {
	const { invalidate, undo } = useMasterFeedback();
	return useUndoableMutation(
		trpc.gameGroup.create.mutationOptions({ onSettled: invalidate }),
		{
			describe: (variables) => variables.label,
			inverse: (_variables, group) =>
				undo(() => trpcClient.gameGroup.delete.mutate({ id: group?.id ?? "" })),
			message: "Structure added",
		}
	);
}

export interface GroupSnapshot {
	blind1Label: string | null;
	blind1Required: boolean;
	blind2Label: string | null;
	blind2Required: boolean;
	blind3Label: string | null;
	blind3Required: boolean;
	fixedAnteType: "all" | "bb" | "none" | null;
	label: string;
}

export function useUpdateGroup() {
	const { invalidate, undo } = useMasterFeedback();
	const previous = useRef(new Map<string, GroupSnapshot>());
	const mutation = useUndoableMutation(
		trpc.gameGroup.update.mutationOptions({ onSettled: invalidate }),
		{
			inverse: ({ id }) =>
				undo(() =>
					trpcClient.gameGroup.update.mutate({
						...previous.current.get(id),
						id,
					})
				),
			message: "Structure saved",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (
			variables: Parameters<typeof mutation.mutateAsync>[0],
			snapshot: GroupSnapshot
		) => {
			previous.current.set(variables.id, snapshot);
			return mutation.mutateAsync(variables);
		},
	};
}

export function useArchiveGroup(reason: Reason) {
	const { invalidate, label, remember, undo } = useMasterFeedback();
	const mutation = useUndoableMutation(
		trpc.gameGroup.archive.mutationOptions({ onSettled: invalidate }),
		{
			describe: ({ id }) => label(id),
			failure: (error, { id }) =>
				rejection(
					error,
					"CONFLICT",
					`Couldn’t archive ${label(id)}`,
					reason(id) ?? "Still has active games."
				),
			inverse: ({ id }) =>
				undo(() => trpcClient.gameGroup.restore.mutate({ id })),
			message: "Structure archived",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (target: MasterTarget) =>
			mutation.mutateAsync(remember(target)),
	};
}

export function useRestoreGroup() {
	const { invalidate, label, remember, undo } = useMasterFeedback();
	const mutation = useUndoableMutation(
		trpc.gameGroup.restore.mutationOptions({ onSettled: invalidate }),
		{
			describe: ({ id }) => label(id),
			inverse: ({ id }) =>
				undo(() => trpcClient.gameGroup.archive.mutate({ id })),
			message: "Structure restored",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (target: MasterTarget) =>
			mutation.mutateAsync(remember(target)),
	};
}

export function useDeleteGroup() {
	const { invalidate, label, remember } = useMasterFeedback();
	const mutation = useUndoableMutation(
		trpc.gameGroup.delete.mutationOptions({ onSettled: invalidate }),
		{
			describe: ({ id }) => label(id),
			destructive: true,
			failure: (error, { id }) =>
				rejection(error, "CONFLICT", `Couldn’t delete ${label(id)}`, IN_USE),
			message: "Structure deleted",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (target: MasterTarget) =>
			mutation.mutateAsync(remember(target)),
	};
}
