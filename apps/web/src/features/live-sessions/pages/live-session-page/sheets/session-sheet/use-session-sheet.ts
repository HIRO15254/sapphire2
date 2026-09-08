import { useState } from "react";
import { useSessionSettings } from "@/features/live-sessions/hooks/use-session-settings";
import {
	filterTagCandidates,
	findExactTag,
} from "@/features/live-sessions/utils/session-settings";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import { parseOptionalInt } from "@/shared/lib/form-fields";
import {
	blindFieldDefs,
	CASH_NUMBER_FIELDS,
	TOURNAMENT_NUMBER_FIELDS,
	toBasicsFields,
} from "./session-basics-fields";
import type { AnteType } from "./session-sheet-view";
import { describeSessionDetail } from "./session-sheet-view";
import { useSessionDrafts } from "./use-session-drafts";

export type SessionSheetTab = "basics" | "overview";

const TABS: { key: SessionSheetTab; label: string }[] = [
	{ key: "overview", label: "Overview" },
	{ key: "basics", label: "Basics" },
];

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10];

interface UseSessionSheetOptions {
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}

export function useSessionSheet({
	sessionId,
	sessionType,
}: UseSessionSheetOptions) {
	const settings = useSessionSettings({ sessionId, sessionType });
	const { labelsFor } = useGameGroups();
	const drafts = useSessionDrafts();
	const [tab, setTab] = useState<SessionSheetTab>("overview");
	const [tagQuery, setTagQuery] = useState("");
	const [isTagListOpen, setIsTagListOpen] = useState(false);
	const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);

	const view = describeSessionDetail(settings.detail, sessionType);
	const isCash = sessionType === "cash_game";
	const selectedTagIds = view.tags.map((tag) => tag.id);

	const onCommitField = (name: string) => {
		const draft = drafts.takeDraft(name);
		if (draft === undefined) {
			return;
		}
		const trimmed = draft.trim();
		const parsed = trimmed === "" ? null : parseOptionalInt(trimmed);
		if (parsed !== undefined) {
			settings.onUpdateSnapshot({ [name]: parsed });
		}
	};

	const onCommitRuleName = () => {
		const trimmed = drafts.takeDraft("ruleName")?.trim();
		if (trimmed !== undefined && trimmed !== "") {
			settings.onUpdateSnapshot({ ruleName: trimmed });
		}
	};

	const onCommitMemo = () => {
		const draft = drafts.takeDraft("memo");
		if (draft !== undefined) {
			settings.onUpdateLive({ memo: draft.trim() === "" ? null : draft });
		}
	};

	const onAddTag = async (name: string) => {
		const trimmed = name.trim();
		if (trimmed === "") {
			return;
		}
		setTagQuery("");
		setIsTagListOpen(false);
		const existing = findExactTag(settings.availableTags, trimmed);
		const tagId = existing
			? existing.id
			: ((await settings.onCreateTag(trimmed))?.id ?? null);
		if (tagId !== null && !selectedTagIds.includes(tagId)) {
			settings.onUpdateTags([...selectedTagIds, tagId]);
		}
	};

	return {
		anteType: view.anteType,
		blindFields: isCash
			? toBasicsFields(
					blindFieldDefs(labelsFor(view.variantLabel)),
					view.serverNumbers,
					drafts.textOf
				)
			: [],
		currencyLabel: view.currencyLabel,
		currencyUnit: view.currencyUnit,
		currencyOptions: settings.currencies.map((row) => ({
			id: row.id,
			isFavorite: row.isFavorite,
			name: row.name,
			unit: row.unit,
		})),
		isCash,
		isCurrencyOpen,
		isCurrencyPending: settings.isCurrencyPending,
		isLoading: settings.isLoading,
		isMasterLinked: view.isMasterLinked,
		isTagListOpen,
		master: view.master,
		memoValue: drafts.textOf("memo", view.memo),
		numberFields: toBasicsFields(
			isCash ? CASH_NUMBER_FIELDS : TOURNAMENT_NUMBER_FIELDS,
			view.serverNumbers,
			drafts.textOf
		),
		onAddTag,
		onCloseTagList: () => setIsTagListOpen(false),
		onCommitField,
		onCommitMemo,
		onCommitRuleName,
		onCreateCurrency: settings.onCreateCurrency,
		onCurrencyOpenChange: setIsCurrencyOpen,
		onDraftChange: drafts.onDraftChange,
		onOpenCurrency: () => setIsCurrencyOpen(true),
		onOpenTagList: () => setIsTagListOpen(true),
		onPickCurrency: (currencyId: string) => {
			settings.onUpdateLive({ currencyId });
			setIsCurrencyOpen(false);
		},
		onRemoveTag: (tagId: string) => {
			settings.onUpdateTags(selectedTagIds.filter((id) => id !== tagId));
		},
		onSelectAnteType: (anteType: AnteType) => {
			settings.onUpdateSnapshot({ anteType });
		},
		onSelectTab: setTab,
		onSelectTableSize: (tableSize: number) => {
			settings.onUpdateSnapshot({ tableSize });
		},
		onTagQueryChange: setTagQuery,
		roomName: view.roomName,
		ruleNameValue: drafts.textOf("ruleName", view.ruleName),
		selectedCurrencyId: view.selectedCurrencyId,
		selectedTags: view.tags,
		tab,
		tableSize: view.tableSize,
		tableSizes: TABLE_SIZES,
		tabs: TABS.map((entry) => ({ ...entry, isActive: entry.key === tab })),
		tagCandidates: filterTagCandidates(
			settings.availableTags,
			selectedTagIds,
			tagQuery
		),
		tagQuery,
		variantLabel: view.variantLabel,
	};
}
