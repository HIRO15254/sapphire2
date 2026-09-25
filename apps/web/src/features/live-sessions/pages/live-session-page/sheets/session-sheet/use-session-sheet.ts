import { MIX_VARIANT } from "@sapphire2/db/constants/game-variants";
import { useForm, useStore } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import z from "zod";
import type {
	MasterFieldPatch,
	SessionSnapshotPatch,
} from "@/features/live-sessions/hooks/use-session-settings";
import { useSessionSettings } from "@/features/live-sessions/hooks/use-session-settings";
import {
	type BlindLevelRow,
	blindCellError,
	breakRow,
	defaultLevelMinutes,
	hasBlindRowErrors,
	hasLevelGames,
	labelBlindRows,
	nextLevelRow,
	sameBlindStructure,
	summarizeBlindRows,
	toBlindLevelInputs,
	toBlindLevelRows,
} from "@/features/live-sessions/utils/blind-level-rows";
import {
	autoGroupNames,
	countGames,
	describeMixValidity,
	groupStructure,
	levelGroupsFor,
	matchMixLabel,
	seedMixGroups,
	serializeMixGroups,
} from "@/features/live-sessions/utils/mix-composition";
import {
	findCurrency,
	type MasterFieldKey,
	type SessionTagLike,
} from "@/features/live-sessions/utils/session-settings";
import type { TournamentBlindLevel } from "@/features/live-sessions/utils/tournament-timer";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import {
	optionalNumericString,
	parseOptionalInt,
} from "@/shared/lib/form-fields";
import {
	hasMixCellErrors,
	type MixGameGroupRow,
	mixCellError,
	type ResolveGroup,
	reseedFromLabels,
	rowsFromVariantLabels,
	updateGroup,
} from "@/shared/lib/mix-games";
import { formatHoursMinutes } from "@/utils/format-elapsed-time";
import type { GameTypeTarget, PickedMix } from "../game-type-sheet";
import type { AnteType, SessionDetailLike } from "./session-sheet-view";
import { describeSessionDetail } from "./session-sheet-view";

export type SessionSheetTab = "basics" | "blinds" | "overview";

const TABS: { key: SessionSheetTab; label: string }[] = [
	{ key: "overview", label: "Overview" },
	{ key: "basics", label: "Basics" },
	{ key: "blinds", label: "Blinds" },
];

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10];

const MONEY = optionalNumericString({ integer: true, min: 0 });

const SESSION_FORM_SCHEMA = z.object({
	ante: MONEY,
	anteType: z.enum(["all", "bb", "none"]),
	blind1: MONEY,
	blind2: MONEY,
	blind3: MONEY,
	blindLevels: z.custom<BlindLevelRow[]>(),
	bountyAmount: MONEY,
	currencyId: z.string(),
	entryFee: MONEY,
	maxBuyIn: MONEY,
	memo: z.string(),
	minBuyIn: MONEY,
	mixGroups: z.custom<MixGameGroupRow[]>(),
	ruleName: z.string().trim().min(1, "Required"),
	startingStack: MONEY,
	tableSize: optionalNumericString({ integer: true, max: 10, min: 2 }),
	tagIds: z.array(z.string()),
	tournamentBuyIn: MONEY,
	variant: z.string(),
});

export interface SessionFormValues {
	ante: string;
	anteType: AnteType;
	blind1: string;
	blind2: string;
	blind3: string;
	blindLevels: BlindLevelRow[];
	bountyAmount: string;
	currencyId: string;
	entryFee: string;
	maxBuyIn: string;
	memo: string;
	minBuyIn: string;
	mixGroups: MixGameGroupRow[];
	ruleName: string;
	startingStack: string;
	tableSize: string;
	tagIds: string[];
	tournamentBuyIn: string;
	variant: string;
}

export type BlindCell = "ante" | "blind1" | "blind2" | "blind3" | "minutes";

export type MixStakeSlot = "ante" | "blind1" | "blind2" | "blind3";

const MIX_BLIND_SLOTS = ["blind1", "blind2", "blind3"] as const;

type GameTypeFocus =
	| { kind: "session" }
	| { kind: "level"; levelNumber: number; uid: string };

const MIX_NEEDS_GAMES = "A mix needs at least two games";

function textOf(value: number | null | undefined): string {
	return value === null || value === undefined ? "" : String(value);
}

function normalized(value: string): string {
	return value.trim().toLowerCase();
}

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function stakeCells(row: MixGameGroupRow, resolveGroup: ResolveGroup) {
	const structure = groupStructure(row, resolveGroup);
	const labels = {
		blind1: structure?.blind1Label ?? row.blind1Label,
		blind2: structure?.blind2Label ?? row.blind2Label,
		blind3: structure === null ? row.blind3Label : structure.blind3Label,
	};
	return MIX_BLIND_SLOTS.filter(
		(slot) => slot !== "blind3" || labels.blind3 !== null
	).map((slot) => ({
		error: mixCellError(row[slot]),
		label: labels[slot] ?? "",
		slot: slot as MixStakeSlot,
		value: row[slot],
	}));
}

function buildDefaultValues(
	detail: SessionDetailLike | null,
	blindLevels: readonly TournamentBlindLevel[],
	sessionType: "cash_game" | "tournament",
	resolveGroup: ResolveGroup
): SessionFormValues {
	const view = describeSessionDetail(detail, sessionType);
	return {
		ante: textOf(view.serverNumbers.ante),
		anteType: view.anteType,
		blind1: textOf(view.serverNumbers.blind1),
		blind2: textOf(view.serverNumbers.blind2),
		blind3: textOf(view.serverNumbers.blind3),
		blindLevels:
			sessionType === "tournament"
				? toBlindLevelRows(blindLevels, resolveGroup)
				: [],
		bountyAmount: textOf(view.serverNumbers.bountyAmount),
		currencyId: view.selectedCurrencyId ?? "",
		entryFee: textOf(view.serverNumbers.entryFee),
		maxBuyIn: textOf(view.serverNumbers.maxBuyIn),
		memo: view.memo,
		minBuyIn: textOf(view.serverNumbers.minBuyIn),
		mixGroups: seedMixGroups(view.mixGames, resolveGroup),
		ruleName: view.ruleName,
		startingStack: textOf(view.serverNumbers.startingStack),
		tableSize: view.tableSize === null ? "" : String(view.tableSize),
		tagIds: view.tags.map((tag) => tag.id),
		tournamentBuyIn: textOf(view.serverNumbers.tournamentBuyIn),
		variant: view.variantLabel,
	};
}

function numberOrNull(raw: string): number | null {
	const trimmed = raw.trim();
	return trimmed === "" ? null : (parseOptionalInt(trimmed) ?? null);
}

function buildScalarPatch(
	values: SessionFormValues,
	isCash: boolean,
	isMix: boolean
): SessionSnapshotPatch {
	const patch: SessionSnapshotPatch = {
		ruleName: values.ruleName.trim(),
		tableSize: numberOrNull(values.tableSize),
	};
	if (isCash) {
		patch.ante = isMix ? null : numberOrNull(values.ante);
		patch.anteType = isMix ? null : values.anteType;
		patch.blind1 = isMix ? null : numberOrNull(values.blind1);
		patch.blind2 = isMix ? null : numberOrNull(values.blind2);
		patch.blind3 = isMix ? null : numberOrNull(values.blind3);
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

function buildRulePatch(
	values: SessionFormValues,
	baseline: SessionFormValues,
	isCash: boolean,
	resolveGroup: ResolveGroup
): SessionSnapshotPatch {
	if (isCash) {
		const mixGames = serializeMixGroups(values.mixGroups, resolveGroup);
		const isChanged =
			values.variant !== baseline.variant ||
			JSON.stringify(mixGames) !==
				JSON.stringify(serializeMixGroups(baseline.mixGroups, resolveGroup));
		return isChanged ? { mixGames, variant: values.variant } : {};
	}
	return {
		...(values.variant === baseline.variant
			? null
			: { variant: values.variant }),
		...(sameBlindStructure(
			values.blindLevels,
			baseline.blindLevels,
			resolveGroup
		)
			? null
			: {
					blindLevels: toBlindLevelInputs(values.blindLevels, resolveGroup),
				}),
	};
}

function buildLivePatch(values: SessionFormValues) {
	return {
		...(values.currencyId === "" ? null : { currencyId: values.currencyId }),
		memo: values.memo.trim() === "" ? null : values.memo,
	};
}

interface UseSessionSheetOptions {
	currentBlindLevelId: string | null;
	initialTab: SessionSheetTab;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}

export type SessionForm = ReturnType<typeof useSessionSheet>["form"];

export type MixStakesView = ReturnType<
	typeof useSessionSheet
>["mixStakes"][number];

export type BlindRowView = ReturnType<
	typeof useSessionSheet
>["blinds"]["rows"][number];

export function useSessionSheet({
	currentBlindLevelId,
	initialTab,
	onOpenChange,
	open,
	sessionId,
	sessionType,
}: UseSessionSheetOptions) {
	const settings = useSessionSettings({ sessionId, sessionType });
	const {
		groupFor,
		isMixValue,
		labelsFor,
		mixCompositionLabels,
		mixes,
		variants,
	} = useGameGroups();
	const isCash = sessionType === "cash_game";
	const [tab, setTab] = useState<SessionSheetTab>(initialTab);
	const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
	const [isGameTypeOpen, setIsGameTypeOpen] = useState(false);
	const [gameTypeFocus, setGameTypeFocus] = useState<GameTypeFocus>({
		kind: "session",
	});
	const [defaultMinutes, setDefaultMinutes] = useState("");

	const findRuleIssue = (values: SessionFormValues): SessionSheetTab | null => {
		if (isCash) {
			return isMixValue(values.variant) &&
				!(
					describeMixValidity(values.mixGroups).isValid &&
					!hasMixCellErrors(values.mixGroups)
				)
				? "basics"
				: null;
		}
		return hasBlindRowErrors(values.blindLevels) ? "blinds" : null;
	};

	const form = useForm({
		defaultValues: buildDefaultValues(
			settings.detail,
			settings.blindLevels,
			sessionType,
			groupFor
		),
		onSubmit: async ({ value }) => {
			const ruleIssue = findRuleIssue(value);
			if (ruleIssue !== null) {
				setTab(ruleIssue);
				return;
			}
			const baseline = buildDefaultValues(
				settings.detail,
				settings.blindLevels,
				sessionType,
				groupFor
			);
			await Promise.all([
				settings.onUpdateSnapshot({
					...buildScalarPatch(value, isCash, isMixValue(value.variant)),
					...buildRulePatch(value, baseline, isCash, groupFor),
				}),
				settings.onUpdateLive(buildLivePatch(value)),
				settings.onUpdateTags(value.tagIds),
			]);
			onOpenChange(false);
		},
		onSubmitInvalid: () => setTab("basics"),
		validators: { onSubmit: SESSION_FORM_SCHEMA },
	});

	const isReady =
		settings.detail !== null && (isCash || settings.hasBlindLevels);
	const seedPhaseRef = useRef<"closed" | "pending" | "seeded">("closed");
	useEffect(() => {
		if (!open) {
			seedPhaseRef.current = "closed";
			return;
		}
		const defaults = buildDefaultValues(
			settings.detail,
			settings.blindLevels,
			sessionType,
			groupFor
		);
		if (seedPhaseRef.current === "closed") {
			form.reset(defaults);
			setTab(initialTab);
			setIsCurrencyOpen(false);
			setIsGameTypeOpen(false);
			setDefaultMinutes(defaultLevelMinutes(defaults.blindLevels));
			seedPhaseRef.current = isReady ? "seeded" : "pending";
			return;
		}
		if (seedPhaseRef.current === "pending" && isReady) {
			if (!form.state.isDirty) {
				form.reset(defaults);
				setDefaultMinutes(defaultLevelMinutes(defaults.blindLevels));
			}
			seedPhaseRef.current = "seeded";
		}
	}, [
		open,
		form,
		groupFor,
		initialTab,
		isReady,
		settings.blindLevels,
		settings.detail,
		sessionType,
	]);

	const variant = useStore(form.store, (state) => state.values.variant);
	const mixGroups = useStore(form.store, (state) => state.values.mixGroups);
	const blindLevels = useStore(form.store, (state) => state.values.blindLevels);

	const view = describeSessionDetail(settings.detail, sessionType);
	const isMix = isMixValue(variant);
	const blindLabels = labelsFor(variant);

	const variantRow = variants.find(
		(row) => normalized(row.label) === normalized(variant)
	);
	const shortLabelByLabel = new Map(
		variants.map((row) => [normalized(row.label), row.shortLabel ?? row.label])
	);
	const describeGameType = (): { code: string | null; name: string } => {
		if (variant.trim() === "") {
			return { code: null, name: "Not set" };
		}
		if (normalized(variant) === MIX_VARIANT) {
			return { code: null, name: "Custom mix" };
		}
		return { code: variantRow?.shortLabel ?? null, name: variant };
	};

	const setBlindLevels = (update: (rows: BlindLevelRow[]) => BlindLevelRow[]) =>
		form.setFieldValue("blindLevels", update);

	const labeledRows = labelBlindRows(blindLevels);
	let breakCount = 0;
	const groupLabels = labeledRows.map((meta) => {
		if (meta.levelNumber !== null) {
			return `Level ${meta.levelNumber}`;
		}
		breakCount += 1;
		return `Break ${breakCount}`;
	});
	const blindSummary = summarizeBlindRows(blindLevels);

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
		const values = form.state.values;
		const patch: MasterFieldPatch = {
			...buildScalarPatch(values, isCash, isMixValue(values.variant)),
			...(values.currencyId === "" ? null : { currencyId: values.currencyId }),
		};
		await settings.onSyncMasterFromSession(patch);
	};

	const codesOf = (labels: readonly string[]) =>
		labels
			.map((label) => shortLabelByLabel.get(normalized(label)) ?? label)
			.join(" · ");
	const groupNames = (rows: readonly MixGameGroupRow[]) => {
		const autoNames = autoGroupNames(rows, groupFor);
		return rows.map(
			(row, index) =>
				row.name?.trim() || autoNames[index] || `Group ${index + 1}`
		);
	};

	const mixCandidates = mixes.map((mix) => ({
		groups: rowsFromVariantLabels(mixCompositionLabels(mix.label), groupFor),
		label: mix.label,
	}));
	const levelSelection = (games: readonly MixGameGroupRow[]): string => {
		const labels = games.flatMap((group) => group.variants);
		const [only] = labels;
		if (only === undefined) {
			return "";
		}
		if (labels.length === 1) {
			return only;
		}
		return matchMixLabel(games, mixCandidates) ?? MIX_VARIANT;
	};
	const levelGameName = (games: readonly MixGameGroupRow[]): string => {
		const selection = levelSelection(games);
		return selection === MIX_VARIANT
			? codesOf(games.flatMap((group) => group.variants))
			: selection;
	};

	const setLevelGames = (uid: string, labels: readonly string[] | null) =>
		setBlindLevels((rows) =>
			rows.map((row) =>
				row.uid === uid
					? {
							...row,
							games:
								labels === null
									? null
									: levelGroupsFor(row.games ?? [], labels, groupFor),
						}
					: row
			)
		);

	const onPickVariant = (label: string) => {
		if (gameTypeFocus.kind === "level") {
			setLevelGames(gameTypeFocus.uid, [label]);
		} else {
			form.setFieldValue("variant", label);
			form.setFieldValue("mixGroups", []);
		}
		setIsGameTypeOpen(false);
	};

	const onPickMix = ({ games, label }: PickedMix) => {
		if (gameTypeFocus.kind === "level") {
			setLevelGames(gameTypeFocus.uid, games);
		} else {
			form.setFieldValue("variant", label);
			if (isCash) {
				form.setFieldValue("mixGroups", (current) =>
					reseedFromLabels(current, games, groupFor)
				);
			}
		}
		setIsGameTypeOpen(false);
	};

	const onClearLevelGames = () => {
		if (gameTypeFocus.kind === "level") {
			setLevelGames(gameTypeFocus.uid, null);
		}
		setIsGameTypeOpen(false);
	};

	const gameTypeTarget: GameTypeTarget =
		gameTypeFocus.kind === "level"
			? {
					kind: "level",
					levelNumber: gameTypeFocus.levelNumber,
					selection: levelSelection(
						blindLevels.find((row) => row.uid === gameTypeFocus.uid)?.games ??
							[]
					),
				}
			: { isCash, kind: "session", variant };

	const compositionValidity = describeMixValidity(mixGroups);
	const describeCompositionError = (): string | null => {
		if (!(isCash && isMix) || compositionValidity.isValid) {
			return null;
		}
		return countGames(mixGroups) < 2
			? MIX_NEEDS_GAMES
			: compositionValidity.label;
	};
	const mixGroupNames = groupNames(mixGroups);
	const mixStakes =
		isCash && isMix
			? mixGroups.map((row, index) => ({
					ante: { error: mixCellError(row.ante), value: row.ante },
					anteType: row.anteType,
					blinds: stakeCells(row, groupFor),
					codes: codesOf(row.variants),
					name: mixGroupNames[index] ?? "",
					uid: row.uid,
				}))
			: [];
	const setMixGroups = (
		update: (rows: MixGameGroupRow[]) => MixGameGroupRow[]
	) => form.setFieldValue("mixGroups", update);

	return {
		availableTags: settings.availableTags,
		blindLabels,
		blinds: {
			rows: blindLevels.map((row, index) => {
				const games = hasLevelGames(row) ? (row.games ?? []) : [];
				const names = groupNames(games);
				const levelNumber = labeledRows[index]?.levelNumber ?? null;
				return {
					ante: row.ante,
					blind1: row.blind1,
					blind2: row.blind2,
					blind3: row.blind3,
					errors: {
						ante: blindCellError(row, "ante"),
						blind1: blindCellError(row, "blind1"),
						blind2: blindCellError(row, "blind2"),
						blind3: blindCellError(row, "blind3"),
						minutes: blindCellError(row, "minutes"),
					},
					gameGroups: games.map((group, groupIndex) => ({
						cells: [
							...stakeCells(group, groupFor),
							{
								error: mixCellError(group.ante),
								label: "Ante",
								slot: "ante" as MixStakeSlot,
								value: group.ante,
							},
						],
						codes: codesOf(group.variants),
						name: names[groupIndex] ?? "",
						uid: group.uid,
					})),
					gamesName: games.length === 0 ? null : levelGameName(games),
					groupLabel: groupLabels[index] ?? "",
					isBreak: row.isBreak,
					isCurrent: row.uid === currentBlindLevelId,
					label: labeledRows[index]?.label ?? "",
					levelNumber,
					minutes: row.minutes,
					uid: row.uid,
				};
			}),
			summary: `${plural(blindSummary.levelCount, "level")} · ${formatHoursMinutes(blindSummary.totalMinutes)}`,
		},
		currencyOptions: settings.currencies.map((row) => ({
			balance: row.balance,
			id: row.id,
			isFavorite: row.isFavorite,
			name: row.name,
			unit: row.unit,
		})),
		defaultMinutes,
		findCurrency: (currencyId: string) =>
			findCurrency(settings.currencies, currencyId),
		form,
		gameType: describeGameType(),
		gameTypeError: describeCompositionError(),
		gameTypeSheet: {
			onClear: onClearLevelGames,
			onOpenChange: setIsGameTypeOpen,
			onPickMix,
			onPickVariant,
			open: isGameTypeOpen,
			target: gameTypeTarget,
		},
		isCash,
		isCurrencyOpen,
		isMasterLinked: view.isMasterLinked,
		isMix,
		isSaving: settings.isSaving,
		isSyncingMaster: settings.isSyncingMaster,
		master: view.master,
		masterValues: settings.master,
		mixStakes,
		onAddBlindBreak: () =>
			setBlindLevels((rows) => [...rows, breakRow(crypto.randomUUID())]),
		onAddBlindLevel: () =>
			setBlindLevels((rows) => [
				...rows,
				nextLevelRow(rows, defaultMinutes, crypto.randomUUID()),
			]),
		onBlindCellChange: (uid: string, cell: BlindCell, value: string) =>
			setBlindLevels((rows) =>
				rows.map((row) => (row.uid === uid ? { ...row, [cell]: value } : row))
			),
		onCreateTag: async (name: string): Promise<SessionTagLike> => {
			const created = await settings.onCreateTag(name);
			if (!created) {
				throw new Error("Failed to create session tag");
			}
			return { id: created.id, name: created.name };
		},
		onCurrencyOpenChange: setIsCurrencyOpen,
		onDefaultMinutesChange: setDefaultMinutes,
		onLevelGameStakeChange: (
			levelUid: string,
			groupUid: string,
			slot: MixStakeSlot,
			value: string
		) =>
			setBlindLevels((rows) =>
				rows.map((row) =>
					row.uid === levelUid
						? {
								...row,
								games: updateGroup(row.games ?? [], groupUid, {
									[slot]: value,
								}),
							}
						: row
				)
			),
		onMixAnteTypeChange: (uid: string, anteType: AnteType) =>
			setMixGroups((rows) => updateGroup(rows, uid, { anteType })),
		onMixStakeChange: (uid: string, slot: MixStakeSlot, value: string) =>
			setMixGroups((rows) => updateGroup(rows, uid, { [slot]: value })),
		onOpenCurrency: () => setIsCurrencyOpen(true),
		onOpenGameType: () => {
			setGameTypeFocus({ kind: "session" });
			setIsGameTypeOpen(true);
		},
		onOpenLevelGames: (uid: string, levelNumber: number) => {
			setGameTypeFocus({ kind: "level", levelNumber, uid });
			setIsGameTypeOpen(true);
		},
		onPushToMaster,
		onRemoveBlindRow: (uid: string) =>
			setBlindLevels((rows) => rows.filter((row) => row.uid !== uid)),
		onResetToMaster,
		onSelectTab: setTab,
		roomName: view.roomName,
		tab,
		tableSizes: TABLE_SIZES,
		tabs: TABS.filter((entry) => !isCash || entry.key !== "blinds").map(
			(entry) => ({ ...entry, isActive: entry.key === tab })
		),
	};
}
