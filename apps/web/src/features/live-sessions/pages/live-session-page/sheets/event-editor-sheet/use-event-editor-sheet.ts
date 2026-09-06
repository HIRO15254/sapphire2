import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import z from "zod";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import { refineWinsNotExceedingTrials } from "@/features/live-sessions/utils/all-in-validation";
import {
	applyTimeToDate,
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/features/live-sessions/utils/stack-editor-time";
import type { EventEditorKind } from "@/features/live-sessions/utils/timeline-view";
import {
	optionalNumericString,
	parseOptionalInt,
	requiredNumericString,
} from "@/shared/lib/form-fields";

export type EventEditorMode = "create" | "edit";

export interface ChipPurchaseOption {
	chips: number;
	cost: number;
	id: string;
	name: string;
}

export interface EventEditorTarget {
	event: SessionEvent | null;
	kind: EventEditorKind;
	label: string;
	mode: EventEditorMode;
	openedAt: Date;
}

export interface EventEditorSubmit {
	occurredAt: number | undefined;
	payload: Record<string, unknown> | null;
}

interface UseEventEditorSheetOptions {
	chipPurchaseOptions: ChipPurchaseOption[];
	isTournament: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (values: EventEditorSubmit) => void;
	target: EventEditorTarget;
}

const MS_PER_SECOND = 1000;

const baseSchema = z.object({
	amount: z.string(),
	buyInAmount: z.string(),
	direction: z.enum(["add", "remove"]),
	equity: z.string(),
	memoText: z.string(),
	potSize: z.string(),
	purchaseId: z.string(),
	remainingPlayers: z.string(),
	stackAmount: z.string(),
	time: z.string().min(1, "Required"),
	timerStart: z.string(),
	totalEntries: z.string(),
	trials: z.string(),
	wins: z.string(),
});

function toPayload(payload: unknown): Record<string, unknown> {
	return payload && typeof payload === "object"
		? (payload as Record<string, unknown>)
		: {};
}

function numberField(payload: Record<string, unknown>, key: string) {
	const value = payload[key];
	return typeof value === "number" ? String(value) : "";
}

function baseDateOf(target: EventEditorTarget): Date {
	return target.event === null
		? target.openedAt
		: new Date(target.event.occurredAt);
}

function buildDefaults(target: EventEditorTarget) {
	const payload = toPayload(target.event?.payload);
	const rawAmount = payload.amount;
	const amount = typeof rawAmount === "number" ? rawAmount : null;
	const timerStartedAt = payload.timerStartedAt;

	return {
		amount: amount === null ? "" : String(Math.abs(amount)),
		buyInAmount: numberField(payload, "buyInAmount"),
		direction: (amount !== null && amount < 0 ? "remove" : "add") as
			| "add"
			| "remove",
		equity: numberField(payload, "equity"),
		memoText: typeof payload.text === "string" ? payload.text : "",
		potSize: numberField(payload, "potSize"),
		purchaseId:
			typeof payload.sessionChipPurchaseId === "string"
				? payload.sessionChipPurchaseId
				: "",
		remainingPlayers: numberField(payload, "remainingPlayers"),
		stackAmount: numberField(payload, "stackAmount"),
		time: toTimeInputValue(baseDateOf(target)),
		timerStart:
			typeof timerStartedAt === "number"
				? toTimeInputValue(new Date(timerStartedAt * MS_PER_SECOND))
				: "",
		totalEntries: numberField(payload, "totalEntries"),
		trials: numberField(payload, "trials"),
		wins: numberField(payload, "wins"),
	};
}

export type EventEditorValues = ReturnType<typeof buildDefaults>;

function buildSchema(kind: EventEditorKind, isTournament: boolean) {
	switch (kind) {
		case "stack":
			return baseSchema.extend({
				remainingPlayers: optionalNumericString({ integer: true, min: 1 }),
				stackAmount: requiredNumericString({ integer: true, min: 0 }),
				totalEntries: optionalNumericString({ integer: true, min: 1 }),
			});
		case "allin":
			return baseSchema
				.extend({
					equity: requiredNumericString({ max: 100, min: 0 }),
					potSize: requiredNumericString({ integer: true, min: 0 }),
					trials: requiredNumericString({ integer: true, min: 1 }),
					wins: requiredNumericString({ min: 0 }),
				})
				.superRefine(refineWinsNotExceedingTrials);
		case "chips":
			return baseSchema.extend({
				amount: requiredNumericString({ integer: true, min: 1 }),
				direction: z.enum(["add", "remove"]),
			});
		case "memo":
			return baseSchema.extend({
				memoText: z.string().trim().min(1, "Required"),
			});
		case "purchase":
			return baseSchema.extend({
				purchaseId: z.string().min(1, "Required"),
			});
		case "start":
			return isTournament
				? baseSchema
				: baseSchema.extend({
						buyInAmount: requiredNumericString({ integer: true, min: 0 }),
					});
		default:
			return baseSchema;
	}
}

function buildStackPayload(
	values: EventEditorValues,
	target: EventEditorTarget,
	isTournament: boolean
): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		stackAmount: Number(values.stackAmount),
	};
	if (!isTournament) {
		return payload;
	}
	payload.remainingPlayers = parseOptionalInt(values.remainingPlayers) ?? null;
	payload.totalEntries = parseOptionalInt(values.totalEntries) ?? null;
	const counts = toPayload(target.event?.payload).chipPurchaseCounts;
	if (Array.isArray(counts)) {
		payload.chipPurchaseCounts = counts;
	}
	return payload;
}

function buildPurchasePayload(
	values: EventEditorValues,
	options: ChipPurchaseOption[]
): Record<string, unknown> | null {
	const option = options.find((item) => item.id === values.purchaseId);
	if (!option) {
		return null;
	}
	return {
		chips: option.chips,
		cost: option.cost,
		name: option.name,
		sessionChipPurchaseId: option.id,
	};
}

function buildStartPayload(
	values: EventEditorValues,
	target: EventEditorTarget,
	isTournament: boolean
): Record<string, unknown> {
	if (!isTournament) {
		return { buyInAmount: Number(values.buyInAmount) };
	}
	if (values.timerStart === "") {
		return { timerStartedAt: null };
	}
	const started = applyTimeToDate(baseDateOf(target), values.timerStart);
	return { timerStartedAt: Math.floor(started.getTime() / MS_PER_SECOND) };
}

function buildPayload(
	values: EventEditorValues,
	target: EventEditorTarget,
	options: UseEventEditorSheetOptions
): Record<string, unknown> | null {
	switch (target.kind) {
		case "stack":
			return buildStackPayload(values, target, options.isTournament);
		case "allin":
			return {
				equity: Number(values.equity),
				potSize: Number(values.potSize),
				trials: Number(values.trials),
				wins: Number(values.wins),
			};
		case "chips": {
			const magnitude = Math.round(Number(values.amount));
			return {
				amount: values.direction === "remove" ? -magnitude : magnitude,
			};
		}
		case "memo":
			return { text: values.memoText.trim() };
		case "purchase":
			return buildPurchasePayload(values, options.chipPurchaseOptions);
		case "start":
			return buildStartPayload(values, target, options.isTournament);
		default:
			return null;
	}
}

export function useEventEditorSheet(options: UseEventEditorSheetOptions) {
	const { maxTime, minTime, onSubmit, target } = options;

	const form = useForm({
		defaultValues: buildDefaults(target),
		onSubmit: ({ value }) => {
			onSubmit({
				occurredAt: toOccurredAtTimestamp(baseDateOf(target), value.time),
				payload: buildPayload(value, target, options),
			});
		},
		validators: {
			onSubmit: buildSchema(target.kind, options.isTournament),
		},
	});

	useEffect(() => {
		form.reset(buildDefaults(target));
	}, [form, target]);

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, baseDateOf(target), minTime, maxTime) ??
		undefined;

	return { form, timeValidator };
}
