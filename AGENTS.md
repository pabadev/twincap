<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## MongoDB Connection Rule

Every server entry point that touches Mongoose **must** call `await connectDb()` from `@/infrastructure/db/connection` before using any repository or model. This includes:

- Server actions (`'use server'`)
- Route handlers (`app/**/route.ts`)
- Layouts and Pages that query the DB directly

Do **not** instantiate repositories at module level — create them inside the function after `connectDb()` has resolved. The connection singleton is cached globally (survives HMR) so repeated calls are cheap no-ops.

```ts
import { connectDb } from '@/infrastructure/db/connection';
import { MongoUserRepository } from '@/infrastructure/repositories/user-repository';

export async function myAction() {
  await connectDb();
  const userRepo = new MongoUserRepository();
  // ... use repo
}
```

Violating this pattern causes `buffering timed out after 10000ms` because Mongoose buffers commands when there is no active connection.
