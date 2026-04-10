# Feature Specification: セッション一覧のBB/BI単位表示

**Feature Branch**: `008-session-bb-bi-display`
**Created**: 2026-04-10
**Status**: Draft
**Input**: GitHub Issue #68 — セッション一覧にBB/BI単位で結果を表示できるように

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cash GameセッションのP&LをBB単位で表示する (Priority: P1)

ユーザーはセッション一覧画面でBB/BI表示トグルをオンにすると、Cash Gameセッションの結果（P&L）がBB単位で表示される。BB単位の値は、セッションのP&L（cashOut - buyIn）をセッションに紐付くリングゲームのblind2（BB）で割った値である。NLHセッションにのみ適用される。BBが設定されていない（ringGameが未リンク、またはblind2が未設定の）セッションでは、BB単位での表示は行わず、通常のチップ値をそのまま表示する。

**Why this priority**: P&LをBB単位で把握することはポーカープレイヤーにとって最も基本的なパフォーマンス指標であり、異なるステークスのセッション間での比較を可能にする。Cash Gameは最も頻繁にプレイされるフォーマットであるため最優先。

**Independent Test**: BB/BI トグルをオンにし、blind2が設定されたCash Gameセッションが一覧に表示されていることを確認し、P&L値がBB単位（例: +5.2 BB）で表示されることを検証する。

**Acceptance Scenarios**:

1. **Given** セッション一覧画面にCash Gameセッション（buyIn=10000, cashOut=15000, blind2=200）が表示されている, **When** BB/BIトグルをオンにする, **Then** P&Lが「+25.0 BB」と表示される（(15000-10000)/200 = 25.0）
2. **Given** BB/BIモードがオンで、ringGameが未リンク（ringGameId = null）のCash Gameセッションがある, **When** セッション一覧を表示する, **Then** そのセッションはBBではなく通常のチップ値でP&Lを表示する
3. **Given** BB/BIモードがオンで、blind2が未設定（null）のCash Gameセッションがある, **When** セッション一覧を表示する, **Then** そのセッションはBBではなく通常のチップ値でP&Lを表示する
4. **Given** BB/BIモードがオンのとき, **When** Cash Gameセッションカードのヘッダー部P&Lを確認する, **Then** 「+25.0 BB」のようにBB単位で表示される（通貨単位は非表示）

---

### User Story 2 - Cash GameセッションのEV P&LもBB単位で表示する (Priority: P1)

BB/BIモードがオンの場合、Cash GameセッションのEV P&L（evCashOut - buyIn）もBB単位で変換して表示する。計算方法はP&Lと同様（evProfitLoss / blind2）。

**Why this priority**: EV P&Lはスキル評価において不可欠であり、BB単位でのEV P&L表示はP&Lと同じ優先度で提供すべき。

**Independent Test**: EV cashOutが記録されたCash Gameセッションに対して、BB/BIモードオン時にEV P&LもBB単位で正しく表示されることを確認する。

**Acceptance Scenarios**:

1. **Given** BB/BIモードがオンで、evCashOut=16000, buyIn=10000, blind2=200のセッションがある, **When** セッションカードの詳細を展開する, **Then** EV P&Lが「+30.0 BB」と表示される（(16000-10000)/200 = 30.0）
2. **Given** BB/BIモードがオンで、EV P&Lが設定されたセッションのヘッダー右部, **When** EV P&Lを確認する, **Then** EV P&LもBB単位で表示される
3. **Given** BB/BIモードがオンで、evCashOutが未設定のCash Gameセッション, **When** セッションカードを表示する, **Then** EV関連の表示は通常通り非表示のまま

---

### User Story 3 - TourneyセッションのP&LをBI単位で表示する (Priority: P1)

BB/BIモードがオンの場合、TournamentセッションのP&Lを総バイイン（total cost = tournamentBuyIn + entryFee + rebuyCount × rebuyCost + addonCost）で割って表示する。これにより異なるバイイン額のトーナメント間でROI的な比較が可能になる。総バイインが0の場合はBI単位表示を行わず、通常のチップ値で表示する。

**Why this priority**: BB/BIモードの対象にTourneyを含めることでトグル1つですべてのセッションタイプをカバーできる。

**Independent Test**: tournamentBuyIn=5000, entryFee=500, rebuyCount=1, rebuyCost=5000, addonCost=0, prizeMoney=20000のTourneyセッションに対して、BB/BIモードオン時にP&Lが「+1.73 BI」と表示される（profit=20000-10500=9500, 9500/5500=1.73）。

**Acceptance Scenarios**:

1. **Given** BB/BIモードがオンで、tournamentBuyIn=5000, entryFee=500, rebuyCount=0, rebuyCost=null, addonCost=null, prizeMoney=12000のTourneyセッションがある, **When** セッション一覧を表示する, **Then** P&Lが「+1.18 BI」と表示される（(12000-(5000+500))/5500 = 1.18）
2. **Given** BB/BIモードがオンで、tournamentBuyIn=0, entryFee=0（フリーロール等）のTourneyセッションがある, **When** セッション一覧を表示する, **Then** BI単位表示は行わず通常のチップ値でP&Lを表示する
3. **Given** BB/BIモードがオンで、Tourneyセッションのヘッダー右部, **When** P&Lを確認する, **Then** 「+1.18 BI」形式でBI単位で表示される（通貨単位は非表示）
4. **Given** BB/BIモードがオンのとき, **When** TourneyセッションのPlacement表示を確認する, **Then** Placementは変換されず通常通り表示される

---

### User Story 4 - BB/BIモードのトグル操作 (Priority: P1)

ユーザーはセッション一覧画面でBB/BI表示のオン/オフを切り替えるトグルを操作できる。トグルはセッションリスト上部のフィルター/アクション領域に配置される。トグル状態はページ遷移しても保持されない一時的なUI状態でよい（永続化不要）。

**Why this priority**: トグルUIがなければBB/BI表示機能自体が使えないため、他のストーリーと同優先度。

**Independent Test**: セッション一覧ページを開き、BB/BIトグルが表示されること、クリックでオン/オフが切り替わること、オフ時は通常表示に戻ることを確認する。

**Acceptance Scenarios**:

1. **Given** セッション一覧ページが表示されている, **When** ページを開く, **Then** BB/BIトグルがデフォルトオフで表示されている
2. **Given** BB/BIトグルがオフ, **When** トグルをクリックする, **Then** BB/BIモードがオンになり、対象セッションのP&LがBB/BI単位に切り替わる
3. **Given** BB/BIモードがオン, **When** トグルをクリックする, **Then** BB/BIモードがオフになり、全セッションのP&Lが通常のチップ値表示に戻る

---

### User Story 5 - セッションカード詳細部のBB/BI単位表示 (Priority: P2)

BB/BIモードがオンの場合、セッションカードの展開時詳細部（Buy-in, Cash-out, EV Cash-out行）もBB/BI単位で表示する。Cash Gameの場合はBuy-in, Cash-out, EV Cash-outをblind2で割った値を表示する。Tourneyの場合は変更なし（Buy-in, Entry Fee, Prize等の個別項目はそのまま表示）。

**Why this priority**: ヘッダーのP&L（US1-3）より優先度は低いが、詳細部の一貫性を保つために対応すべき。

**Independent Test**: BB/BIモードオンでCash Gameセッションカードを展開し、Buy-in、Cash-out、EV Cash-outがBB単位で表示されていることを確認する。

**Acceptance Scenarios**:

1. **Given** BB/BIモードがオンで、buyIn=10000, cashOut=15000, blind2=200のCash Gameセッション, **When** セッションカードを展開する, **Then** Buy-inが「50.0 BB」、Cash-outが「75.0 BB」と表示される
2. **Given** BB/BIモードがオンで、evCashOut=16000, blind2=200のCash Gameセッション, **When** セッションカードを展開する, **Then** EV Cash-outが「80.0 BB」と表示される
3. **Given** BB/BIモードがオンのTourneyセッション, **When** セッションカードを展開する, **Then** Buy-in, Entry Fee, Prize等の個別項目は通常のチップ値のまま表示される（変換しない）

---

### Edge Cases

- blind2が0のリングゲームに紐付くCash Gameセッション → ゼロ除算を避けるため、BB単位表示は行わず通常のチップ値で表示する
- Tourneyの総バイインが0（フリーロール）→ BI単位表示は行わず通常のチップ値で表示する
- BB/BIモードオン時に、一部のセッションのみBB/BI変換可能な場合 → 変換可能なセッションのみBB/BI単位表示し、それ以外は通常表示する（混在表示を許容）
- BB/BI単位の値は小数第1位まで表示する（例: +25.3 BB, -1.7 BI）
- P&Lが0の場合はBB/BI単位でも「0.0 BB」「0.0 BI」と表示する
- NLH以外のバリアント（将来追加される可能性）のCash GameでもBBが設定されていれば同様にBB単位変換を適用する（バリアントによる制限は設けない）

## Requirements *(mandatory)*

### Functional Requirements

#### BB/BIトグル

- **FR-001**: セッション一覧画面にBB/BI表示モードのオン/オフを切り替えるトグルUIを提供しなければならない
- **FR-002**: BB/BIトグルのデフォルト状態はオフでなければならない
- **FR-003**: BB/BIトグルの状態はセッション一覧ページ内のローカルstate（useState）として管理し、ページ遷移時にリセットされてよい

#### Cash Game（BBモード）

- **FR-004**: BB/BIモードがオンの場合、Cash GameセッションのP&L表示をBB単位（profitLoss / blind2）に変換しなければならない
- **FR-005**: BB/BIモードがオンの場合、Cash GameセッションのEV P&L表示もBB単位（evProfitLoss / blind2）に変換しなければならない
- **FR-006**: BB単位表示にはセッションに紐付くリングゲームのblind2フィールドの値を使用しなければならない
- **FR-007**: ringGameIdが未リンク、blind2がnullまたは0の場合、そのセッションではBB単位変換を行わず通常のチップ値で表示しなければならない
- **FR-008**: BB/BIモードがオンの場合、Cash Gameセッションカードの詳細部（Buy-in, Cash-out, EV Cash-out）もBB単位（各値 / blind2）で表示しなければならない

#### Tournament（BIモード）

- **FR-009**: BB/BIモードがオンの場合、TournamentセッションのP&L表示をBI単位（profitLoss / totalCost）に変換しなければならない。totalCost = tournamentBuyIn + entryFee + (rebuyCount × rebuyCost) + addonCost
- **FR-010**: totalCostが0の場合、そのTourneyセッションではBI単位変換を行わず通常のチップ値で表示しなければならない
- **FR-011**: Tourneyセッションカードの詳細部（Buy-in, Entry Fee, Prize, Rebuy, Addon等の個別項目）はBB/BIモードに関わらず通常のチップ値で表示しなければならない（変換しない）

#### 表示フォーマット

- **FR-012**: BB/BI単位の値は小数第1位まで表示しなければならない（例: +25.3 BB, -1.7 BI）
- **FR-013**: BB単位表示の場合は値の後に「BB」、BI単位表示の場合は値の後に「BI」を付与しなければならない（通貨単位は非表示）
- **FR-014**: BB/BI単位の正負表記は通常表示と同じ規則（正は「+」、負は「-」）に従わなければならない

#### API

- **FR-015**: session.listのレスポンスにCash Gameセッションに紐付くringGameのblind2値を含めなければならない（フロントエンドでBB変換するために必要）

### Key Entities

- **SessionItem（拡張）**: 既存のSessionItemに `ringGameBlind2: number | null` フィールドを追加。APIレスポンスから取得したblind2値を保持する。
- **BB/BIモード状態**: セッション一覧ページ内のuseState。boolean型。トグルUIで切り替えられる。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: BB/BIトグルをオンにした状態で、blind2が設定されたCash Gameセッションの全てのP&L表示（ヘッダー、EV、詳細部）がBB単位で正しく計算・表示される
- **SC-002**: BB/BIトグルをオンにした状態で、totalCostが正のTourneyセッションのP&L表示がBI単位で正しく計算・表示される
- **SC-003**: blind2が未設定・0、またはtotalCostが0のセッションでは、BB/BIモードオン時もクラッシュせず通常のチップ値が表示される
- **SC-004**: BB/BIトグルのオフ→オン→オフの切り替えにより、表示が即座に切り替わる（追加APIリクエスト不要）
- **SC-005**: 既存のセッション一覧の機能（フィルタリング、ページング、作成・編集・削除）がBB/BIモードの追加により劣化しない

## Assumptions

- BB/BI変換計算はフロントエンド（クライアントサイド）で行う。APIはblind2を返すのみで、BB/BI変換済みの値は返さない
- BB/BI単位の値は表示専用であり、セッションの作成・編集フォームには影響しない
- サマリー統計（Total P&L, Avg P&L等）のBB/BI変換は本スコープ外とする。異なるBBサイズのセッションを一括でBB単位集計することは数学的に意味が薄いため
- トグル状態のlocalStorage等への永続化は本スコープ外とする（将来追加可能）
- 「BI」の計算においてtournament.buyIn（テンプレートのバイイン）ではなく、session固有のtournamentBuyIn, entryFee, rebuyCount, rebuyCost, addonCostを使用する（セッションごとに実際のコストが異なる可能性があるため）
