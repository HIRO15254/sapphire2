import { useState } from "react";
import {
	PROCEDURE_KEYS,
	PROCEDURES,
	type ProcedureMeta,
} from "@/features/api-tester/procedures";
import { trpcClient } from "@/utils/trpc";

type RunStatus = "idle" | "running" | "success" | "error";

interface RunResult {
	durationMs?: number;
	error?: string;
	status: RunStatus;
	value?: unknown;
}

const DEFAULT_KEY = PROCEDURE_KEYS[0];

function findProcedure(key: string): ProcedureMeta | undefined {
	return PROCEDURES.find((p) =>
		p.procedure === "" ? p.router === key : `${p.router}.${p.procedure}` === key
	);
}

function buildLabel(meta: ProcedureMeta): string {
	const ns =
		meta.procedure === "" ? meta.router : `${meta.router}.${meta.procedure}`;
	return `${ns} [${meta.kind}]`;
}

function getProcedureCallable(meta: ProcedureMeta): {
	query?: (input: unknown) => Promise<unknown>;
	mutate?: (input: unknown) => Promise<unknown>;
} {
	const client = trpcClient as unknown as Record<string, unknown>;
	const routerSlot = client[meta.router];
	if (!routerSlot) {
		throw new Error(`Router not found: ${meta.router}`);
	}
	const target =
		meta.procedure === ""
			? routerSlot
			: (routerSlot as Record<string, unknown>)[meta.procedure];
	if (!target) {
		throw new Error(`Procedure not found: ${meta.router}.${meta.procedure}`);
	}
	return target as ReturnType<typeof getProcedureCallable>;
}

export function useApiTester() {
	const [selectedKey, setSelectedKey] = useState<string>(DEFAULT_KEY);
	const [input, setInput] = useState<string>("");
	const [result, setResult] = useState<RunResult>({ status: "idle" });

	const options = PROCEDURES.map((meta) => ({
		key:
			meta.procedure === "" ? meta.router : `${meta.router}.${meta.procedure}`,
		label: buildLabel(meta),
	}));

	const selectedMeta = findProcedure(selectedKey);
	const inputHint = selectedMeta?.inputHint ?? "";

	const handleSelectChange = (next: string) => {
		setSelectedKey(next);
		const meta = findProcedure(next);
		setInput(meta?.inputHint ?? "");
		setResult({ status: "idle" });
	};

	const handleInputChange = (next: string) => {
		setInput(next);
	};

	const handleClear = () => {
		setResult({ status: "idle" });
	};

	const handleRun = async () => {
		if (!selectedMeta) {
			setResult({ status: "error", error: "No procedure selected" });
			return;
		}
		let parsedInput: unknown;
		const trimmed = input.trim();
		if (trimmed.length > 0) {
			try {
				parsedInput = JSON.parse(trimmed);
			} catch (e) {
				setResult({
					status: "error",
					error: `Input is not valid JSON: ${(e as Error).message}`,
				});
				return;
			}
		}
		setResult({ status: "running" });
		const startedAt = performance.now();
		try {
			const callable = getProcedureCallable(selectedMeta);
			const fn =
				selectedMeta.kind === "query" ? callable.query : callable.mutate;
			if (!fn) {
				throw new Error(
					`Callable not found for ${selectedMeta.router}.${selectedMeta.procedure} (${selectedMeta.kind})`
				);
			}
			const value = await fn(parsedInput);
			const durationMs = Math.round(performance.now() - startedAt);
			setResult({ status: "success", durationMs, value });
		} catch (e) {
			const durationMs = Math.round(performance.now() - startedAt);
			setResult({
				status: "error",
				durationMs,
				error: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const isPending = result.status === "running";

	const resultText = (() => {
		if (result.status === "idle") {
			return "";
		}
		if (result.status === "running") {
			return "Running…";
		}
		if (result.status === "error") {
			return result.error ?? "Unknown error";
		}
		try {
			return JSON.stringify(result.value, null, 2);
		} catch {
			return String(result.value);
		}
	})();

	return {
		options,
		selectedKey,
		selectedMeta,
		input,
		inputHint,
		isPending,
		result,
		resultText,
		handleSelectChange,
		handleInputChange,
		handleRun,
		handleClear,
	};
}
