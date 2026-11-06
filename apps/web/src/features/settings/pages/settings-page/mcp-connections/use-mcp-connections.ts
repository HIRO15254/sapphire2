import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useUndoableMutation } from "@/shared/hooks/use-undoable-mutation";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc } from "@/utils/trpc";

export function useMcpConnections() {
	const queryClient = useQueryClient();
	const listQuery = useQuery(trpc.mcpConnection.list.queryOptions());
	const [revokeTarget, setRevokeTarget] = useState<
		NonNullable<typeof listQuery.data>[number] | null
	>(null);

	const revokeMutation = useUndoableMutation(
		trpc.mcpConnection.revoke.mutationOptions({
			onSettled: () =>
				invalidateTargets(queryClient, [
					{ queryKey: trpc.mcpConnection.list.queryKey() },
				]),
		}),
		{ destructive: true, message: "Client disconnected" }
	);

	const onRevoke = async () => {
		if (!revokeTarget || revokeMutation.isPending) {
			return;
		}
		try {
			await revokeMutation.mutateAsync({ clientId: revokeTarget.clientId });
			setRevokeTarget(null);
			// biome-ignore lint/suspicious/noEmptyBlockStatements: The mutation handles its own error feedback.
		} catch {}
	};

	return {
		connections: listQuery.data ?? [],
		isError: listQuery.isError,
		isLoading: listQuery.isPending,
		isRefetching: listQuery.isFetching,
		isRevokePending: revokeMutation.isPending,
		onCloseDialog: () => setRevokeTarget(null),
		onDialogOpenChange: (open: boolean) => {
			if (!open) {
				setRevokeTarget(null);
			}
		},
		onRetry: () => {
			listQuery.refetch();
		},
		onRevoke,
		onRevokeTargetChange: setRevokeTarget,
		onSelectConnection:
			(connection: NonNullable<typeof listQuery.data>[number]) => () =>
				setRevokeTarget(connection),
		revokeTarget,
	};
}
