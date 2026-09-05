# ライブセッションのテスト整理・レビュー記録

対象は開始時点の `features/live-sessions` 全85テストファイル、Webルート直下の関連3ファイル、sessions側のlive編集連携2ファイルの計90ファイル。ケース名だけでなく、実際のassertion・mock境界を読んで判定し、変更候補のsetupと対象実装も確認した。長さやmock数から機械的に削除を決めていない。

## 変更と保護の対応

- 偽の単一セッションguard: テスト内画面とmock自体を検証する11件を削除。UI側の候補選択は実 `use-active-session` テスト、永続的な同時開始拒否は `packages/api/src/__integration__/live-session.test.ts` に置く。開始drawerの表示は既存専用テストにある。
- 完了/再開: 旧 `tournament-lifecycle` 内の2件は完了も再開も実行しておらず、空/active初期状態の重複だった。実D1側がcash開始→増資→完了台帳600→新caller→再開で台帳除去、tournament完了台帳2100→再開拒否、同時開始・並行eventを検証する。Webには種別ごとの画面構成と入力操作を残す。
- フォーム: rootのラベル/form IDのみの4件を `apps/web/src/features/live-sessions/components/tournament-complete-form/tournament-complete-form.test.tsx` の2件へ置換。実formを外部toolbarで送信し、必須エラー→修正→payload、期限前チェックで項目を隠す→送信→解除で必須復活を確認する。開始formのform ID確認も実入力→外部ボタン送信へ置換した。
- チャート: stubへ渡すpropsの写しを実lazy chartのアクセシブルな系列説明へ置換。独立implテスト3件を統合し、cashとtournamentの平均stack有無を通す。重い依存の初回変換はbeforeAllで待ち、UI待機timeoutを隠す固定sleepは追加しない。
- 装飾・実装固定: gap-4、text-destructive、tupleの型/長さ、import存在、React setterの参照安定性を整理。timerの休憩caseは存在だけの確認から利用者に伝える休憩・残時間・進捗値へ強化した。

実QueryClientのoptimistic/rollback、損益・EV、日時境界、schema、既知回帰は保持した。通信をstubしたhook/UIテストをSQL・所有権・Cookieの検証とは数えない。細かいフォーム編集やsnapshot変換は対象ごとの異なる契約として残し、同じDBライフサイクルを全フォームで繰り返さない。

## ファイル別の処置

「維持」は内容レビュー済みの判断であり、未着手を意味しない。root直下のmobile-nav/authenticated-shell、およびplayers側のlive連携は別のWebレビュー記録を参照する。新しい完了フォームテスト1ファイルは上記の置換先であり、以下は開始時点の90ファイルを一意に列挙する。

| 元のファイル | 処置 | 内容上の理由・代替 |
|---|---|---|
| `apps/web/src/__tests__/session-events-routes.test.tsx` | 維持 | URLのsessionId/sessionTypeをsceneへ接続し、未知typeをcashに正規化する2件。外部経路入力の変換を検証する境界unitとして保持。 |
| `apps/web/src/__tests__/single-session-guard.test.tsx` | 削除 | 11件のうち10件はテスト内ActiveSessionStatusPageまたはmockの戻り値自体を確認し、製品guardを実行しない。残るdrawer1件も専用UIテストと重複。実hook選択・実D1同時開始で置換範囲を明示。 |
| `apps/web/src/__tests__/tournament-lifecycle.test.tsx` | 統合・置換 | 偽reopen2件を削除、同じ画面のheading/actions/席を統合し18→8件。フォーム4件は新実UI2件へ移動。summaryはラベルだけでなく30/100と欠損のdashを検証。ファイル冒頭でview構成検証に範囲を限定。 |
| `apps/web/src/features/live-sessions/components/actions-drawer/actions-drawer.test.tsx` | 整理 | text-destructive class固定1件を削除。選んだactionのみ1回実行、同名別IDの回帰、accessible copy、空状態は維持。 |
| `apps/web/src/features/live-sessions/components/active-session-game-scene/active-session-game-scene.test.tsx` | 維持 | リンク有無の表示、凍結mixを編集へ渡す回帰、tournamentの第3blind表示。props確認もmaster/snapshot混同を検出する意味がある。 |
| `apps/web/src/features/live-sessions/components/active-session-scene/__tests__/use-active-session-scene-state.test.ts` | 維持 | 卓人数境界、退席済除外、hero席の占有禁止、unseatedへの移動、タグ結合と席ID付き操作。通信部はstubであり実DB制約は別層。 |
| `apps/web/src/features/live-sessions/components/active-session-scene/__tests__/use-active-session-scene.test.ts` | 維持 | メニュー選択で元menuを閉じて次のaction/sheetへ移る状態機械。discardの確認開始を保護。 |
| `apps/web/src/features/live-sessions/components/active-session-scene/active-session-scene.test.tsx` | 維持 | 実scene hookとUIでメニュー→pause/end、discard確認、game settings、scan起動。子stubは重いsheet内容を対象外にする境界。 |
| `apps/web/src/features/live-sessions/components/active-session-scene/game-settings-sheet/game-settings-sheet.test.tsx` | 維持 | 閉じたsheetで重いgame sceneをmountしない契約とtitle。単なる装飾要素の個数ではない。 |
| `apps/web/src/features/live-sessions/components/active-session-scene/history-section/history-section.test.tsx` | 維持 | 実accordion操作で履歴のmount/unmount、aria-expanded、埋込み/polling指定。閉時のquery寿命を守る境界テスト。 |
| `apps/web/src/features/live-sessions/components/active-session-scene/seat-list/empty-seat-editor/__tests__/use-empty-seat-editor.test.ts` | 維持 | 名前/タグ検索、既存着席者を除外、trimして作成、選択後reset、hero/tempの作用。 |
| `apps/web/src/features/live-sessions/components/active-session-scene/seat-list/empty-seat-editor/empty-seat-editor.test.tsx` | 維持 | viewの検索/作成/既存/一時/hero各操作とhero利用不可時の非表示。hookロジックは別テストでありUI callback配線は残す。 |
| `apps/web/src/features/live-sessions/components/active-session-scene/seat-list/occupied-seat-editor/__tests__/use-occupied-seat-editor.test.ts` | 維持 | 変更のない名前/memo・未読込タグの保存抑止、trim、重複tag、memo clearをnullに変換。UIテストにない失敗予防条件。 |
| `apps/web/src/features/live-sessions/components/active-session-scene/seat-list/occupied-seat-editor/occupied-seat-editor.test.tsx` | 維持 | 実view+hookでblur保存、tag追加/除去、memo focus離脱、loading/saving表示。 |
| `apps/web/src/features/live-sessions/components/active-session-scene/seat-list/player-tag-badges/player-tag-badges.test.tsx` | 維持 | 計測結果を境界stubにして見えるタグと+Nの内容を検証。純粋幅計算テストと表示側責務を分担。 |
| `apps/web/src/features/live-sessions/components/active-session-scene/seat-list/seat-list.test.tsx` | 維持 | 0始まり席→1始まり表示、hero/empty/occupied、正しい席とplayerを操作、1つだけ展開、unseated操作。 |
| `apps/web/src/features/live-sessions/components/addon-bottom-sheet/__tests__/use-addon-form.test.ts` | 維持 | 実formの負数/空拒否、整数化、再openで初期値へ戻す挙動。 |
| `apps/web/src/features/live-sessions/components/all-in-bottom-sheet/__tests__/use-all-in-form.test.ts` | 維持 | pot/equity/trialsの実validation、winsの小数/上限、再open reset。金額計算入力の保護。 |
| `apps/web/src/features/live-sessions/components/all-in-bottom-sheet/all-in-bottom-sheet.test.tsx` | 維持 | 実form入力→sheet Save、edit/delete可否、再open、EV表示。sheet外枠stubでも入力formは実体。 |
| `apps/web/src/features/live-sessions/components/assign-ring-game-dialog/__tests__/use-assign-ring-game.test.ts` | 維持 | room必須、既存選択とatomic create-and-assign RPCの使い分け、成功close/失敗保持、関連query更新。SQL原子性は実D1側で検証。 |
| `apps/web/src/features/live-sessions/components/assign-tournament-dialog/__tests__/use-assign-tournament.test.ts` | 維持 | room変更時の選択解除、atomic RPC、成功時2dialog close、失敗時保持とtoast。SQL原子性は実D1側で検証。 |
| `apps/web/src/features/live-sessions/components/cash-game-complete-form/__tests__/use-cash-game-complete-form.test.ts` | 維持 | 最終stackの初期値、必須/非負、数値送信。 |
| `apps/web/src/features/live-sessions/components/cash-game-stack-form/__tests__/use-cash-game-stack-form.test.ts` | 維持 | 実formとProviderのstack同期、memo成功reset、独立sheet制御。 |
| `apps/web/src/features/live-sessions/components/cash-game-stack-form/cash-game-stack-form.test.tsx` | 維持 | 外部submit、完了へcurrent stack、all-in/増資/pause、memo必須の実UI操作。 |
| `apps/web/src/features/live-sessions/components/chip-purchase-sheet/chip-purchase-sheet.test.tsx` | 維持 | ルールで定義した購入optionの選択→sessionChipPurchaseId付き送信、closed/empty状態。 |
| `apps/web/src/features/live-sessions/components/create-session-dialog/__tests__/create-session-dialog.test.tsx` | 維持 | 開始drawerのopen/closedとtitle・form領域。削除する旧single-session-guard内の唯一の実component確認を代替。 |
| `apps/web/src/features/live-sessions/components/create-session-dialog/__tests__/use-create-session-dialog.test.ts` | 維持 | cash/tournamentで異なるcreate payloadへ変換し、buyIn→initialBuyIn、startingStack初期値、close/resetを接続。 |
| `apps/web/src/features/live-sessions/components/create-session-dialog/live-session-form/__tests__/use-live-session-form.test.ts` | 維持 | 近傍room初期値が手動選択/clearを上書きしない、cash-out不要の開始、rule入力エラー時の自動展開。 |
| `apps/web/src/features/live-sessions/components/create-session-dialog/live-session-form/live-session-form.test.tsx` | 置換・整理 | form IDの存在確認を実入力→外部toolbar送信へ変更。accordion gap-4固定を削除し、展開のaria状態と入力表示は維持。 |
| `apps/web/src/features/live-sessions/components/create-session-dialog/set-room-location-dialog/set-room-location-dialog.test.tsx` | 維持 | ルーム名を示しSave/Not nowが別callbackへ届く実操作、closed状態。 |
| `apps/web/src/features/live-sessions/components/event-badge/event-badge.test.tsx` | 維持 | Tab→Enter/Spaceで実buttonを操作するkeyboardアクセシビリティ契約。 |
| `apps/web/src/features/live-sessions/components/event-editors/all-in-editor/__tests__/use-all-in-editor.test.ts` | 維持 | 過去event編集でpot/equity/wins/trialsを検証し時刻付きpayloadへ変換。入力formとは異なる履歴時刻境界を含む。 |
| `apps/web/src/features/live-sessions/components/event-editors/chips-add-remove-editor/__tests__/use-chips-add-remove-editor.test.ts` | 維持 | 持出しを負数に変換、0量拒否、履歴編集の時刻境界。 |
| `apps/web/src/features/live-sessions/components/event-editors/memo-editor/__tests__/use-memo-editor.test.ts` | 維持 | 空白memoの拒否と編集日時付き送信、前後時刻の制約。 |
| `apps/web/src/features/live-sessions/components/event-editors/purchase-chips-editor/__tests__/use-purchase-chips-editor.test.ts` | 維持 | name必須と数値化、元sessionChipPurchaseId保持、編集時刻の制約。 |
| `apps/web/src/features/live-sessions/components/event-editors/session-end-editor/__tests__/use-session-end-editor.test.ts` | 維持 | cash out非負、tournament期限前後で異なる必須/送信payload、日時付き履歴編集。 |
| `apps/web/src/features/live-sessions/components/event-editors/session-start-editor/__tests__/use-session-start-editor.test.ts` | 維持 | buy-in必須と数値化、tournament timerのnull clearと秒単位への変換。 |
| `apps/web/src/features/live-sessions/components/event-editors/time-only-editor/__tests__/use-time-only-editor.test.ts` | 維持 | 元時刻の初期表示、空入力で更新しない、minTime制約、時刻更新callback。 |
| `apps/web/src/features/live-sessions/components/event-editors/update-stack-editor/__tests__/use-update-stack-editor.test.ts` | 維持 | stack非負と数値化、日時付き送信、前後時刻制約。 |
| `apps/web/src/features/live-sessions/components/live-stack-form-sheet/__tests__/use-live-stack-form-sheet.test.ts` | 維持 | 実StackSheet Providerとの開閉、完了sheetとの独立性、完了stack初期値、Providerなしの契約。 |
| `apps/web/src/features/live-sessions/components/live-stack-form-sheet/live-stack-form-sheet.test.tsx` | 維持 | cash/tournamentに応じて記録sheetから対応する完了sheetへ進むUI経路。フォーム内容の境界stubをlifecycle成功と混同しない。 |
| `apps/web/src/features/live-sessions/components/seat-from-screenshot-sheet/__tests__/use-seat-from-screenshot.test.ts` | 維持 | source選択→upload→戻る、再open reset、適用対象なしの拒否。画像抽出/DB一括適用まで通る統合テストではないと範囲を限定。 |
| `apps/web/src/features/live-sessions/components/session-events-scene/__tests__/use-session-events-scene.test.ts` | 整理・強化 | function型/import存在だけの2件を削除。前後時刻はDate型だけでなく実際の12:00/14:00を検証。編集選択/group/削除確認stateは維持。 |
| `apps/web/src/features/live-sessions/components/session-events-scene/session-events-scene.test.tsx` | 維持 | 実view+編集formでchipsとpurchaseを更新、embeddedでも操作可能、read-only時の編集/削除非表示。 |
| `apps/web/src/features/live-sessions/components/session-result-chart/__tests__/session-result-chart-impl.test.tsx` | 統合削除 | 3件の系列/点数テキスト代替をsession-result-chart.test.tsxの実chart経路へ移行してgreen確認。SVGの配置・色は固定しない。 |
| `apps/web/src/features/live-sessions/components/session-result-chart/__tests__/session-result-chart.test.tsx` | 置換 | chart impl mockを外し実hook/QueryClient→実derive→React.lazy→実chartの系列説明を検証。empty/error/retry、cash、平均stack有無を6ケースに集約。通信queryだけstub。 |
| `apps/web/src/features/live-sessions/components/session-result-chart/__tests__/use-session-result-chart.test.ts` | 維持 | 非表示中fetch抑止、session種別のquery入力、実derive数値とempty判定。UI系列説明とは異なるquery/計算境界。 |
| `apps/web/src/features/live-sessions/components/stack-record-editor/__tests__/use-stack-record-editor.test.ts` | 維持 | all-in行の追加/編集/削除とpayload ID除去、時刻制約。 |
| `apps/web/src/features/live-sessions/components/stack-record-editor/stack-record-editor.test.tsx` | 維持 | 実UIで時刻制約違反はSave不可、修正後に正しい日時/payload送信、pending中は保存不可。 |
| `apps/web/src/features/live-sessions/components/tournament-complete-form/__tests__/use-tournament-complete-form.test.ts` | 維持 | 実schemaのplacement必須/下限、期限前後payload、bounty空値変換。新UI2件と全境界を重複させない。 |
| `apps/web/src/features/live-sessions/components/tournament-stack-form/__tests__/use-tournament-stack-form.test.ts` | 維持 | 実form/Provider同期、recordTournamentInfoの送信条件、null変換、memo必須/reset。 |
| `apps/web/src/features/live-sessions/components/tournament-stack-form/tournament-stack-form.test.tsx` | 維持 | 外部submit、購入option/回数、remaining/entries条件、完了/pauseのUI配線。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-active-session.test.ts` | 維持 | 実hookとQueryClientでcash/tournament・active/pausedの選択、読み込み、エラー、失敗queryのretryを検証。serverの単一開始制約とは別契約。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-assign-dialog-state.test.ts` | 統合 | 初期closed→open→closeを1件へ統合。React useStateの関数setter形式と参照安定性を再検証する2件は削除。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-cash-game-session.test.ts` | 維持 | roomに応じたquery有効化、discard成功時の移動と失敗時の移動抑止、pending状態。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-cash-game-stack.test.ts` | 維持 | cashイベントpayloadの符号、実キャッシュの楽観表示/復旧、pause/resume、完了失敗時の移動抑止。DB永続化の証拠には数えない。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-create-session.test.ts` | 維持 | 開始payloadと初期tournament stack、pending、開始拒否、位置保存/skip/保存失敗のSA2-100分岐。通信stubはUI側制御の検証に限定。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-ring-game-scene-actions.test.ts` | 維持 | masterではなく凍結snapshotへ保存、mix明示nullでclear、保存失敗でeditorを保持。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-seat-combobox.test.ts` | 維持 | popoverを開いた時の実DOM幅取得・再計測。未接続anchorの扱いを含み、React setterのみの確認とは異なる。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-session-events.test.ts` | 維持 | 実QueryClientによるイベント編集/削除/rollback、関連一覧の無効化、pending中のpollingが楽観編集を上書きしない回帰。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-session-form.test.tsx` | 維持 | 実Providerでsession切替時にcash/tournament全入力を消去し、同じIDでは維持。rebuy数が次のsessionへ漏れない回帰。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-session-tournament-structure.test.ts` | 維持 | 空IDでfetch抑止、pending、凍結snapshotからblind levels/chip purchasesを復元する公開view model。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-tournament-detail.test.ts` | 維持 | ID依存のquery有効化とtournament/chip purchase/level/currency読込。詳細なしの空配列fallbackを保護。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-tournament-scene-actions.test.ts` | 維持 | 凍結snapshotとlevels/chip purchases保存、省略値null、pending解除、失敗後の状態とcache再取得。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-tournament-session.test.ts` | 維持 | discardからの移動、timerのDate→秒/null clear、実mutationのpending状態。 |
| `apps/web/src/features/live-sessions/hooks/__tests__/use-tournament-stack.test.ts` | 維持 | tournamentイベント入力・平均stackの楽観表示、chip purchase ID、完了条件のpayload、失敗rollback。 |
| `apps/web/src/features/live-sessions/pages/active-session-page/__tests__/active-session-page.test.tsx` | 維持 | query失敗を空状態と混同しないalert/Retryと、成功して空の場合の描画。view専用のhook stubは認証・通信成功の証拠にはしない。 |
| `apps/web/src/features/live-sessions/pages/active-session-page/cash-game-compact-summary/__tests__/use-cash-game-compact-summary.test.ts` | 維持 | 実表示モデルの損益/EVとSA2-124持出し金額、未計測stackと0の違い。色だけのassertもあるが損益caseを削除しない。 |
| `apps/web/src/features/live-sessions/pages/active-session-page/cash-game-session/__tests__/use-cash-game-session-view.test.ts` | 維持 | hero席正規化、損益summary、各sheetの開閉と送信、完了初期stack、SA2-124の配線。単純な返却値に見える箇所にも業務変換がある。 |
| `apps/web/src/features/live-sessions/pages/active-session-page/memo-form-sheet/__tests__/use-memo-form-sheet.test.ts` | 維持 | 実formの必須入力・送信payload・成功resetを3件で検証。useStateだけのhookではない。 |
| `apps/web/src/features/live-sessions/pages/active-session-page/tournament-compact-summary/__tests__/use-tournament-compact-summary.test.ts` | 維持 | remaining/totalの欠損表示、平均stackの0と未取得の区別、compact表示。 |
| `apps/web/src/features/live-sessions/pages/active-session-page/tournament-session/__tests__/use-tournament-session-view.test.ts` | 維持 | hero席とsummary正規化、timer構造、timer/chip/memo/complete sheetの制御と送信先。 |
| `apps/web/src/features/live-sessions/pages/active-session-page/tournament-session/tournament-timer-dialog/__tests__/use-tournament-timer-dialog.test.ts` | 維持 | 実formの日時初期化、空拒否、Dateとして送信、再openで新timer値へ同期。 |
| `apps/web/src/features/live-sessions/pages/active-session-page/tournament-session/tournament-timer/__tests__/use-tournament-timer-scene.test.ts` | 維持 | fake clockで実interval hookのtick、周期変更、unmount時clear。UIタイマー更新の寿命を保護。 |
| `apps/web/src/features/live-sessions/pages/active-session-page/tournament-session/tournament-timer/tournament-timer.test.tsx` | 強化 | 休憩色という名称でprogressbarの存在しか見ない1件を、Break表示・残り05:00・aria-valuenow=50へ変更。開始/編集/終端UIは維持。 |
| `apps/web/src/features/live-sessions/utils/__tests__/all-in-validation.test.ts` | 維持 | 実refinementのwins/trials関係、引分けの小数勝利、field-level validationとの責務境界。損益入力の保護。 |
| `apps/web/src/features/live-sessions/utils/__tests__/create-tournament-session-form-helpers.test.ts` | 維持 | 日時を秒へ変換する入力境界と、buy-in/starting stackの必須・非負schema。 |
| `apps/web/src/features/live-sessions/utils/__tests__/game-scene-formatters.test.ts` | 維持 | mix gameのblind/ante表記、null/noneの違い、非表示anteをcompact単位に含めない回帰。 |
| `apps/web/src/features/live-sessions/utils/__tests__/geo.test.ts` | 維持 | 距離の対称性・緯度差、近傍ルーム選択と半径境界、座標欠落。位置情報による初期選択を保護。 |
| `apps/web/src/features/live-sessions/utils/__tests__/memo-excerpt.test.ts` | 維持 | rich textから読みやすい抜粋へ変換するHTML/entity/改行/空文字の契約。 |
| `apps/web/src/features/live-sessions/utils/__tests__/optimistic-session-event.test.ts` | 維持 | 実QueryClientのイベント・詳細・一覧rollback、pause/resumeの一覧移動、同時刻ID衝突、SA2-124チップ持出し損益。計算と既知回帰を削減しない。 |
| `apps/web/src/features/live-sessions/utils/__tests__/seat-screenshot.test.ts` | 整理 | SOURCE_APP_ENTRIESのtuple長/型/非空だけの1件を削除。画像type、曖昧な同名照合、hero一意性、席範囲、occupied警告の実ロジックは維持。 |
| `apps/web/src/features/live-sessions/utils/__tests__/session-events-formatters.test.ts` | 維持 | event種別ごとのpayload表示、日付別group、イベント編集の前後時刻境界。単なる宣言数の確認ではない。 |
| `apps/web/src/features/live-sessions/utils/__tests__/session-timeline.test.ts` | 維持 | 現金損益とEV、増資/持出し、tournament平均stack、優勝/期限前完了の時系列。入力schemaと数値を保護。 |
| `apps/web/src/features/live-sessions/utils/__tests__/snapshot-diff.test.ts` | 維持 | 凍結snapshotとmasterのmix group/ante/level差分、順序、null正規化。編集UIの差分表示に必要。 |
| `apps/web/src/features/live-sessions/utils/__tests__/stack-editor-time.test.ts` | 維持 | 入力時刻の適用・秒変換と前後イベントのmin/max境界。DateとISO両入力の既存仕様を保持。 |
| `apps/web/src/features/live-sessions/utils/__tests__/tag-overflow.test.ts` | 維持 | 利用可能幅に合わせて+N用の幅を予約する独立計算。gapとちょうど収まる境界は可読性に関わる。 |
| `apps/web/src/features/live-sessions/utils/__tests__/tournament-timer.test.ts` | 維持 | 実時計計算のレベル境界、休憩、0分レベル、構造終端、mix blind表示。 |
| `apps/web/src/features/sessions/pages/session-detail-page/__tests__/use-live-linked-session-edit.test.ts` | 維持 | 実hookのmanual/live query切替、seed日付固定、再openで再seed、変更なしは送信しない、end→startの更新順序、初回失敗で後続停止。 |
| `apps/web/src/features/sessions/utils/__tests__/live-linked-edit.test.ts` | 維持 | 実変換で集計値を直接編集しない、元eventの日付を保持、前後時刻制約、required/disabledの非重複、編集開始snapshot比較で別操作を巻き戻さない。 |

## 実行結果と検証の範囲

- `bunx vitest run --project web-dom --project web-node apps/web/src/features/live-sessions apps/web/src/__tests__/tournament-lifecycle.test.tsx apps/web/src/__tests__/session-events-routes.test.tsx`: 87ファイル、964ケース、全件成功（29.47秒）。元88ファイルから2ファイルを削除し、実完了フォーム1ファイルを追加した結果。skip追加なし。
- `bunx vitest run --project web-dom --project web-node apps/web/src/features/sessions/utils/__tests__/live-linked-edit.test.ts apps/web/src/features/sessions/pages/session-detail-page/__tests__/use-live-linked-session-edit.test.ts`: 追加レビューの2ファイル、90ケース、全件成功（1.79秒）。上記と合わせて89ファイル、1,054ケース。
- 新フォーム/実chartの対象3ファイルは13ケース成功を確認後、旧chart impl専用ファイルを削除。初回試行ではrequired記号の空白に依存したテスト側label指定と、chart依存の初回変換待ちに不備があり修正した。製品変更は不要だった。
- 本記録はWebの挙動検証の整理を扱う。実D1 lifecycleとOAuth/MCP/ブラウザー永続化の実行記録は全体の移行記録を参照する。
- `bun run --filter web check-types` と `bun run check:testing-types` は成功。OAuth同意拒否の局所修正は `patches/better-auth@1.6.0.patch` のredirect構築のみであることを再確認し、`bun install --frozen-lockfile` は1,101 installs/1,300 packages、変更なしで成功した。
- SVGの描画位置・色、画像抽出サービス自体の実応答、全端末での見た目は、このjsdom群の保証範囲に含めない。通信mockを残したテストの範囲は各行に記載した。

## 最新dev取り込み時の追補（初期407件とは別集計）

`origin/dev` の `8d3dbdc2` 取り込み時、担当のlive/rootテスト5競合はmerge baseからupstreamまでの差分を個別に確認した。変更はコメント削除のみで、追加された実行契約はなかった。`single-session-guard.test.tsx` の削除と、tournament-lifecycle/use-session-events-scene/session-result-chart/tournament-timerの再編を維持し、新しい `comments.md` に従って説明コメントを削除した。根拠と代替検証は本記録へ保持している。

次の5ファイルはupstreamで新規追加されたものであり、上記90件・初期407件に含めない。テスト本体と対象実装を読み、ブラウザー能力・localStorage・認証clientを制御するunitの保証範囲を確認した。

| ファイル | 処置 | 根拠・代替 |
|---|---|---|
| `apps/web/src/features/auth/utils/__tests__/auto-register-passkey.test.ts` | 維持 | ユーザーが拒否した端末への再作成禁止、conditionalCreate未対応時に認証器へ触れないこと、登録の成功・拒否・例外、非同期の通知とサインインを待たせない契約。WebAuthn認証器そのものはmock境界外。 |
| `apps/web/src/features/auth/utils/__tests__/login-continuation.test.ts` | 整理 | URLの欠落/無関係なquery、OAuth allowlist、元state/redirectとsocial callback復帰を維持。stubLocation自身のorigin初期値を確認する1件を削除し、実ブラウザーの未認証authorize→ログイン→同意を既存OAuth成功E2Eへ追加。 |
| `apps/web/src/shared/lib/__tests__/device-name.test.ts` | 整理 | OS/browserの優先照合、iPadOSのdesktop UA、platform hint、navigator不在を維持。同じUA入力のAndroid/ChromeOS/macOSを再確認する3件は既存パラメーター表の完全一致assertへ集約。 |
| `apps/web/src/shared/lib/__tests__/passkey-opt-out.test.ts` | 整理 | opt-outの保存/解除、未知値、storage拒否とwindow不在を維持。removeItem/setItemの呼出し方を固定する1件を削除し、保存→解除後の読戻しで利用者設定の結果を確認。 |
| `apps/web/src/shared/lib/__tests__/webauthn.test.ts` | 維持 | 通常WebAuthnとconditionalCreateの対応差、能力照会の拒否、取り消しcodeと実DOMExceptionのname、通常エラーとの区別は異なるブラウザー境界の契約。 |

OAuth E2Eは実登録・認証・Cookie・D1・MCPを通す構成を保持し、通常ログインでは自動passkey登録を無効化していない。取り込み後の9 E2Eは30.5秒、再試行0で成功した。ログには実 `/api/auth/passkey/generate-register-options` の成功があり、その後の画面操作・同contextのlogout/別account・offline復帰と未処理ブラウザーエラー監視も通った。

取り込み後にlive領域・rootのtournament-lifecycle/session-events-routes・全auth・新shared/lib 3ファイルを対象指定で実行し、98ファイル・1,114ケースが成功した（32.74秒）。追加基盤の型検査と担当ファイルの整形・差分検査も成功し、E2E終了後に専用port 13001/18787のListenが残っていないことを確認した。

実認証までの残る接続を保護するため、新規 [passkeys.spec.ts](../e2e/passkeys.spec.ts) を1件追加した。mobile Settingsで登録→reload後の保存確認→実logoutとsession消去→passkeyログイン→同じuser ID/emailへの復帰を実行する。CDP仮想認証器のresident credential・RP ID・署名counterの増加も確認し、SDKや `navigator.credentials`、Better Auth、D1をmockしない。認証器はケース終了時に除去する。個別実行は1件成功（本体6.1秒、起動込み1.0分）、型・整形・port解放確認も成功した。初回は成功toastがSign out操作を遮るテスト手順で失敗したため、登録後のreloadと保存確認を追加した。製品バグ修正のredには数えない。Playwrightの検出結果は既存9件と合わせて5ファイル・10件で、新規ケースはmobileだけに登録される。

## 実tRPCキーによる一覧無効化の追補

記録済みセッション一覧はinfinite queryだが、ライブ開始・完了・破棄・割当・event更新の8フックが通常query用キーで無効化していた。既存の配列mockはquery種別の違いを消していたため、この不一致を検出できていなかった。対象は `use-create-session`、cash/tournamentの `use-*-session` / `use-*-stack`、`use-session-events`、ring/tournamentの `use-assign-*`。これらのsession.list用キーだけを `pathKey()` へ変更し、別procedureは維持した。

対応する既存テストで実options proxyから生成したinfinite cacheを用意し、各操作後にstaleになることを検証する。テストを増やさず、mockキーへのspy期待を実cacheへ置換・補強した。tournament-lifecycleのfixtureも実キーに合わせた。セッション詳細・タグの同種修正を含む全体では既存13ケースでredを確認し、11ファイル・122ケースが成功した。保存データの正しさ・認可はD1統合の責務であり、この検証は関連一覧の更新漏れを保護する。
