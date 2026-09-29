import { MAX_MIX_GROUPS } from "@sapphire2/db/schemas/game";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { autoGroupNames } from "@/features/live-sessions/utils/mix-composition";
import {
	useGameGroups,
	useInvalidateGameMasters,
} from "@/shared/hooks/use-game-groups";
import { rowsFromVariantLabels } from "@/shared/lib/mix-games";
import { trpcClient } from "@/utils/trpc";
import { useDiscardConfirm } from "../use-discard-confirm";

export interface MixMasterRow {
	games: string[];
	id: string;
	label: string;
}

interface MixMasterValues {
	games: string[];
	label: string;
}

export interface SavedMix {
	games: string[];
	label: string;
}

interface UseMixMasterSheetOptions {
	editing: MixMasterRow | null;
	onOpenChange: (open: boolean) => void;
	onSaved: (saved: SavedMix) => void;
	open: boolean;
}

const MIX_MASTER_SCHEMA = z.object({
	games: z.array(z.string()),
	label: z.string().trim().min(1, "Required").max(30),
});

const MIN_GAMES = 2;
const MAX_GAMES = 30;

function normalized(value: string): string {
	return value.trim().toLowerCase();
}

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function useMixMasterSheet({
	editing,
	onOpenChange,
	onSaved,
	open,
}: UseMixMasterSheetOptions) {
	const { groupFor, variants } = useGameGroups();
	const invalidateMasters = useInvalidateGameMasters();
	const [nameError, setNameError] = useState<string | null>(null);
	const [gamesError, setGamesError] = useState<string | null>(null);
	const [isPickerOpen, setIsPickerOpen] = useState(false);

	const variantById = new Map(variants.map((row) => [row.id, row]));
	const variantByLabel = new Map(
		variants.map((row) => [normalized(row.label), row])
	);
	const structureOf = (id: string) => variantById.get(id)?.groupId ?? id;
	const structureCount = (ids: readonly string[]) =>
		new Set(ids.map(structureOf)).size;

	const findGamesIssue = (ids: readonly string[]): string | null => {
		if (ids.length < MIN_GAMES) {
			return `Pick at least ${MIN_GAMES} games`;
		}
		if (ids.length > MAX_GAMES) {
			return `A mix holds at most ${MAX_GAMES} games`;
		}
		if (structureCount(ids) > MAX_MIX_GROUPS) {
			return `A mix spans at most ${MAX_MIX_GROUPS} blind structures`;
		}
		return null;
	};

	const onSaveError = (error: unknown) => {
		if (isTRPCClientError(error) && error.data?.code === "CONFLICT") {
			setNameError(error.message);
			return;
		}
		toast.error(editing ? "Failed to update mix" : "Failed to create mix");
	};

	const onSaveSuccess = async (
		saved: { games: string[]; label: string } | undefined
	) => {
		await invalidateMasters();
		onOpenChange(false);
		if (saved) {
			onSaved({
				games: saved.games
					.map((id) => variantById.get(id)?.label)
					.filter((label): label is string => label !== undefined),
				label: saved.label,
			});
		}
	};

	const saveMutation = useMutation({
		mutationFn: (values: MixMasterValues) => {
			const input = { games: values.games, label: values.label.trim() };
			return editing
				? trpcClient.gameMix.update.mutate({ id: editing.id, ...input })
				: trpcClient.gameMix.create.mutate(input);
		},
		onError: onSaveError,
		onSuccess: onSaveSuccess,
	});

	const defaults = (): MixMasterValues => ({
		games: editing ? [...editing.games] : [],
		label: editing?.label ?? "",
	});

	const form = useForm({
		defaultValues: defaults(),
		onSubmit: ({ value }) => {
			const issue = findGamesIssue(value.games);
			setGamesError(issue);
			if (issue !== null) {
				return;
			}
			setNameError(null);
			saveMutation.mutate(value);
		},
		validators: { onSubmit: MIX_MASTER_SCHEMA },
	});

	const wasOpenRef = useRef(false);
	useEffect(() => {
		if (open && !wasOpenRef.current) {
			form.reset(defaults());
			setNameError(null);
			setGamesError(null);
			setIsPickerOpen(false);
		}
		wasOpenRef.current = open;
	});

	const discard = useDiscardConfirm({
		isDirty: () => form.state.isDirty,
		onOpenChange,
	});

	const games = useStore(form.store, (state) => state.values.games);
	const labels = games.map((id) => variantById.get(id)?.label ?? id);
	const buckets = rowsFromVariantLabels(labels, groupFor);
	const names = autoGroupNames(buckets, groupFor);

	const setGames = (next: string[]) => {
		setGamesError(null);
		form.setFieldValue("games", next);
	};
	const idOf = (label: string) => variantByLabel.get(normalized(label))?.id;
	const isPicked = (label: string) => {
		const id = idOf(label);
		return id !== undefined && games.includes(id);
	};
	const isDisabled = (label: string) => {
		const id = idOf(label);
		if (id === undefined) {
			return true;
		}
		if (games.includes(id)) {
			return false;
		}
		return (
			games.length >= MAX_GAMES ||
			structureCount([...games, id]) > MAX_MIX_GROUPS
		);
	};

	return {
		discard,
		form,
		gamesError,
		groups: buckets.map((bucket, index) => ({
			games: bucket.variants.map((label) => {
				const row = variantByLabel.get(normalized(label));
				return {
					code: row?.shortLabel ?? label,
					id: row?.id ?? label,
					label,
				};
			}),
			key: bucket.groupId,
			name: names[index] ?? bucket.groupLabel,
		})),
		hint: editing
			? "This edits the saved mix, so every rule and session that uses it shows the change. Games are grouped by blind structure automatically."
			: "The new mix is saved to your game list. Games are grouped by blind structure automatically.",
		isSaving: saveMutation.isPending,
		nameError,
		onNameChange: () => setNameError(null),
		onOpenPicker: () => setIsPickerOpen(true),
		onRemoveGame: (id: string) =>
			setGames(games.filter((gameId) => gameId !== id)),
		picker: {
			isDisabled,
			isPicked,
			onOpenChange: setIsPickerOpen,
			onToggle: (label: string) => {
				const id = idOf(label);
				if (id === undefined) {
					return;
				}
				if (games.includes(id)) {
					setGames(games.filter((gameId) => gameId !== id));
					return;
				}
				if (!isDisabled(label)) {
					setGames([...games, id]);
				}
			},
			open: isPickerOpen,
		},
		summary: `${plural(games.length, "game")} · ${plural(buckets.length, "group")}`,
		title: editing ? "Edit mix" : "New mix",
	};
}
