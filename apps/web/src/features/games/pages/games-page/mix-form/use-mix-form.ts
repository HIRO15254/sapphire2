import { useForm } from "@tanstack/react-form";
import { type ChangeEvent, type FormEvent, useState } from "react";
import z from "zod";
import type {
	GameGroup,
	GameMix,
	GameVariant,
} from "@/features/games/hooks/use-game-masters";
import {
	bucketGames,
	countLabel,
	duplicateLabelError,
	isActive,
	MAX_MIX_GAMES,
	MAX_MIX_STRUCTURES,
	sameGamesAs,
	serverLabelError,
	shortName,
} from "@/features/games/utils/game-masters";
import { trpcErrorCode } from "@/shared/lib/query-failure";

const mixFormSchema = z.object({
	games: z.array(z.string()),
	label: z
		.string()
		.trim()
		.min(1, "Enter a name")
		.max(30, "Use 30 characters or fewer"),
});

export interface MixFormSubmit {
	games: string[];
	label: string;
}

interface UseMixFormOptions {
	groups: GameGroup[] | undefined;
	mix: GameMix | null;
	mixes: GameMix[] | undefined;
	onSubmit: (values: MixFormSubmit) => Promise<void>;
	variants: GameVariant[];
}

function gamesProblem(
	games: string[],
	options: Pick<UseMixFormOptions, "groups" | "mix" | "mixes" | "variants">
): string | null {
	if (games.length < 2) {
		return "Add at least 2 games";
	}
	if (games.length > MAX_MIX_GAMES) {
		return `A mix can have up to ${MAX_MIX_GAMES} games`;
	}
	if (
		bucketGames(games, options.variants, options.groups).length >
		MAX_MIX_STRUCTURES
	) {
		return `A mix can span up to ${MAX_MIX_STRUCTURES} structures`;
	}
	const same = sameGamesAs(games, options.mixes, options.mix?.id ?? null);
	if (same) {
		return `Same games as ${same.label}${isActive(same) ? "" : " (archived)"}`;
	}
	return null;
}

function serverGamesError(error: unknown): string | null {
	return trpcErrorCode(error) === "CONFLICT" &&
		error instanceof Error &&
		error.message.startsWith("Same games as")
		? error.message
		: null;
}

export function useMixForm({
	groups,
	mix,
	mixes,
	onSubmit,
	variants,
}: UseMixFormOptions) {
	const [labelError, setLabelError] = useState<string | null>(null);
	const [gamesError, setGamesError] = useState<string | null>(null);
	const [isPickerOpen, setPickerOpen] = useState(false);
	const form = useForm({
		defaultValues: { games: mix?.games ?? [], label: mix?.label ?? "" },
		onSubmit: async ({ value }) => {
			const duplicate = duplicateLabelError(
				mixes,
				value.label,
				mix?.id ?? null,
				"mix"
			);
			const problem = gamesProblem(value.games, {
				groups,
				mix,
				mixes,
				variants,
			});
			setLabelError(duplicate);
			setGamesError(problem);
			if (duplicate || problem) {
				return;
			}
			try {
				await onSubmit({ games: value.games, label: value.label.trim() });
			} catch (error) {
				setLabelError(serverLabelError(error, "mix"));
				setGamesError(serverGamesError(error));
			}
		},
		validators: { onSubmit: mixFormSchema },
	});

	return {
		form,
		gamesError,
		isPickerOpen,
		labelError,
		onFormSubmit: (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			event.stopPropagation();
			form.handleSubmit();
		},
		onGamesChange:
			(handleChange: (value: string[]) => void) => (next: string[]) => {
				setGamesError(null);
				handleChange(next);
			},
		onLabelChange:
			(handleChange: (value: string) => void) =>
			(event: ChangeEvent<HTMLInputElement>) => {
				setLabelError(null);
				handleChange(event.target.value);
			},
		onOpenPicker: () => setPickerOpen(true),
		onPickerOpenChange: setPickerOpen,
		summarize: (games: string[]) => {
			const buckets = bucketGames(games, variants, groups);
			return {
				buckets: buckets.map((bucket) => ({
					count: bucket.variants.length,
					games: bucket.variants.map((variant) => ({
						archived: !isActive(variant),
						id: variant.id,
						label: shortName(variant),
					})),
					groupId: bucket.groupId,
					label: bucket.label,
				})),
				countText: `${countLabel(games.length, "game")} · ${countLabel(buckets.length, "structure")}`,
				hasGames: games.length > 0,
			};
		},
	};
}
