# Data Model: プレイヤーメモ機能

## Entities

### Player

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | text | PK | UUID (`crypto.randomUUID()`) |
| userId | text | NOT NULL, FK → user.id (cascade) | Owning user |
| name | text | NOT NULL | Player name |
| memo | text | nullable | HTML content from the rich text editor |
| createdAt | integer (timestamp) | NOT NULL, default `unixepoch()` | |
| updatedAt | integer (timestamp) | NOT NULL, `$onUpdate` | |

**Indexes**: `player_userId_idx` on `userId`

**Relations**:
- belongs to `User`
- has many `PlayerToPlayerTag`

### PlayerTag

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | text | PK | UUID |
| userId | text | NOT NULL, FK → user.id (cascade) | Owning user |
| name | text | NOT NULL | Tag label |
| color | text | NOT NULL, default `"gray"` | Preset palette color name |
| createdAt | integer (timestamp) | NOT NULL, default `unixepoch()` | |
| updatedAt | integer (timestamp) | NOT NULL, `$onUpdate` | |

**Indexes**: `playerTag_userId_idx` on `userId`

**Relations**:
- belongs to `User`
- has many `PlayerToPlayerTag`

### PlayerToPlayerTag (Junction)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| playerId | text | NOT NULL, FK → player.id (cascade) | |
| playerTagId | text | NOT NULL, FK → playerTag.id (cascade) | |
| position | integer | NOT NULL, default `0` | Ordering used when returning tags |

**Primary Key**: Composite `(playerId, playerTagId)`

**Relations**:
- belongs to `Player`
- belongs to `PlayerTag`

## Entity Relationship Diagram

```
User (auth)
├── 1:N ← Player
│         ├── memo (HTML text field)
│         └── N:M ← PlayerToPlayerTag → N:1 PlayerTag
└── 1:N ← PlayerTag
```

## Preset Color Palette

Colors are stored as string identifiers and mapped to Tailwind classes in the frontend.

| Color Name | Usage |
|------------|-------|
| gray | default fallback |
| red | preset tag color |
| orange | preset tag color |
| yellow | preset tag color |
| green | preset tag color |
| blue | preset tag color |
| purple | preset tag color |
| pink | preset tag color |

## Validation Rules

- `Player.name`: min 1 character, max 100 characters
- `PlayerTag.name`: min 1 character, max 50 characters
- `PlayerTag.color`: must be one of the preset color names
- `Player.memo`: max 50,000 characters of HTML
- All CRUD operations are scoped to the authenticated user
