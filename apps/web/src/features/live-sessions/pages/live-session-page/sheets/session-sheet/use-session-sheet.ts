import { useForm } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import z from "zod";
import type {
	MasterFieldPatch,
	SessionSnapshotPatch,
} from "@/features/live-sessions/hooks/use-session-settings";
import { useSessionSettings } from "@/features/live-sessions/hooks/use-session-settings";
import {
	findCurrency,
	type MasterFieldKey,
	type SessionTagLike,
} from "@/features/live-sessions/utils/session-settings";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import {
	optionalNumericString,
	parseOptionalInt,
} from "@/shared/lib/form-fields";
import type { AnteType, SessionDetailLike } from "./session-sheet-view";
import { describeSessionDetail } from "./session-sheet-view";

export type SessionSheetTab = "basics" | "overview";

const TABS: { key: SessionSheetTab; label: string }[] = [
	{ key: "overview", label: "Overview" },
	{ key: "basics", label: "Basics" },
];

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10];

const MONEY = optionalNumericString({ integer: true, min: 0 });

const SESSION_FORM_SCHEMA = z.object({
	ante: MONEY,
	anteType: z.enum(["all", "bb", "none"]),
	blind1: MONEY,
	blind2: MONEY,
	blind3: MONEY,
	bountyAmount: MONEY,
	currencyId: z.string(),
	entryFee: MONEY,
	maxBuyIn: MONEY,
	memo: z.string(),
	minBuyIn: MONEY,
	ruleName: z.string().trim().min(1, "Required"),
	startingStack: MONEY,
	tableSize: optionalNumericString({ integer: true, max: 10, min: 2 }),
	tagIds: z.array(z.string()),
	tournamentBuyIn: MONEY,
});

export interface SessionFormValues {
	ante: string;
	anteType: AnteType;
	blind1: string;
	blind2: string;
	blind3: string;
	bountyAmount: string;
	currencyId: string;
	entryFee: string;
	maxBuyIn: string;
	memo: string;
	minBuyIn: string;
	ruleName: string;
	startingStack: string;
	tableSize: string;
	tagIds: string[];
	tournamentBuyIn: string;
}

function textOf(value: number | null | undefined): string {
	return value === null || value === undefined ? "" : String(value);
}

function buildDefaultValues(
	detail: SessionDetailLike | null,
	sessionType: "cash_game" | "tournament"
): SessionFormValues {
	const view = describeSessionDetail(detail, sessionType);
	return {
		ante: textOf(view.serverNumbers.ante),
		anteType: view.anteType,
		blind1: textOf(view.serverNumbers.blind1),
		blind2: textOf(view.serverNumbers.blind2),
		blind3: textOf(view.serverNumbers.blind3),
		bountyAmount: textOf(view.serverNumbers.bountyAmount),
		currencyId: view.selectedCurrencyId ?? "",
		entryFee: textOf(view.serverNumbers.entryFee),
		maxBuyIn: textOf(view.serverNumbers.maxBuyIn),
		memo: view.memo,
		minBuyIn: textOf(view.serverNumbers.minBuyIn),
		ruleName: view.ruleName,
		startingStack: textOf(view.serverNumbers.startingStack),
		tableSize: view.tableSize === null ? "" : String(view.tableSize),
		tagIds: view.tags.map((tag) => tag.id),
		tournamentBuyIn: textOf(view.serverNumbers.tournamentBuyIn),
	};
}

function numberOrNull(raw: string): number | null {
	const trimmed = raw.trim();
	return trimmed === "" ? null : (parseOptionalInt(trimmed) ?? null);
}

function buildSnapshotPatch(
	values: SessionFormValues,
	isCash: boolean
): SessionSnapshotPatch {
	const patch: SessionSnapshotPatch = {
		ruleName: values.ruleName.trim(),
		tableSize: numberOrNull(values.tableSize),
	};
	if (isCash) {
		patch.ante = numberOrNull(values.ante);
		patch.anteType = values.anteType;
		patch.blind1 = numberOrNull(values.blind1);
		patch.blind2 = numberOrNull(values.blind2);
		patch.blind3 = numberOrNull(values.blind3);
		patch.maxBuyIn = numberOrNull(values.maxBuyIn);
		patch.minBuyIn = numberOrNull(values.minBuyIn);
	} else {
		patch.bountyAmount = numberOrNull(values.bountyAmount);
		patch.entryFee = numberOrNull(values.entryFee);
		patch.startingStack = numberOrNull(values.startingStack);
		patch.tournamentBuyIn = numberOrNull(values.tournamentBuyIn);
	}
	return patch;
}

function buildLivePatch(values: SessionFormValues) {
	return {
		...(values.currencyId === "" ? null : { currencyId: values.currencyId }),
		memo: values.memo.trim() === "" ? null : values.memo,
	};
}

function buildMasterPatch(
	values: SessionFormValues,
	isCash: boolean
): MasterFieldPatch {
	return {
		...buildSnapshotPatch(values, isCash),
		...(values.currencyId === "" ? null : { currencyId: values.currencyId }),
	};
}

interface UseSessionSheetOptions {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}

export type SessionForm = ReturnType<typeof useSessionSheet>["form"];

export function useSessionSheet({
	onOpenChange,
	open,
	sessionId,
	sessionType,
}: UseSessionSheetOptions) {
	const settings = useSessionSettings({ sessionId, sessionType });
	const { labelsFor } = useGameGroups();
	const isCash = sessionType === "cash_game";
	const [tab, setTab] = useState<SessionSheetTab>("overview");
	const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);

	const form = useForm({
		defaultValues: buildDefaultValues(settings.detail, sessionType),
		onSubmit: async ({ value }) => {
			await Promise.all([
				settings.onUpdateSnapshot(buildSnapshotPatch(value, isCash)),
				settings.onUpdateLive(buildLivePatch(value)),
				settings.onUpdateTags(value.tagIds),
			]);
			onOpenChange(false);
		},
		validators: { onSubmit: SESSION_FORM_SCHEMA },
	});

	const wasOpenRef = useRef(open);
	useEffect(() => {
		if (open && !wasOpenRef.current) {
			form.reset(buildDefaultValues(settings.detail, sessionType));
		}
		wasOpenRef.current = open;
	}, [open, form, settings.detail, sessionType]);

	const view = describeSessionDetail(settings.detail, sessionType);

	const onResetToMaster = () => {
		const master = settings.master;
		if (master === null) {
			return;
		}
		for (const [key, value] of Object.entries(master) as [
			MasterFieldKey,
			string,
		][]) {
			if (key === "anteType") {
				form.setFieldValue("anteType", value as SessionFormValues["anteType"]);
				continue;
			}
			form.setFieldValue(key as Exclude<MasterFieldKey, "anteType">, value);
		}
	};

	const onPushToMaster = async () => {
		await settings.onSyncMasterFromSession(
			buildMasterPatch(form.state.values, isCash)
		);
	};

	return {
		availableTags: settings.availableTags,
		blindLabels: labelsFor(view.variantLabel),
		currencyOptions: settings.currencies.map((row) => ({
			balance: row.balance,
			id: row.id,
			isFavorite: row.isFavorite,
			name: row.name,
			unit: row.unit,
		})),
		findCurrency: (currencyId: string) =>
			findCurrency(settings.currencies, currencyId),
		form,
		isCash,
		isCurrencyOpen,
		isMasterLinked: view.isMasterLinked,
		isSaving: settings.isSaving,
		isSyncingMaster: settings.isSyncingMaster,
		master: view.master,
		masterValues: settings.master,
		onCreateTag: async (name: string): Promise<SessionTagLike> => {
			const created = await settings.onCreateTag(name);
			if (!created) {
				throw new Error("Failed to create session tag");
			}
			return { id: created.id, name: created.name };
		},
		onCurrencyOpenChange: setIsCurrencyOpen,
		onOpenCurrency: () => setIsCurrencyOpen(true),
		onPushToMaster,
		onResetToMaster,
		onSelectTab: setTab,
		roomName: view.roomName,
		tab,
		tableSizes: TABLE_SIZES,
		tabs: TABS.map((entry) => ({ ...entry, isActive: entry.key === tab })),
		variantLabel: view.variantLabel,
	};
}
