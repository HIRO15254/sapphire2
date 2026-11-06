import { asset } from "./schema/asset";
import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from "./schema/auth";
import {
	entry,
	entryCash,
	entryTournament,
	playEvent,
	playSession,
} from "./schema/entry";
import { entryTag, entryTagLink } from "./schema/entry-tag";
import { filterPreset } from "./schema/filter-preset";
import { gameGroup } from "./schema/game-group";
import {
	gameLineup,
	gameLineupGroup,
	gameLineupVariant,
} from "./schema/game-lineup";
import { gameMix, gameMixVariant } from "./schema/game-mix";
import { gameVariant } from "./schema/game-variant";
import { hand, handAction, handBoard, handSeat } from "./schema/hand";
import { handTag, handTagLink } from "./schema/hand-tag";
import {
	assetRate,
	ledgerCategory,
	ledgerLine,
	userSetting,
} from "./schema/ledger";
import {
	oauthAccessToken,
	oauthAccessTokenRelations,
	oauthClient,
	oauthClientAssertion,
	oauthClientRelations,
	oauthClientResource,
	oauthClientResourceRelations,
	oauthConsent,
	oauthConsentRelations,
	oauthRefreshToken,
	oauthRefreshTokenRelations,
	oauthResource,
	oauthResourceRelations,
} from "./schema/oauth";
import { passkey, passkeyRelations } from "./schema/passkey";
import { player, playerTag, playerTagLink } from "./schema/player";
import { ringGame } from "./schema/ring-game";
import { room } from "./schema/room";
import {
	cashRule,
	cashRuleStake,
	tournamentRule,
	tournamentRuleLevel,
	tournamentRuleLevelStake,
	tournamentRulePrice,
} from "./schema/rule";
import { tournament } from "./schema/tournament";
import { tournamentTag, tournamentTagLink } from "./schema/tournament-tag";
import { updateNoteView } from "./schema/update-note-view";
import { writeGuard } from "./schema/write-guard";

export const schema = {
	account,
	accountRelations,
	asset,
	assetRate,
	cashRule,
	cashRuleStake,
	entry,
	entryCash,
	entryTag,
	entryTagLink,
	entryTournament,
	filterPreset,
	gameGroup,
	gameLineup,
	gameLineupGroup,
	gameLineupVariant,
	gameMix,
	gameMixVariant,
	gameVariant,
	hand,
	handAction,
	handBoard,
	handSeat,
	handTag,
	handTagLink,
	ledgerCategory,
	ledgerLine,
	oauthAccessToken,
	oauthAccessTokenRelations,
	oauthClient,
	oauthClientAssertion,
	oauthClientRelations,
	oauthClientResource,
	oauthClientResourceRelations,
	oauthConsent,
	oauthConsentRelations,
	oauthRefreshToken,
	oauthRefreshTokenRelations,
	oauthResource,
	oauthResourceRelations,
	passkey,
	passkeyRelations,
	playEvent,
	player,
	playerTag,
	playerTagLink,
	playSession,
	ringGame,
	room,
	session,
	sessionRelations,
	tournament,
	tournamentRule,
	tournamentRuleLevel,
	tournamentRuleLevelStake,
	tournamentRulePrice,
	tournamentTag,
	tournamentTagLink,
	updateNoteView,
	user,
	userRelations,
	userSetting,
	verification,
	writeGuard,
};
