import { useState } from "react";
import {
	PROCEDURE_KEYS,
	PROCEDURES,
	type ProcedureField,
	type ProcedureMeta,
	procedureKey,
} from "@/features/api-tester/procedures";
import { trpcClient } from "@/utils/trpc";

type RunStatus = "idle" | "running" | "success" | "error";

interface RunResult {
	durationMs?: number;
	error?: string;
	status: RunStatus;
	value?: unknown;
}

interface InputBuildResult {
	error?: string;
	ok: boolean;
	value?: unknown;
}

const DEFAULT_KEY = PROCEDURE_KEYS[0];

function findProcedure(key: string): ProcedureMeta | undefined {
	return PROCEDURES.find((p) => procedureKey(p) === key);
}

function buildLabel(meta: ProcedureMeta): string {
	return `${procedureKey(meta)} [${meta.kind}]`;
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

function buildInitialValues(
	meta: ProcedureMeta | undefined
): Record<string, string> {
	if (!meta) {
		return {};
	}
	const out: Record<string, string> = {};
	for (const f of meta.fields) {
		out[f.name] = f.defaultValue ?? "";
	}
	return out;
}

function coerceFieldValue(
	field: ProcedureField,
	raw: string
): { ok: true; value: unknown } | { ok: false; error: string } {
	const trimmed = raw.trim();
	if (trimmed === "") {
		if (field.nullable) {
			return { ok: true, value: null };
		}
		if (field.required) {
			return { ok: false, error: `Field "${field.name}" is required` };
		}
		return { ok: true, value: undefined };
	}
	switch (field.kind) {
		case "string":
			return { ok: true, value: raw };
		case "number": {
			const n = Number(trimmed);
			if (Number.isNaN(n)) {
				return {
					ok: false,
					error: `Field "${field.name}" is not a valid number`,
				};
			}
			return { ok: true, value: n };
		}
		case "boolean": {
			const v = trimmed.toLowerCase();
			if (v === "true" || v === "1") {
				return { ok: true, value: true };
			}
			if (v === "false" || v === "0") {
				return { ok: true, value: false };
			}
			return {
				ok: false,
				error: `Field "${field.name}" must be true/false`,
			};
		}
		case "json":
			try {
				return { ok: true, value: JSON.parse(trimmed) };
			} catch (e) {
				return {
					ok: false,
					error: `Field "${field.name}" is not valid JSON: ${(e as Error).message}`,
				};
			}
		case "stringArray": {
			const items = trimmed
				.split("\n")
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			return { ok: true, value: items };
		}
		default:
			return {
				ok: false,
				error: `Unknown field kind: ${field.kind}`,
			};
	}
}

function buildInput(
	meta: ProcedureMeta | undefined,
	values: Record<string, string>
): InputBuildResult {
	if (!meta || meta.fields.length === 0) {
		return { ok: true, value: undefined };
	}
	const bodyField = meta.fields.find((f) => f.name === "_body");
	if (bodyField) {
		const coerced = coerceFieldValue(bodyField, values._body ?? "");
		if (!coerced.ok) {
			return { ok: false, error: coerced.error };
		}
		return { ok: true, value: coerced.value };
	}
	const out: Record<string, unknown> = {};
	for (const f of meta.fields) {
		const coerced = coerceFieldValue(f, values[f.name] ?? "");
		if (!coerced.ok) {
			return { ok: false, error: coerced.error };
		}
		if (coerced.value !== undefined) {
			out[f.name] = coerced.value;
		}
	}
	return { ok: true, value: out };
}

export function useApiTester() {
	const initialMeta = findProcedure(DEFAULT_KEY);
	const [selectedKey, setSelectedKey] = useState<string>(DEFAULT_KEY);
	const [values, setValues] = useState<Record<string, string>>(
		buildInitialValues(initialMeta)
	);
	const [result, setResult] = useState<RunResult>({ status: "idle" });

	const selectedMeta = findProcedure(selectedKey);

	const options = PROCEDURES.map((meta) => ({
		key: procedureKey(meta),
		label: buildLabel(meta),
	}));

	const handleSelectChange = (next: string) => {
		setSelectedKey(next);
		const meta = findProcedure(next);
		setValues(buildInitialValues(meta));
		setResult({ status: "idle" });
	};

	const handleFieldChange = (name: string, next: string) => {
		setValues((prev) => ({ ...prev, [name]: next }));
	};

	const handleResetFields = () => {
		setValues(buildInitialValues(selectedMeta));
	};

	const handleClear = () => {
		setResult({ status: "idle" });
	};

	const handleRun = async () => {
		if (!selectedMeta) {
			setResult({ status: "error", error: "No procedure selected" });
			return;
		}
		const built = buildInput(selectedMeta, values);
		if (!built.ok) {
			setResult({ status: "error", error: built.error });
			return;
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
			const value = await fn(built.value);
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

	const previewInput = (() => {
		const built = buildInput(selectedMeta, values);
		if (!built.ok) {
			return `// ${built.error}`;
		}
		try {
			return JSON.stringify(built.value, null, 2);
		} catch {
			return String(built.value);
		}
	})();

	return {
		options,
		selectedKey,
		selectedMeta,
		values,
		isPending,
		result,
		resultText,
		previewInput,
		handleSelectChange,
		handleFieldChange,
		handleResetFields,
		handleRun,
		handleClear,
	};
}
