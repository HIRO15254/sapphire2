const ACCEPTED_BRANCH_NAME = /^[A-Za-z0-9_@][A-Za-z0-9/_.#+,@()-]*$/;

export function isAcceptedBranchName(name: string): boolean {
	return ACCEPTED_BRANCH_NAME.test(name);
}

if (import.meta.main) {
	const rejected = process.argv
		.slice(2)
		.filter((name) => !isAcceptedBranchName(name));
	for (const name of rejected) {
		console.error(
			`check-branch-name: "${name}" is not ASCII-only; claude-code-action rejects it. Use feature/sa2-<id>.`
		);
	}
	if (rejected.length > 0) {
		process.exit(1);
	}
}
