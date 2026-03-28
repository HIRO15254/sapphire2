# Data Model: プレイヤーメモ機能

## Entities

### Player

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | text | PK | UUID (crypto.randomUUID()) |
| userId | text | NOT NULL, FK → user.id (cascade) | Data isolation per user |
| name | text | NOT NULL | Player name (duplicates allowed) |
| memo | text | nullable | HTML content from rich text editor |
| createdAt | integer (timestamp) | NOT NULL, default unixepoch() | |
| updatedAt | integer (timestamp) | NOT NULL, $onUpdate | |

**Indexes**: `player_userId_idx` on userId

**Relations**:
- belongs to User (many-to-one)
- has many PlayerToPlayerTag (one-to-many, junction)

### PlayerTag

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | text | PK | UUID |
| userId | text | NOT NULL, FK → user.id (cascade) | Data isolation per user |
| name | text | NOT NULL | Tag label |
| color | text | NOT NULL, default "gray" | Preset color name (e.g., "red", "blue") |
| createdAt | integer (timestamp) | NOT NULL, default unixepoch() | |
| updatedAt | integer (timestamp) | NOT NULL, $onUpdate | |

**Indexes**: `playerTag_userId_idx` on userId

**Relations**:
- belongs to User (many-to-one)
- has many PlayerToPlayerTag (one-to-many, junction)

### PlayerToPlayerTag (Junction)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| playerId | text | NOT NULL, FK → player.id (cascade) | |
| playerTagId | text | NOT NULL, FK → playerTag.id (cascade) | |

**Primary Key**: Composite (playerId, playerTagId)

**Relations**:
- belongs to Player (many-to-one)
- belongs to PlayerTag (many-to-one)

## Entity Relationship Diagram

```
User (auth)
├── 1:N ← Player
│         ├── memo (HTML text field)
│         └── N:M ← PlayerToPlayerTag → N:1 PlayerTag
└── 1:N ← PlayerTag
```

## Preset Color Palette

Colors stored as string identifiers, mapped to Tailwind CSS classes on the frontend:

| Color Name | Background (badge) | Text |
|------------|-------------------|------|
| gray | bg-gray-100 dark:bg-gray-800 | text-gray-700 dark:text-gray-300 |
| red | bg-red-100 dark:bg-red-900 | text-red-700 dark:text-red-300 |
| orange | bg-orange-100 dark:bg-orange-900 | text-orange-700 dark:text-orange-300 |
| yellow | bg-yellow-100 dark:bg-yellow-900 | text-yellow-700 dark:text-yellow-300 |
| green | bg-green-100 dark:bg-green-900 | text-green-700 dark:text-green-300 |
| blue | bg-blue-100 dark:bg-blue-900 | text-blue-700 dark:text-blue-300 |
| purple | bg-purple-100 dark:bg-purple-900 | text-purple-700 dark:text-purple-300 |
| pink | bg-pink-100 dark:bg-pink-900 | text-pink-700 dark:text-pink-300 |

## Validation Rules

- **Player.name**: min 1 character (trimmed), max 100 characters
- **PlayerTag.name**: min 1 character (trimmed), max 50 characters
- **PlayerTag.color**: must be one of the preset color names
- **Player.memo**: max 50,000 characters (HTML content)
- **Ownership**: All CRUD operations validate userId matches authenticated user
