import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import z from "zod";
import {
	optionalNumericString,
	requiredNumericString,
} from "@/shared/lib/form-fields";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LimitFormat {
	blind1Label: string;
	blind2Label: string;
	blind3Label?: string | null;
	blind4Label?: string | null;
	id: number;
	name: string;
}

export interface BlindSet {
	ante?: number | null;
	anteType?: "none" | "all" | "bb" | null;
	blind1: number;
	blind2: number;
	blind3?: number | null;
	blind4?: number | null;
	id: number;
	limitFormatId: number;
	sortOrder: number;
}

export interface BlindLevel {
	blindSets: BlindSet[];
	id: number;
	isBreak: boolean;
	levelIndex: number;
	minutes?: number | null;
	sortOrder: number;
}

// ── Schema ─────────────────────────────────────────────────────────────────

const blindSetFormSchema = z.object({
	limitFormatId: z.string().min(1, "Limit format is required"),
	blind1: requiredNumericString({ integer: true, min: 0 }),
	blind2: requiredNumericString({ integer: true, min: 0 }),
	blind3: optionalNumericString({ integer: true, min: 0 }),
	blind4: optionalNumericString({ integer: true, min: 0 }),
	ante: optionalNumericString({ integer: true, min: 0 }),
	anteType: z.enum(["none", "all", "bb"]).optional(),
});

const blindLevelFormSchema = z.object({
	levelIndex: requiredNumericString({ integer: true, min: 0 }),
	isBreak: z.boolean(),
	minutes: optionalNumericString({ integer: true, min: 1 }),
});

interface BlindSetFormValues {
	ante: string;
	anteType?: "none" | "all" | "bb";
	blind1: string;
	blind2: string;
	blind3: string;
	blind4: string;
	limitFormatId: string;
}

interface BlindLevelFormValues {
	isBreak: boolean;
	levelIndex: string;
	minutes: string;
}

// ── Hook ───────────────────────────────────────────────────────────────────

interface UseBlindSetEditorArgs {
	blindLevels?: BlindLevel[];
	cashBlindSets?: BlindSet[];
	isReadOnly: boolean;
	/** "tournament" uses blind levels with nested blind sets; "cash" uses flat blind sets */
	kind: "tournament" | "cash_game";
	sessionId: string;
}

function defaultBlindSetValues(): BlindSetFormValues {
	return {
		limitFormatId: "",
		blind1: "0",
		blind2: "0",
		blind3: "",
		blind4: "",
		ante: "",
		anteType: undefined,
	};
}

function defaultLevelValues(index: number): BlindLevelFormValues {
	return {
		levelIndex: String(index),
		isBreak: false,
		minutes: "20",
	};
}

export function useBlindSetEditor({
	sessionId,
	kind,
	blindLevels = [],
	cashBlindSets = [],
	isReadOnly,
}: UseBlindSetEditorArgs) {
	const queryClient = useQueryClient();

	const limitFormatsQuery = useQuery(trpc.limitFormat.list.queryOptions());
	const limitFormats: LimitFormat[] = (limitFormatsQuery.data ?? []).map(
		(f) => ({
			id: f.id,
			name: f.name,
			blind1Label: f.blind1Label,
			blind2Label: f.blind2Label,
			blind3Label: f.blind3Label,
			blind4Label: f.blind4Label,
		})
	);

	const sessionQueryKey = trpc.liveSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;

	// ── Add blind set state (for cash or for a specific level) ──────────────
	const [addBlindSetTarget, setAddBlindSetTarget] = useState<
		// For cash: null (attached directly to session)
		// For tournament: levelId number
		number | "cash" | null
	>(null);

	// ── Edit blind set state ─────────────────────────────────────────────────
	const [editingBlindSetId, setEditingBlindSetId] = useState<{
		id: number;
		type: "tournament" | "cash";
	} | null>(null);

	// ── Add level state (tournament) ─────────────────────────────────────────
	const [isAddLevelOpen, setIsAddLevelOpen] = useState(false);

	// ── Edit level state ─────────────────────────────────────────────────────
	const [editingLevelId, setEditingLevelId] = useState<number | null>(null);

	// ── Forms ─────────────────────────────────────────────────────────────────
	const addBlindSetForm = useForm({
		defaultValues: defaultBlindSetValues(),
		onSubmit: ({ value }) => {
			const limitFormatId = Number(value.limitFormatId);
			const fields = {
				limitFormatId,
				blind1: Number(value.blind1),
				blind2: Number(value.blind2),
				blind3: value.blind3 ? Number(value.blind3) : undefined,
				blind4: value.blind4 ? Number(value.blind4) : undefined,
				ante: value.ante ? Number(value.ante) : undefined,
				anteType: value.anteType || undefined,
				sortOrder: (() => {
					if (addBlindSetTarget === "cash") {
						return cashBlindSets.length;
					}
					if (typeof addBlindSetTarget === "number") {
						return (
							blindLevels.find((l) => l.id === addBlindSetTarget)?.blindSets
								.length ?? 0
						);
					}
					return 0;
				})(),
			};

			if (addBlindSetTarget === "cash") {
				addBlindSetMutation.mutate({ type: "cash", sessionId, ...fields });
			} else if (typeof addBlindSetTarget === "number") {
				addBlindSetMutation.mutate({
					type: "tournament",
					sessionBlindLevelId: addBlindSetTarget,
					...fields,
				});
			}
		},
		validators: { onSubmit: blindSetFormSchema },
	});

	const editBlindSetForm = useForm({
		defaultValues: defaultBlindSetValues(),
		onSubmit: ({ value }) => {
			if (!editingBlindSetId) {
				return;
			}
			updateBlindSetMutation.mutate({
				type: editingBlindSetId.type,
				id: editingBlindSetId.id,
				limitFormatId: Number(value.limitFormatId),
				blind1: Number(value.blind1),
				blind2: Number(value.blind2),
				blind3: value.blind3 ? Number(value.blind3) : null,
				blind4: value.blind4 ? Number(value.blind4) : null,
				ante: value.ante ? Number(value.ante) : null,
				anteType: (value.anteType as "none" | "all" | "bb") || null,
			});
		},
		validators: { onSubmit: blindSetFormSchema },
	});

	const addLevelForm = useForm({
		defaultValues: defaultLevelValues(blindLevels.length),
		onSubmit: ({ value }) => {
			addLevelMutation.mutate({
				levelIndex: Number(value.levelIndex),
				isBreak: value.isBreak,
				minutes: value.minutes ? Number(value.minutes) : undefined,
				sortOrder: blindLevels.length,
			});
		},
		validators: { onSubmit: blindLevelFormSchema },
	});

	const editLevelForm = useForm({
		defaultValues: defaultLevelValues(0),
		onSubmit: ({ value }) => {
			if (editingLevelId === null) {
				return;
			}
			updateLevelMutation.mutate({
				id: editingLevelId,
				levelIndex: Number(value.levelIndex),
				isBreak: value.isBreak,
				minutes: value.minutes ? Number(value.minutes) : null,
			});
		},
		validators: { onSubmit: blindLevelFormSchema },
	});

	// ── Mutations ─────────────────────────────────────────────────────────────

	const addBlindSetMutation = useMutation({
		mutationFn: (
			input:
				| {
						type: "cash";
						sessionId: string;
						limitFormatId: number;
						blind1: number;
						blind2: number;
						blind3?: number;
						blind4?: number;
						ante?: number;
						anteType?: string;
						sortOrder: number;
				  }
				| {
						type: "tournament";
						sessionBlindLevelId: number;
						limitFormatId: number;
						blind1: number;
						blind2: number;
						blind3?: number;
						blind4?: number;
						ante?: number;
						anteType?: string;
						sortOrder: number;
				  }
		) => {
			if (input.type === "cash") {
				const { type: _, ...rest } = input;
				return trpcClient.liveSession.addBlindSet.mutate(
					rest as Parameters<
						typeof trpcClient.liveSession.addBlindSet.mutate
					>[0]
				);
			}
			const { type: _, ...rest } = input;
			return trpcClient.liveSession.addBlindSet.mutate(
				rest as Parameters<typeof trpcClient.liveSession.addBlindSet.mutate>[0]
			);
		},
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionQueryKey }]);
			setAddBlindSetTarget(null);
			addBlindSetForm.reset(defaultBlindSetValues());
		},
	});

	const updateBlindSetMutation = useMutation({
		mutationFn: (input: {
			type: "tournament" | "cash";
			id: number;
			limitFormatId?: number;
			blind1?: number;
			blind2?: number;
			blind3?: number | null;
			blind4?: number | null;
			ante?: number | null;
			anteType?: "none" | "all" | "bb" | null;
		}) =>
			trpcClient.liveSession.updateBlindSet.mutate(
				input as Parameters<
					typeof trpcClient.liveSession.updateBlindSet.mutate
				>[0]
			),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionQueryKey }]);
			setEditingBlindSetId(null);
		},
	});

	const removeBlindSetMutation = useMutation({
		mutationFn: (input: { type: "tournament" | "cash"; id: number }) =>
			trpcClient.liveSession.removeBlindSet.mutate(
				input as Parameters<
					typeof trpcClient.liveSession.removeBlindSet.mutate
				>[0]
			),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionQueryKey }]);
		},
	});

	const addLevelMutation = useMutation({
		mutationFn: (input: {
			levelIndex: number;
			isBreak: boolean;
			minutes?: number;
			sortOrder: number;
		}) =>
			trpcClient.liveSession.addBlindLevel.mutate({
				sessionId,
				...input,
			}),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionQueryKey }]);
			setIsAddLevelOpen(false);
			addLevelForm.reset(defaultLevelValues(blindLevels.length + 1));
		},
	});

	const updateLevelMutation = useMutation({
		mutationFn: (input: {
			id: number;
			levelIndex?: number;
			isBreak?: boolean;
			minutes?: number | null;
		}) => trpcClient.liveSession.updateBlindLevel.mutate(input),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionQueryKey }]);
			setEditingLevelId(null);
		},
	});

	const removeLevelMutation = useMutation({
		mutationFn: (id: number) =>
			trpcClient.liveSession.removeBlindLevel.mutate({ id }),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionQueryKey }]);
		},
	});

	// ── Handlers ──────────────────────────────────────────────────────────────

	const openEditBlindSet = (bs: BlindSet, type: "tournament" | "cash") => {
		setEditingBlindSetId({ id: bs.id, type });
		editBlindSetForm.reset({
			limitFormatId: String(bs.limitFormatId),
			blind1: String(bs.blind1),
			blind2: String(bs.blind2),
			blind3: bs.blind3 == null ? "" : String(bs.blind3),
			blind4: bs.blind4 == null ? "" : String(bs.blind4),
			ante: bs.ante == null ? "" : String(bs.ante),
			anteType: (bs.anteType as "none" | "all" | "bb") ?? "none",
		});
	};

	const openEditLevel = (level: BlindLevel) => {
		setEditingLevelId(level.id);
		editLevelForm.reset({
			levelIndex: String(level.levelIndex),
			isBreak: level.isBreak,
			minutes: level.minutes == null ? "" : String(level.minutes),
		});
	};

	return {
		kind,
		limitFormats,
		blindLevels,
		cashBlindSets,
		isReadOnly,
		addBlindSetTarget,
		setAddBlindSetTarget,
		editingBlindSetId,
		setEditingBlindSetId,
		isAddLevelOpen,
		setIsAddLevelOpen,
		editingLevelId,
		addBlindSetForm,
		editBlindSetForm,
		addLevelForm,
		editLevelForm,
		isAddBlindSetPending: addBlindSetMutation.isPending,
		isUpdateBlindSetPending: updateBlindSetMutation.isPending,
		isRemoveBlindSetPending: removeBlindSetMutation.isPending,
		isAddLevelPending: addLevelMutation.isPending,
		isUpdateLevelPending: updateLevelMutation.isPending,
		isRemoveLevelPending: removeLevelMutation.isPending,
		openEditBlindSet,
		openEditLevel,
		closeEditBlindSet: () => setEditingBlindSetId(null),
		closeEditLevel: () => setEditingLevelId(null),
		onRemoveBlindSet: (id: number, type: "tournament" | "cash") =>
			removeBlindSetMutation.mutate({ type, id }),
		onRemoveLevel: (id: number) => removeLevelMutation.mutate(id),
	};
}
