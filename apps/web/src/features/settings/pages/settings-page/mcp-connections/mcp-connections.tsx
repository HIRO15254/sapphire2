import { IconPlugConnected, IconUnlink } from "@tabler/icons-react";
import { SectionLoadError } from "@/features/settings/pages/settings-page/section-load-error";
import { SettingsSection } from "@/features/settings/pages/settings-page/settings-section";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { IconButton } from "@/shared/components/ui/icon-button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/shared/components/ui/item";
import { Spinner } from "@/shared/components/ui/spinner";
import { formatLocalYmdSlash } from "@/utils/format-number";
import { useMcpConnections } from "./use-mcp-connections";

const HEADING = "MCP clients";
const UNNAMED_CLIENT = "Unnamed client";

function connectionDescription(
	approvedAt: string | null,
	lastActiveAt: string | null
) {
	const parts = [
		approvedAt ? `Approved ${formatLocalYmdSlash(approvedAt)}` : null,
		lastActiveAt ? `Last active ${formatLocalYmdSlash(lastActiveAt)}` : null,
	].filter((part) => part !== null);
	return parts.join(" · ");
}

export function McpConnections() {
	const {
		connections,
		isError,
		isLoading,
		isRefetching,
		isRevokePending,
		onRetry,
		onRevoke,
		onRevokeTargetChange,
		revokeTarget,
	} = useMcpConnections();

	function renderList() {
		if (isLoading) {
			return (
				<div className="text-muted-foreground flex justify-center py-3">
					<Spinner />
				</div>
			);
		}

		if (isError) {
			return (
				<SectionLoadError
					isRetrying={isRefetching}
					message="Couldn't load your MCP clients."
					onRetry={onRetry}
				/>
			);
		}

		if (connections.length === 0) {
			return (
				<ItemGroup aria-label={HEADING} size="xl" variant="inset">
					<Item>
						<ItemContent>
							<ItemDescription>No clients connected</ItemDescription>
						</ItemContent>
					</Item>
				</ItemGroup>
			);
		}

		return (
			<ItemGroup aria-label={HEADING} size="xl" variant="inset">
				{connections.map((connection) => {
					const name = connection.name || UNNAMED_CLIENT;
					return (
						<Item key={connection.clientId}>
							<ItemMedia>
								<IconPlugConnected aria-hidden />
							</ItemMedia>
							<ItemContent>
								<ItemTitle>{name}</ItemTitle>
								<ItemDescription>
									{connectionDescription(
										connection.approvedAt,
										connection.lastActiveAt
									)}
								</ItemDescription>
							</ItemContent>
							<ItemActions>
								<IconButton
									label={`Disconnect ${name}`}
									onClick={() => onRevokeTargetChange(connection)}
									type="button"
								>
									<IconUnlink aria-hidden />
								</IconButton>
							</ItemActions>
						</Item>
					);
				})}
			</ItemGroup>
		);
	}

	return (
		<SettingsSection
			heading={HEADING}
			note="Apps connected to your account through MCP can read and change your data. Disconnect one you no longer use or don't recognize."
		>
			{renderList()}

			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						onRevokeTargetChange(null);
					}
				}}
				open={revokeTarget !== null}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Disconnect client?</DialogTitle>
						<DialogDescription>
							{revokeTarget?.name || UNNAMED_CLIENT} will lose access to your
							account right away. To use it again, connect it and approve it
							again.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							onClick={() => onRevokeTargetChange(null)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							aria-busy={isRevokePending}
							disabled={isRevokePending}
							onClick={onRevoke}
							type="button"
							variant="destructive"
						>
							<IconUnlink aria-hidden />
							Disconnect
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</SettingsSection>
	);
}
