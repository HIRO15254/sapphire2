export const TABLE_PLAYER_SOURCE_APP_IDS = ["dmm_waitinglist"] as const;

export type TablePlayerSourceApp = (typeof TABLE_PLAYER_SOURCE_APP_IDS)[number];

interface TablePlayerSourceAppConfig {
	label: string;
	prompt: string;
}

export const TABLE_PLAYER_SOURCE_APPS: Record<
	TablePlayerSourceApp,
	TablePlayerSourceAppConfig
> = {
	dmm_waitinglist: {
		label: "DMM Waitinglist",
		prompt: `画像は DMM Waitinglist アプリのテーブルビューです。
各席のプレイヤー名を抽出してください。
席番号の採番規則:
- 画面下中央の切り欠き(ノッチ)のある席を 1 番とします。
- そこから時計回り(右回り)に 2, 3, 4, ... と採番します。
- テーブル最大 9 席まで (seatNumber は 1-9 の整数)。
抽出条件:
- 名前が読み取れた席のみ seats 配列に含めてください。
- 空席や名前が不鮮明な席は省略してください。
- 名前の前後の記号・装飾・残スタック表示などは除去し、プレイヤー名のみを返してください。`,
	},
};
