import type { Query } from "@tanstack/react-query";

let activeWipes = 0;

export function shouldPersistQuery(query: Query): boolean {
	return activeWipes === 0 && query.state.status === "success";
}

export async function withPersistenceSuspended(
	wipe: () => Promise<void>
): Promise<void> {
	activeWipes += 1;
	try {
		await wipe();
	} finally {
		activeWipes -= 1;
	}
}
