import { vi } from "vitest";

export type SelectResult = Record<string, unknown>[];

function makeSelectResultNode(value: SelectResult): Promise<SelectResult> & {
	orderBy: ReturnType<typeof vi.fn>;
	limit: ReturnType<typeof vi.fn>;
	where: ReturnType<typeof vi.fn>;
} {
	const resolved = Promise.resolve(value);
	const chainMethods = {
		orderBy: vi.fn().mockImplementation(() => makeSelectResultNode(value)),
		limit: vi.fn().mockImplementation(() => makeSelectResultNode(value)),
		where: vi.fn().mockImplementation(() => makeSelectResultNode(value)),
	};
	return new Proxy(resolved, {
		get(target, prop, receiver) {
			if (prop in chainMethods) {
				return chainMethods[prop as keyof typeof chainMethods];
			}
			const val = Reflect.get(target, prop, receiver);
			return typeof val === "function" ? val.bind(target) : val;
		},
	}) as Promise<SelectResult> & typeof chainMethods;
}

export function makeChainableDb(selectSequence: SelectResult[]) {
	let selectCallIndex = 0;

	const updateChain = {
		set: vi.fn(),
		where: vi.fn().mockResolvedValue(undefined),
	};
	updateChain.set.mockReturnValue(updateChain);

	const deleteChain = {
		where: vi.fn().mockResolvedValue(undefined),
	};

	const insertChain = {
		values: vi.fn().mockResolvedValue(undefined),
	};

	const db = {
		select: vi.fn().mockImplementation(() => {
			const result = selectSequence[selectCallIndex] ?? [];
			selectCallIndex++;
			return {
				from: vi.fn().mockReturnValue(makeSelectResultNode(result)),
			};
		}),
		update: vi.fn().mockReturnValue(updateChain),
		delete: vi.fn().mockReturnValue(deleteChain),
		insert: vi.fn().mockReturnValue(insertChain),
		_updateChain: updateChain,
		_deleteChain: deleteChain,
		_insertChain: insertChain,
	};

	return db;
}

export function makeGameSession(overrides: Record<string, unknown> = {}) {
	return {
		id: "session-1",
		userId: "user-1",
		kind: "cash_game",
		status: "active",
		source: "live",
		sessionDate: new Date("2024-01-01T10:00:00Z"),
		startedAt: new Date("2024-01-01T10:00:00Z"),
		endedAt: null,
		breakMinutes: null,
		memo: null,
		storeId: null,
		currencyId: "currency-1",
		createdAt: new Date("2024-01-01T10:00:00Z"),
		updatedAt: new Date("2024-01-01T10:00:00Z"),
		...overrides,
	};
}

export function makeEvent(
	eventType: string,
	payload: Record<string, unknown>,
	occurredAt: Date = new Date("2024-01-01T10:00:00Z"),
	sortOrder = 0
) {
	return {
		id: crypto.randomUUID(),
		sessionId: "session-1",
		eventType,
		occurredAt,
		sortOrder,
		payload: JSON.stringify(payload),
		createdAt: new Date("2024-01-01T10:00:00Z"),
		updatedAt: new Date("2024-01-01T10:00:00Z"),
	};
}
