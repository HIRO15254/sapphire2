import { appRouter } from "../routers";
import {
	type ChainableMockDbConfig,
	createChainableMockDb,
	DEFAULT_CALLER_USER_ID,
} from "./test-utils";

interface CallerConfig extends ChainableMockDbConfig {
	userId?: string;
}

export function createCaller(config: CallerConfig = {}) {
	const mock = createChainableMockDb({
		evaluateWhere: config.evaluateWhere,
		select: config.select,
	});
	return {
		...mock,
		caller: appRouter.createCaller({
			session: { user: { id: config.userId ?? DEFAULT_CALLER_USER_ID } },
			db: mock.db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]),
	};
}
