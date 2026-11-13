import { IconLogout } from "@tabler/icons-react";
import { AboutSection } from "@/features/settings/pages/settings-page/about-section";
import { LinkedAccounts } from "@/features/settings/pages/settings-page/linked-accounts";
import { McpConnections } from "@/features/settings/pages/settings-page/mcp-connections";
import { Passkeys } from "@/features/settings/pages/settings-page/passkeys";
import { ThemeSetting } from "@/features/settings/pages/settings-page/theme-setting";
import { WalletSettings } from "@/features/settings/pages/settings-page/wallet-settings";
import { PageHeader } from "@/shared/components/page-header";
import {
	Item,
	ItemContent,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/shared/components/ui/item";
import { useSettingsPage } from "./use-settings-page";

export function SettingsPage() {
	const { onSignOut } = useSettingsPage();

	return (
		<div className="bg-background text-foreground min-h-full">
			<PageHeader back={{ fallbackTo: "/more" }} heading="Settings" />

			<main className="flex flex-col gap-[22px] px-3.5 pt-4 pb-6 text-[length:var(--m-text-secondary)]">
				<WalletSettings />
				<ThemeSetting />
				<LinkedAccounts />
				<Passkeys />
				<McpConnections />
				<AboutSection />
				<ItemGroup size="xl" variant="inset">
					<Item asChild variant="destructive">
						<button onClick={onSignOut} type="button">
							<ItemMedia>
								<IconLogout aria-hidden />
							</ItemMedia>
							<ItemContent>
								<ItemTitle>Sign out</ItemTitle>
							</ItemContent>
						</button>
					</Item>
				</ItemGroup>
			</main>
		</div>
	);
}
