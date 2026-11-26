import { useState } from "react";
import type {
	GameGroup,
	GameMix,
	GameVariant,
} from "@/features/games/hooks/use-game-masters";
import {
	useCreateGroup,
	useCreateMix,
	useCreateVariant,
	useUpdateGroup,
	useUpdateMix,
	useUpdateVariant,
} from "@/features/games/hooks/use-game-mutations";
import { findMaster, type MasterData } from "@/features/games/utils/game-lists";
import type { MasterKind } from "@/features/games/utils/game-masters";
import type { GroupFormSubmit } from "./group-form";
import type { MixFormSubmit } from "./mix-form";
import type { VariantFormSubmit } from "./variant-form";

interface FormRef {
	id: string | null;
	kind: MasterKind;
}

const TITLES = {
	group: { create: "New structure", edit: "Edit structure" },
	mix: { create: "New mix", edit: "Edit mix" },
	variant: { create: "New game", edit: "Edit game" },
} as const satisfies Record<MasterKind, { create: string; edit: string }>;

function groupSnapshot(group: GameGroup) {
	return {
		blind1Label: group.blind1Label,
		blind1Required: group.blind1Required,
		blind2Label: group.blind2Label,
		blind2Required: group.blind2Required,
		blind3Label: group.blind3Label,
		blind3Required: group.blind3Required,
		fixedAnteType: group.fixedAnteType,
		label: group.label,
	};
}

export function useMasterForm(data: MasterData) {
	const [target, setTarget] = useState<FormRef | null>(null);
	const createVariant = useCreateVariant();
	const updateVariant = useUpdateVariant();
	const createMix = useCreateMix();
	const updateMix = useUpdateMix();
	const createGroup = useCreateGroup();
	const updateGroup = useUpdateGroup();

	const editing = (kind: MasterKind) =>
		target?.kind === kind && target.id
			? findMaster(data, { id: target.id, kind })
			: undefined;
	const variant = editing("variant") as GameVariant | undefined;
	const mix = editing("mix") as GameMix | undefined;
	const group = editing("group") as GameGroup | undefined;

	const pending = {
		group: createGroup.isPending || updateGroup.isPending,
		mix: createMix.isPending || updateMix.isPending,
		variant: createVariant.isPending || updateVariant.isPending,
	};

	return {
		form: target
			? {
					confirmLabel: target.id ? "Save" : "Create",
					group: group ?? null,
					isPending: pending[target.kind],
					key: target.id ?? "new",
					kind: target.kind,
					mix: mix ?? null,
					title: TITLES[target.kind][target.id ? "edit" : "create"],
					variant: variant ?? null,
				}
			: null,
		onEdit: (ref: { id: string; kind: MasterKind }) => setTarget(ref),
		onFormOpenChange: (open: boolean) => {
			if (!open) {
				setTarget(null);
			}
		},
		onGroupSubmit: async (values: GroupFormSubmit) => {
			if (group) {
				await updateGroup.mutateAsync(
					{ id: group.id, ...values },
					groupSnapshot(group)
				);
			} else {
				await createGroup.mutateAsync(values);
			}
			setTarget(null);
		},
		onMixSubmit: async (values: MixFormSubmit) => {
			if (mix) {
				await updateMix.mutateAsync(
					{ id: mix.id, ...values },
					{ games: mix.games, label: mix.label }
				);
			} else {
				await createMix.mutateAsync(values);
			}
			setTarget(null);
		},
		onNew: (kind: MasterKind) => setTarget({ id: null, kind }),
		onVariantSubmit: async (values: VariantFormSubmit) => {
			if (variant) {
				await updateVariant.mutateAsync(
					{ id: variant.id, ...values },
					{
						groupId: variant.groupId,
						label: variant.label,
						shortLabel: variant.shortLabel,
					}
				);
			} else {
				await createVariant.mutateAsync(values);
			}
			setTarget(null);
		},
	};
}
