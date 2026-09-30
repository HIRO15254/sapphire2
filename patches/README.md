# 依存パッケージの局所修正

`better-auth@1.6.0.patch` はOAuth同意拒否のredirect構築だけを修正する。

1.6.0のOIDC providerは拒否時にcallback URIへ `?error=...` を文字列連結し、元のOAuth `state` を返さない。queryを含むcallbackでは既存queryも壊れる。承認時と同様にURL APIでerrorとstateを設定し、既存queryを保持する。

実Better Auth・D1・ブラウザーを通る [`e2e/oauth-mcp.spec.ts`](../e2e/oauth-mcp.spec.ts) の「requires consent again and preserves OAuth state when access is denied」で修正前の失敗と修正後の成功を確認している。認証・同意の判定やtokenの発行条件は変更しない。

Bunの `patchedDependencies` からinstall時に適用される。Better Authを更新するときは、上流で同じ問題が解消されたかを確認し、この回帰テストを実行して不要になったpatchを削除する。再編集は `bun patch better-auth@1.6.0` でcacheから分離したコピーを準備してから行い、`bun patch --commit node_modules/better-auth` で保存する。
