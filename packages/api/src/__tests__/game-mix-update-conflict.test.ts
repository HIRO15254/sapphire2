import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	createChainableMockDb,
	withGameMixVariantFixtures,
} from "./test-utils";

type Rows = Record<string, unknown>[];

const MIX_TABLE = "game_mix";

function gameMixCaller(userId: string, select: Record<string, Rows>) {
	const mock = createChainableMockDb({
		select: withGameMixVariantFixtures(select),
	});
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db: mock.db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).gameMix;
	return { caller, ...mock };
}

async function expectTrpcCode(
	promise: Promise<unknown>,
	code: TRPCError["code"]
): Promise<void> {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(TRPCError);
		expect((error as TRPCError).code).toBe(code);
		return;
	}
	throw new Error(`expected the call to throw ${code} but it resolved`);
}

const CUR_OWNER = "user-1";

describe("gameMix.update collision guard (CONFLICT via UNIQUE constraint on db.batch)", () => {
	it("converts a UNIQUE constraint violation surfaced from db.batch into CONFLICT", async () => {
		const { caller, db } = gameMixCaller(CUR_OWNER, {
			[MIX_TABLE]: [{ id: "mix-1", userId: CUR_OWNER, label: "My Mix" }],
		});
		db.batch = () => {
			throw new Error(
				"UNIQUE constraint failed: game_mix.user_id, game_mix.label"
			);
		};

		await expectTrpcCode(
			caller.update({ id: "mix-1", label: "X" }),
			"CONFLICT"
		);
	});
});
