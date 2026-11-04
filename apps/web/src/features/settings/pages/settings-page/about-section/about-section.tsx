import {
	IconChevronRight,
	IconInfoCircle,
	IconNews,
} from "@tabler/icons-react";
import { SettingsSection } from "@/features/settings/pages/settings-page/settings-section";
import { Badge } from "@/shared/components/ui/badge";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/shared/components/ui/item";
import { useAboutSection } from "./use-about-section";

export function AboutSection() {
	const { hasUnviewedNotes, version, onViewUpdateNotes } = useAboutSection();

	return (
		<SettingsSection heading="About">
			<ItemGroup size="xl" variant="inset">
				<Item>
					<ItemMedia>
						<IconInfoCircle aria-hidden />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>Version</ItemTitle>
					</ItemContent>
					<ItemActions>
						<span className="font-mono">{version ?? "Unknown"}</span>
					</ItemActions>
				</Item>
				<Item asChild>
					<button onClick={onViewUpdateNotes} type="button">
						<ItemMedia>
							<IconNews aria-hidden />
						</ItemMedia>
						<ItemContent>
							<ItemTitle>Update notes</ItemTitle>
						</ItemContent>
						<ItemActions className="gap-1.5">
							{hasUnviewedNotes ? <Badge>New</Badge> : null}
							<IconChevronRight aria-hidden />
						</ItemActions>
					</button>
				</Item>
			</ItemGroup>
		</SettingsSection>
	);
}
