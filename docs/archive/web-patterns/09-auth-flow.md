# Auth Flow — Better Auth

このドキュメントは `apps/web/` 全面リライト前の現状を、認証（Auth）まわりに絞って固定する位置付けである。現在の sapphire2 は [Better Auth](https://www.better-auth.com/) を中核に据え、メールパスワードと Google / Discord の 2 つの OAuth プロバイダを、`account` テーブル上で 1 ユーザーに複数 provider をぶら下げる Account Linking 込みで運用している。`08-auth.md` の overview ノートとは別に、本ファイルは「ファイル単位で何が今動いているか」をコード抜粋付きで残す。

## 何を解決しているか

ユーザーが sapphire2 にログインする経路は 3 系統あり、いずれも最終的に `account` 行 1 件（と必要に応じて `session` 行 1 件）に集約される。

- **メールパスワード**: `/login` ページの `SignInForm` / `SignUpForm` から `authClient.signIn.email` / `authClient.signUp.email` を叩く経路。サーバ側 Better Auth が PBKDF2 SHA-256 で password をハッシュし、`account.providerId = "credential"` の行に格納する。
- **Google OAuth**: `authClient.signIn.social({ provider: "google" })` 経由。Better Auth が `/api/auth/*` 配下の OAuth ハンドラに着地し、コールバック完了後に `account.providerId = "google"` の行が生成される。
- **Discord OAuth**: Google と同じ仕組み。`provider: "discord"`、`account.providerId = "discord"`。
- **Account Linking**: 上記いずれかでログイン済みのユーザーが、`/settings` の `LinkedAccounts` UI から別の provider を追加できる。Better Auth の `accountLinking.enabled = true` と `trustedProviders: ["google", "discord", "credential"]`（[`packages/auth/src/index.ts`](../../../packages/auth/src/index.ts) の 134-139 行）でこれを許可している。逆方向の解除（unlink）も同 UI から可能だが、最後の 1 つは外せないようガードを入れている。

認証ゲートはアプリ全体で 2 箇所だけにまとめている。ルートレイアウト [`apps/web/src/routes/__root.tsx`](../../../apps/web/src/routes/__root.tsx) の `beforeLoad` で `/login` 以外は未ログインなら `/login` に `throw redirect`、`/login` ルート自身の `beforeLoad` で「もうログイン済みなら `/dashboard` に飛ばす」を実装する。各ページ側で `authClient.useSession()` を毎回呼ぶ運用は避けている。

## 中心となる部品

ファイルパスと役割：

- [`packages/auth/src/index.ts`](../../../packages/auth/src/index.ts) — Better Auth サーバ設定のファクトリ `createAuth(dbInstance, options)`。`drizzleAdapter` で D1 に接続し、`emailAndPassword.password.{hash,verify}` に PBKDF2 SHA-256 の自前実装を差し込み、`socialProviders` に Google / Discord、`account.accountLinking` を有効化、`advanced.defaultCookieAttributes` で `sameSite: "none"` / `secure: true` / `httpOnly: true` を設定する。
- [`apps/server/src/worker.ts`](../../../apps/server/src/worker.ts) — Cloudflare Workers エントリ。`app.on(["POST", "GET"], "/api/auth/*", …)` で Better Auth のハンドラを Hono に張り、別途 `app.post("/api/auth/set-password", …)` で `auth.api.setPassword` を直叩きするカスタム経路を持つ（Better Auth クライアントの `set-password` 経由が成立しないため）。CORS は `cors({ origin: c.env.CORS_ORIGIN, credentials: true, allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"] })` をすべての `/*` に適用し、cookie を伴うリクエストが通る前提を作る。tRPC 用の `/trpc/*` ミドルウェアでも同じ `createAuth(...)` を呼んでおり、`createContextFactory(auth, db, c.env.ANTHROPIC_API_KEY)` 経由でルータ context に Better Auth インスタンスを渡している。リクエストごとに `createAuth` を呼び直す（Workers の isolate モデル上、handler スコープでファクトリ呼び出しが安価に済む前提）。
- [`apps/web/src/lib/auth-client.ts`](../../../apps/web/src/lib/auth-client.ts) — `createAuthClient({ baseURL: env.VITE_SERVER_URL })` でクライアント SDK を構築。`apps/web` 内ではこの `authClient` を `import { authClient } from "@/lib/auth-client"` で参照する。
- [`packages/db/src/schema/auth.ts`](../../../packages/db/src/schema/auth.ts) — Better Auth の 4 テーブル `user` / `session` / `account` / `verification` の Drizzle スキーマ。`session.userId` と `account.userId` は `user.id` への FK で `onDelete: "cascade"`。`account` テーブルは `accountId` / `providerId` / `userId` を持ち、credential ログインの場合は `account.password` 列にハッシュ文字列を格納する。
- [`apps/web/src/routes/__root.tsx`](../../../apps/web/src/routes/__root.tsx) — トップレベルの認証ゲート。`beforeLoad` で `authClient.getSession()` を呼び、`/login` 以外は未ログインなら `redirect({ to: "/login" })`。`RootComponent` は `pathname === "/login"` で `AuthenticatedShell` を外し、それ以外では `AuthenticatedShell` でサイドナビ / モバイルナビ / トースト枠を挿入する。
- [`apps/web/src/routes/login.tsx`](../../../apps/web/src/routes/login.tsx) — `/login` のページ。`beforeLoad` で「既にセッションがあれば `/dashboard` に飛ばす」を担当。本体は `useLoginPage` でサインイン / サインアップ表示の切替フラグを取り、`SignInForm` / `SignUpForm` のどちらかを `PublicPageShell` の中で出す。
- [`apps/web/src/shared/components/sign-in-form/`](../../../apps/web/src/shared/components/sign-in-form/) — `sign-in-form.tsx`（JSX のみ）と `use-sign-in.ts`（`useForm` + `authClient.signIn.email` / `authClient.signIn.social` を呼ぶロジック）の 2 ファイル構成。フォームのバリデーションは `validators.onSubmit: zodSchema`。
- [`apps/web/src/shared/components/sign-up-form/`](../../../apps/web/src/shared/components/sign-up-form/) — sign-in と同形。`authClient.signUp.email` を叩く `use-sign-up.ts` と `sign-up-form.tsx`。OAuth ボタンは sign-in と同じ `authClient.signIn.social` を再利用する（sign-up と sign-in でフローが分岐しないため）。
- [`apps/web/src/shared/components/auth-form-shell/`](../../../apps/web/src/shared/components/auth-form-shell/) — sign-in / sign-up 共通のカード枠 `AuthFormShell`。`eyebrow` / `title` / `description` / `providerActions[]` / `switchLabel` / `onSwitchMode` / `children` を受け取り、上に OAuth ボタン列、`Separator` の "or"、下にメールパスワード form を差し込む。提出ラベルの定数 `authSubmitLabels.{signIn,signUp}.{idle,submitting}` も同モジュールから export している。
- [`apps/web/src/shared/components/linked-accounts/`](../../../apps/web/src/shared/components/linked-accounts/) — `/settings` 配下に出る Account Linking UI。`linked-accounts.tsx`（presentational + SetPasswordDialog 内包）、`use-linked-accounts.ts`（`authClient.listAccounts` / `linkSocial` / `unlinkAccount` 呼び出し）、`use-set-password-form.ts`（[`apps/web/src/shared/hooks/use-set-password-form.ts`](../../../apps/web/src/shared/hooks/use-set-password-form.ts)、`authClient.$fetch("/set-password")` を直叩き）。
- [`apps/web/src/routes/settings.tsx`](../../../apps/web/src/routes/settings.tsx) — `LinkedAccounts` を出すページ。`PageHeader` の `actions` に `Sign Out` ボタンを置き、`authClient.signOut({ fetchOptions: { onSuccess: () => navigate({ to: "/" }) } })` で `/` に戻す。
- [`apps/web/src/shared/components/preview-auto-login/`](../../../apps/web/src/shared/components/preview-auto-login/) — プレビュー環境専用の自動ログイン。`use-preview-auto-login.ts` が `env.VITE_PREVIEW_AUTO_LOGIN === "true"` のときだけ `authClient.signIn.email({ email, password })` を 1 回だけ叩いて `/dashboard` に飛ばす。本番では発火しない。
- [`apps/web/src/shared/components/authenticated-shell/`](../../../apps/web/src/shared/components/authenticated-shell/) — 認証後のレイアウト枠。認証チェック自体は `__root.tsx` で済んでいるため、ここでは `SidebarNav` / `MobileNav` / 各種 Provider の挿入だけを行い、`authClient` を直接は呼ばない。
- [`packages/env/src/web.ts`](../../../packages/env/src/web.ts) — クライアント側の Zod 化 env。`VITE_SERVER_URL` / `VITE_PREVIEW_AUTO_LOGIN` / `VITE_PREVIEW_LOGIN_EMAIL` / `VITE_PREVIEW_LOGIN_PASSWORD` のみ。サーバ側の env（`BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `CORS_ORIGIN` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`）は [`apps/server/src/worker.ts`](../../../apps/server/src/worker.ts) の `interface Env` で型付けし、`@sapphire2/env/server` は現状切られていない。

## 典型フロー

### 1. メールパスワードでサインイン

`/login` で `SignInForm` が描画される。ユーザーが email / password を入力して Submit を押すと、`use-sign-in.ts` の `onSubmit` が `authClient.signIn.email` を呼ぶ。成功時はトースト → `/dashboard` に navigate、失敗時はトーストのみ。

```ts
// apps/web/src/shared/components/sign-in-form/use-sign-in.ts
const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
        await authClient.signIn.email(
            { email: value.email, password: value.password },
            {
                onSuccess: () => {
                    navigate({ to: "/dashboard" });
                    toast.success("Sign in successful");
                },
                onError: (error) => {
                    toast.error(error.error.message || error.error.statusText);
                },
            }
        );
    },
    validators: {
        onSubmit: z.object({
            email: z.email("Invalid email address"),
            password: z.string().min(8, "Password must be at least 8 characters"),
        }),
    },
});
```

サーバ側では `/api/auth/sign-in/email` に POST が到達し、`packages/auth/src/index.ts` の `verifyPassword` が `account.password` 列のハッシュと突き合わせる。PBKDF2 で `iterations: 100_000` / `hash: "SHA-256"` / `salt 16 byte` を毎回新規生成 → `<saltHex>:<hashHex>` 形式で 1 文字列に格納している。

```ts
// packages/auth/src/index.ts
async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
    );
    const derivedBits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: salt.buffer, iterations: 100_000, hash: "SHA-256" } as never,
        keyMaterial, 256
    );
    return `${hexEncode(salt)}:${hexEncode(new Uint8Array(derivedBits))}`;
}
```

成功時に Better Auth は `session` 行（[`packages/db/src/schema/auth.ts`](../../../packages/db/src/schema/auth.ts) の `session` テーブル：`id` / `token` / `expiresAt` / `userId` / `ipAddress` / `userAgent`）を作成し、`Set-Cookie` で `sameSite: "none"` / `secure: true` / `httpOnly: true` のセッションクッキーを返す。クライアント側は `__root.tsx` の `beforeLoad` が次回 navigate 時に `authClient.getSession()` で復元する。`session.userId` は `user.id` への FK で `onDelete: "cascade"` のため、`user` 行が消えれば session も自動的に消える。`user` テーブルは `id` / `name` / `email`（unique）/ `emailVerified` / `image` / `createdAt` / `updatedAt` のみで、追加カラムは現状なし。

### 2. Google OAuth でサインイン

`SignInForm` の上段に並ぶ "Sign in with Google" ボタンを押すと、`use-sign-in.ts` の `onSignInWithGoogle` が走り、`authClient.signIn.social({ provider: "google", callbackURL: \`${window.location.origin}/dashboard\` })` を呼ぶ。`callbackURL` は OAuth 完了後に Better Auth がブラウザを最終的に戻す URL。

```ts
// apps/web/src/shared/components/sign-in-form/use-sign-in.ts
const onSignInWithGoogle = async () => {
    const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/dashboard`,
    });
    if (result.error) {
        toast.error(result.error.message || "Google sign in unavailable");
    }
};
```

サーバ側では `/api/auth/sign-in/social/google` に到達 → Google の OAuth 画面にリダイレクト → ユーザーが同意 → Google から `/api/auth/callback/google` にコールバック → Better Auth が `account.providerId = "google"` の行を作成（既存ユーザーなら Account Linking、既存 `account` なら更新）→ セッション cookie を発行 → `callbackURL`（= `/dashboard`）にブラウザを飛ばす。

Discord も同形で、`provider: "discord"` を渡すだけ。providerId / clientId / clientSecret の存在条件は `packages/auth/src/index.ts` の `socialProviders` 内で

```ts
...(options.googleClientId && options.googleClientSecret && {
    google: { clientId: options.googleClientId, clientSecret: options.googleClientSecret },
}),
...(options.discordClientId && options.discordClientSecret && {
    discord: { clientId: options.discordClientId, clientSecret: options.discordClientSecret },
}),
```

のようにスプレッドで条件付き有効化しているため、`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` が未設定の環境では Google ボタンを押しても Better Auth が "provider not configured" を返す。`AuthOptions` インターフェース側ではいずれも `?` で optional になっており、開発環境で片方の provider しか設定しない運用も成り立つ。

`callbackURL` は OAuth フロー完了後のブラウザ最終遷移先で、Better Auth 内部の cookie 設定が終わった後にクライアント側へ HTTP redirect で返される。これと別に OAuth provider 側（Google / Discord のコンソール）に登録する "Authorized redirect URI" は `${BETTER_AUTH_URL}/api/auth/callback/google` のような Better Auth 固定パスであり、こちらは callbackURL とは別物。混同しないこと。

### 3. Account Linking（後付けで provider を追加）

既にログインしている状態で `/settings` を開くと、`LinkedAccounts` が `authClient.listAccounts()` で現在の `account` 行を取得し、`providerId` の `Set` を作って "Email / Password" / "Google" / "Discord" の 3 行を Linked / Not linked バッジ付きで表示する。

```ts
// apps/web/src/shared/components/linked-accounts/use-linked-accounts.ts
const fetchAccounts = useCallback(async () => {
    const result = await authClient.listAccounts();
    setAccounts((result.data as LinkedAccount[]) ?? []);
    setLoading(false);
}, []);

const handleLink = async (provider: string) => {
    await authClient.linkSocial({
        provider: provider as "google" | "discord",
        callbackURL: `${window.location.origin}/settings`,
    });
};

const handleUnlink = async (providerId: string) => {
    const result = await authClient.unlinkAccount({ providerId });
    if (result.error) {
        toast.error(result.error.message ?? "Failed to unlink account");
        return;
    }
    toast.success("Account unlinked");
    await fetchAccounts();
};
```

UI 上、`totalLinked <= 1` のときは "You must have at least one linked login method." の注意書きを出し、`Unlink` ボタンは `canUnlink = isLinked && totalLinked > 1` で無効化する。最後の 1 つを外せないようにする保険で、サーバ側 Better Auth の制約もあるが UI で先回りで止める。

メールパスワード（`credential` provider）の "追加" だけは `linkSocial` ではなく独自エンドポイント `/api/auth/set-password` を叩く。`useSetPasswordForm` が以下を呼んでいる：

```ts
// apps/web/src/shared/hooks/use-set-password-form.ts
const { error } = await authClient.$fetch("/set-password", {
    method: "POST",
    body: { newPassword: value.newPassword },
});
```

フォーム自体は [`use-set-password-form.ts`](../../../apps/web/src/shared/hooks/use-set-password-form.ts) の `useForm` で組み、Zod スキーマで `newPassword.min(8)` / `confirmPassword.min(8)` を要求した上で `.refine` により `newPassword === confirmPassword` を最後にチェックする。エラーパスは `["confirmPassword"]` に固定して、不一致時のメッセージを confirm 側に出す。Submit 成功時は `toast.success` + `onSuccess()`（親の `fetchAccounts` 再実行で UI が "Linked" 表示に切替）+ `onOpenChange(false)`（Dialog/Drawer を閉じる）の 3 つを呼ぶ。

サーバ側はこれを通常の Better Auth ルーティングではなく [`apps/server/src/worker.ts`](../../../apps/server/src/worker.ts) の専用 handler で受け、`auth.api.setPassword({ headers, body })` を直接呼ぶ：

```ts
// apps/server/src/worker.ts
app.post("/api/auth/set-password", async (c) => {
    const db = createDb(c.env.DB);
    const auth = createAuth(db, { /* ...env... */ });
    const result = await auth.api.setPassword({
        headers: c.req.raw.headers,
        body: await c.req.json(),
    });
    return c.json(result);
});
```

これは Better Auth の標準クライアント経由では set-password が `/api/auth/*` の自動ルーティングに乗らない事情によるもので、`linked-accounts` の "Set Password" ボタン押下時のダイアログ Submit からこの経路を通す。`hasCredential = accounts.some(a => a.providerId === "credential")` が `false` のとき（= OAuth のみでログインしているユーザー）にだけ "Set Password" ボタンが表示され、成功すると `account` テーブルに `providerId: "credential"` の行が増え、次回からはメールパスワードでもログイン可能になる。

### サインアウト

`/settings` の `Sign Out` ボタンが唯一のサインアウト入口で、`authClient.signOut({ fetchOptions: { onSuccess: () => navigate({ to: "/" }) } })` を呼ぶ。Better Auth がサーバ側 `session` 行を削除しつつ cookie を破棄する `Set-Cookie: ...; Max-Age=0` を返し、その後クライアントは `/` に navigate。`/` は `__root.tsx` の認証ゲートで未ログインと判定され `/login` に再 redirect される。サインアウト直後にユーザーに見えるのは一瞬の遷移を経た `/login` のみ。

## 決定と理由

### Better Auth を採用した理由

NextAuth ではなく Better Auth を採用したのは「フレームワーク非依存（Hono on Cloudflare Workers でそのまま動く）」「Drizzle adapter が公式提供されている」「Account Linking が標準機能でフラグ 1 本で有効化できる」「password hash 関数を自前で差し替え可能」の 4 点による。NextAuth は Next.js 前提でルーティングが固く、Workers バンドルに乗せにくい。Lucia Auth はちょうど deprecated 期に当たっており、選択肢から外した。

### PBKDF2 SHA-256 を password hash に使う理由

Better Auth のデフォルトは scrypt 系だが、`packages/auth/src/index.ts` で `password.hash` / `password.verify` を明示差し替えしている。理由は「Cloudflare Workers の Web Crypto API が PBKDF2 をネイティブで実装しており、bcrypt / scrypt のような追加バンドルが要らない」「`crypto.subtle.deriveBits` は Workers の制約（CPU 時間 / メモリ）の中で `iterations: 100_000` を安全に回せる」の 2 つ。bcrypt は wasm 経由になると cold start のペナルティが大きく、Workers のレイテンシ要件と合わない。`iterations` は OWASP の最低推奨を満たす最小値で固定し、必要なら今後上げる余地を残す。

### Google と Discord の 2 provider に絞る理由

ユーザー層がポーカーストア運営者であり、コミュニケーションが Discord に集中している現実が出発点。Google は「メールアドレスログインの代用」として広いユーザー受容性のために入れ、Twitter / GitHub / Apple などは需要が薄いと判断して未投入。プロバイダの追加コスト自体は `socialProviders` にオブジェクトを 1 つ足すだけだが、env と OAuth コンソール（providerコンソール側）の運用も増えるため、最小集合で始めて必要時に拡張する方針を取っている。

### 認証ゲートを layout route で出すメリット

各ページの先頭で `useSession()` を毎回呼ぶと、(1) ページごとに redirect 分岐を書き直す、(2) 認証チェック前の "FOUC 的な" 一瞬の描画が出る、(3) `useSession` の loading 状態を全画面で扱う必要が出る、という 3 つの繰り返しが発生する。`__root.tsx` の `beforeLoad` で `authClient.getSession()` を Promise として待つことで、ページが描画される時点ではセッションの有無が確定しており、子ルート側は `useSession` を呼ぶ必要すらない。`AuthenticatedShell` が `authClient` を一切 import していないのもこのためで、認証ロジックがレイアウト枠から完全に分離されている。

### `__root.tsx` で `/login` を例外扱いする

`beforeLoad` の最初に `if (location.pathname === "/login") return;` を入れることで、`/login` 自身は認証ゲートを通さず、代わりに `routes/login.tsx` 側の `beforeLoad` が "もうログイン済みなら `/dashboard`" の逆方向リダイレクトを担当する。この役割分担で、`/login` は常に「未ログイン状態のページ」、それ以外は「ログイン済み状態のページ」として、ルート定義だけで 2 状態を排他的に扱える。

### サインアップ画面の OAuth ボタンが `signIn.social` を呼ぶ

`use-sign-up.ts` の `onSignInWithGoogle` / `onSignInWithDiscord` は、メソッド名が示すとおり `authClient.signIn.social` を叩く（`signUp.social` ではない）。OAuth provider 側では「初回 = 新規 user 作成」「2 回目以降 = 既存 user の session 作成」を URL レベルで区別する意味がなく、Better Auth が `account` 行の有無で自動的に分岐するため、サインアップ画面でもサインイン画面でも同一 API を共有してよい。これにより、コードの分岐がメールパスワード経路（`signUp.email` vs `signIn.email`）のみに局所化されている。

### `AuthFormShell` で sign-in / sign-up を共通化

`AuthFormShell` は `eyebrow` / `title` / `description` / `providerActions[]` / `switchLabel` / `onSwitchMode` / `children`（フォーム本体） / `footerNote` をプロパティで受け取り、上から「タイトル群 → OAuth ボタン列 → "or" Separator → children のフォーム → switch ボタン」の縦並びを固定で出す。sign-in と sign-up でこの構造が完全に共通であり、差分はラベル文言とフィールド数（sign-up に `name` が追加されるだけ）。これにより新規 provider を増やすときも `providerActions[]` に 1 要素足すだけで両画面に同時反映できる。

### env と secrets の責任分担

クライアントに露出する env は [`packages/env/src/web.ts`](../../../packages/env/src/web.ts) の `VITE_*` 系のみで、auth に関わるのは `VITE_SERVER_URL`（Better Auth client の `baseURL`）と、プレビュー専用の `VITE_PREVIEW_AUTO_LOGIN` / `VITE_PREVIEW_LOGIN_EMAIL` / `VITE_PREVIEW_LOGIN_PASSWORD`。サーバ側の secrets（`BETTER_AUTH_SECRET` / `GOOGLE_CLIENT_SECRET` / `DISCORD_CLIENT_SECRET`）は [`apps/server/src/worker.ts`](../../../apps/server/src/worker.ts) の `interface Env` で TypeScript 型は付くが、Zod 検証や `@sapphire2/env/server` のような専用パッケージは現状用意していない。Cloudflare の `wrangler secret put` で投入する運用に依存している。

## 落とし穴

- **OAuth callback URL の env 設定漏れ**: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` のいずれかが欠けると、`packages/auth/src/index.ts` の条件付きスプレッドにより該当 provider の設定自体が `socialProviders` に入らない。クライアントから `signIn.social({ provider: "google" })` を呼んでも "provider not configured" 系のエラーが返る。Cloudflare Workers の `wrangler.toml` / dashboard の secrets 側で必ず両方をセットすること。`BETTER_AUTH_URL`（OAuth provider 側に登録する callback の base）と本番ドメインの不一致もよくある落とし穴で、Google / Discord のコンソール側で `${BETTER_AUTH_URL}/api/auth/callback/google` が allowlist に入っていないと OAuth provider 側で弾かれる。
- **Account Linking の credential（email 重複）衝突**: Better Auth は `trustedProviders: ["google", "discord", "credential"]` を明示しているため、同じ email を持つ Google account と Discord account を同じ `user` 行にリンクできる。ただし、未認証の credential ログインと既存の OAuth ユーザーが同 email で衝突した場合の振る舞いは `accountLinking` の細部に依存する。リライト時は `emailVerified` フラグ（`packages/db/src/schema/auth.ts` の `user.emailVerified`）を OAuth provider 側がどう更新するかを再確認する必要がある（現状は OAuth provider 由来の email は verified 扱いされる）。
- **セッション cookie の SameSite / Secure 設定**: `advanced.defaultCookieAttributes` で `sameSite: "none"` / `secure: true` / `httpOnly: true` を固定している。`sameSite: "none"` を使う以上、`secure: true` が必須（ブラウザ仕様）であり、これは HTTPS 環境でしか cookie が機能しないことを意味する。ローカル開発時に `http://localhost` で API を叩くと cookie がセットされない症状はここに由来する。プレビュー環境では `BETTER_AUTH_URL` を HTTPS の Cloudflare URL に向け、`CORS_ORIGIN` と `trustedOrigins` を一致させる運用で回避している。
- **サーバ側 `BETTER_AUTH_SECRET` の漏洩リスク**: `BETTER_AUTH_SECRET` はセッション署名 / cookie 暗号化に使われる。Workers の secrets として保存し、`wrangler.toml` に直書きしない。`packages/auth/src/index.ts` は `options.secret` として受け取り、ファイル内部にデフォルト値は持たないため、未設定で起動した場合は Better Auth 側でエラーになる（fail loud）。リライト時にここを env から外す変更をしないこと。
- **`set-password` がカスタム handler に分かれている**: 通常の `/api/auth/*` ハンドラ（`app.on(["POST", "GET"], "/api/auth/*", …)`）と別に、`app.post("/api/auth/set-password", …)` を専用で生やしている。Hono のルーティングはより具体的なパスが優先されるためこの順序で動くが、`app.on` のマッチ範囲を変える場合は `set-password` 側を先に書く順序関係を壊さないこと。Better Auth クライアントの `$fetch("/set-password")` がこの専用 handler に着地する前提で動く。
- **`authClient.useSession()` を loading 表示に使っている**: `use-sign-in.ts` / `use-sign-up.ts` の `isPending` は `authClient.useSession()` 由来で、フォーム表示中はセッション解決中のスピナを出すために使っている。これは "セッションがまだ確定していない瞬間" の UX 対策だが、`__root.tsx` でセッション確認が済んでいる前提と二重チェックになっている。リライト時に整理する余地あり。
- **`PreviewAutoLogin` の secret 漏洩**: `VITE_PREVIEW_LOGIN_EMAIL` / `VITE_PREVIEW_LOGIN_PASSWORD` はクライアントバンドルに含まれる（`VITE_` プレフィックスの帰結）。プレビュー専用の throw-away アカウントを必ず使い、本番環境の env には絶対に同じ変数を入れないこと。`VITE_PREVIEW_AUTO_LOGIN !== "true"` のときは `usePreviewAutoLogin` が早期 return するため、本番ビルドで env を渡さなければ実害は出ないが、誤って渡せばクライアント側 JS から平文で読める。
- **`account` テーブルの `password` 列を NULL 許可で運用**: `packages/db/src/schema/auth.ts` の `account.password` は `text("password")`（NULL 可）。OAuth 経由で作成された account は NULL、credential 経由は ハッシュ文字列が入る。`verifyPassword` 内で `parts[1] ?? ""` で fallback しているが、`password` が NULL のレコードに対して `signIn.email` が呼ばれると `storedHash` が空文字で比較され必ず失敗するだけ（情報漏洩はしない）。Account Linking で credential を後付けする場合、Better Auth 側が同じ `userId` の既存 `account` 行を更新するのではなく新規 row を作る挙動の可能性があるため、リライト時に `account` row の生え方を実機確認すること。
- **`account` テーブルが email を持たない**: `packages/db/src/schema/auth.ts` の `account` は `accountId` / `providerId` / `userId` / `accessToken` / `refreshToken` / `idToken` / `password` を持つが、email カラムを持たない。email は `user.email` が唯一の真実で、`user.email` が unique 制約付き。複数 provider の email が異なるケース（Google アカウントは `foo@gmail.com`、Discord は `foo@example.com`）を 1 user にリンクする場合、`user.email` は最初にサインアップしたほうで固定される。
- **`verification` テーブルが現状ほぼ未使用**: `packages/db/src/schema/auth.ts` の `verification` テーブルは Better Auth がメール検証 / パスワードリセットなどで使う想定だが、現実装ではメール検証フローを実装していないため通常空のまま。リライトでメール検証や "Forgot Password" を入れる場合に活用する余地がある。
- **ハッシュフォーマットのバージョニング不在**: `<saltHex>:<hashHex>` の 2 区切り固定で、アルゴリズム識別子（`pbkdf2$sha256$100000$...` のようなプレフィックス）を持たない。将来 iterations 数を変える / アルゴリズムを変える場合に既存ハッシュとの互換性判定をやる手段がない。`verifyPassword` の `parts.length` 判定や先頭プレフィックス検査による段階的移行を入れる余地がある（リライト時の検討事項）。
- **`fetchOptions` 経由のコールバックと promise 戻り値の混在**: サインアウトは `authClient.signOut({ fetchOptions: { onSuccess: ... } })`、サインインは `authClient.signIn.email(payload, { onSuccess, onError })`、Account Linking は `result = await authClient.linkSocial(...)` の `result.error` を見る、と Better Auth 側 API の流儀が場面で揺れる。リライト時に独自 wrapper を 1 段噛ませて promise ベースに揃える余地がある。
- **`isPending` の二重チェックがフォーム入力を遮る**: `use-sign-in.ts` / `use-sign-up.ts` は `authClient.useSession()` の `isPending` を見て `<Loader />` を返す実装。ログインしていない `/login` ページでも初回ロード時に "セッション解決中" の状態が発生し、`SignInForm` 描画前に一瞬 Loader が出る。UX 上の害は小さいが、`/login` で `useSession` を引く設計が本来必要かは再検討の余地あり。
- **`unlinkAccount` のサーバ側ガード**: UI 側で `totalLinked > 1` ガードを入れているが、Better Auth 側にも最後の 1 つを外させないガードがある。両方に依存しているため、UI 側のガードだけを残してサーバ側を信頼するか、サーバ側に任せるかの選択をリライト時に決めること。現状はクライアント主体のガード + Better Auth のサーバ側保険の二段構え。
- **`use-linked-accounts.ts` が React builtin hook を直接呼んでいる**: `.claude/rules/web-hooks-separation.md` の STRICT ルールは「コンポーネントから builtin hook を直接呼ぶな」であり、custom hook 内（`use-*.ts`）では `useState` / `useEffect` / `useCallback` を呼んでよい。`use-linked-accounts.ts` も例に漏れず `useState` × 3、`useEffect` × 1、`useCallback` × 1 を hook 内に閉じ込めている。ただし `useCallback` の依存配列空でラップしている `fetchAccounts` は、現状他コンポーネントからも `onSuccess` 経由で呼ばれるため stable identity を求めるための妥当な使い方。リライト時に tRPC ベース（`trpc.auth.listAccounts.queryOptions()` のような）に寄せるなら、`useState` / `useEffect` での自前管理は不要になる。
- **`account.providerId` の文字列リテラルが UI 側に分散**: `LinkedAccounts` の `PROVIDERS` 定数で `"google"` / `"discord"` を、`hasCredential` 判定で `"credential"` を、`linkSocial` 引数の型キャストで `"google" | "discord"` を、それぞれ別の場所に書いている。Better Auth 側の providerId 文字列は型で守られておらず、provider を増減させる時にこれらをまとめて更新し漏れる潜在バグがある。`use-linked-accounts.ts` 内で `LINKABLE_PROVIDERS = ["google", "discord"] as const` を定義し全箇所で参照する形にする余地がある。

- **PWA + 永続化キャッシュとの相互作用**: `apps/web/src/main.tsx` の `PersistQueryClientProvider` がクエリ結果を IndexedDB に永続化している。`authClient.listAccounts()` の結果は tRPC ではなく Better Auth client が直接持つため、この永続化対象外であり、サインアウト直後にキャッシュが残る心配はない。一方、tRPC 側で `protectedProcedure` が返したデータはサインアウト後もキャッシュ DB に残るため、`signOut` 時に `queryClient.clear()` を呼ぶべきだが、現状 `Settings` の `Sign Out` ボタンはこれを呼んでいない。ユーザーが別アカウントで再ログインした際に前ユーザーのキャッシュが一瞬見える可能性がある（実害は小さいが、リライト時の検討事項）。

## 関連

本ドキュメントが扱った範囲のうち、別ファイル化されているもの：

- [`./01-page-shell.md`](./01-page-shell.md) — `AuthFormShell` / `PublicPageShell` を含むページ枠構造。
- [`./02-routing-and-page-hooks.md`](./02-routing-and-page-hooks.md) — `__root.tsx` の `beforeLoad` を含む layout route の認証ゲート設計。
- [`./04-shared-and-ui-primitives.md`](./04-shared-and-ui-primitives.md) — `Field` / `Input` / `Button` / `Separator` といった `AuthFormShell` 内で使う shadcn プリミティブ。
- [`.claude/rules/web-hooks-separation.md`](../../../.claude/rules/web-hooks-separation.md) — `SignInForm` / `SignUpForm` / `LinkedAccounts` がコンポーネントから `useForm` / `useState` を直接呼ばず、`use-sign-in.ts` / `use-sign-up.ts` / `use-linked-accounts.ts` に集約している根拠ルール。
- [`.claude/rules/web-forms.md`](../../../.claude/rules/web-forms.md) — `@tanstack/react-form` + `validators.onSubmit: zodSchema` 規約、`Field`/`Input` の利用法。サインインフォームはこの規約の reference implementation の一つ。
- [`CLAUDE.md`](../../../CLAUDE.md) — 全体方針。Better Auth / Cloudflare Workers / D1 採用根拠の上位ドキュメント。
