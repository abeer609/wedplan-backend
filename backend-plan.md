# WedPlan — Backend Plan (Express + MongoDB + Better Auth + Stripe)

## 1. Key architecture decisions

| Decision | Choice | Why |
|---|---|---|
| Auth host | Better Auth runs **on the Express server** (`/api/auth/*`), MongoDB adapter | One owner of the `users` data; server can enforce roles/blocks |
| Cross-origin | Client (Next.js) **proxies `/api/*` to the server via `rewrites`** | Same-origin cookies → no CORS, no third-party cookie issues in production |
| JWT | Better Auth `jwt` plugin issues short-lived JWTs; Express verifies with `jose` against the JWKS endpoint | Satisfies the JWT-middleware requirement; rejects invalid/expired tokens (401) |
| Trust model | JWT only identifies the user. **Role, `isBlocked`, plan are always re-read from DB** per request | Never trust client or stale claims |
| Admin creation | Seed script (`npm run seed:admin`) using env creds. Sign-up hook forces `role ∈ {customer, vendor}`; `role`, `isBlocked`, `subscriptionPlan`, `subscriptionExpiresAt` are `input: false` | No public admin registration; profile updates can't escalate |
| Google signup | New Google users default to `customer`; one-time `PATCH /api/users/me/onboarding-role` (only while `roleSelected=false`) lets them pick vendor/customer | Google flow has no role field |
| Uploads | `POST /api/uploads` (auth required, multer memory, ≤2 MB, jpg/png/webp) → ImgBB, key stays server-side | Secret never reaches client. Sign-up image is uploaded *after* the account exists |
| Hosting | Render/Railway (long-running Node, needed for webhooks). Health route + uptime ping | Avoids cold-start 504s |

## 2. Folder structure

```
server/
  src/
    config/        env.js (zod-validated), db.js, auth.js (Better Auth), stripe.js
    middleware/    verifyJwt.js, requireRole.js, notBlocked.js, validate.js, errorHandler.js, notFound.js, rateLimit.js
    modules/
      services/    routes, controller, service, schema(zod)
      bookings/
      users/       (profile, admin user mgmt)
      subscriptions/ (checkout session, status)
      transactions/
      uploads/
      stats/       (role dashboards)
      webhooks/    stripe.webhook.js
    utils/         ApiError.js, asyncHandler.js
    scripts/       seedAdmin.js, createIndexes.js
  app.js  server.js
  .env.example  README.md  .gitignore (.env)
```

Middleware order: `helmet` → `cors(allowlist, credentials)` → **Stripe webhook route with `express.raw`** → `express.json` → Better Auth handler → routes → `notFound` → `errorHandler`.

## 3. Data model (3 business collections + Better Auth `user`)

**user** (Better Auth): `name, email, image, role, isBlocked(false), roleSelected, businessName?, subscriptionPlan('free'|'premium'), subscriptionExpiresAt?, stripeCustomerId?`

**services**: `vendorId(ref user), serviceName, category(enum of 6), description, price, location, images[], status('pending'|'approved'|'rejected'), isActive(bool, vendor availability toggle), createdAt, updatedAt`
- Public visibility = `status:'approved' AND isActive:true`
- Indexes: `{status,isActive,category,location}`, `{vendorId}`, text index on `serviceName`, `{price}`

**bookings**: `serviceId, vendorId, customerId, eventDate, eventLocation, message, status('pending'|'accepted'|'rejected'|'cancelled'), createdAt`
- Unique partial index `{serviceId, customerId, eventDate}` where `status ∈ {pending, accepted}` → duplicate-request protection enforced by the DB, not just code
- `vendorId` copied from the service on the server (never from the client)

**transactions**: `vendorId, plan, amount, currency, stripeSessionId(unique), stripeSubscriptionId, status('paid'|'failed'|'refunded'|'expired'), createdAt`
- No write endpoints for admin; written **only** by the webhook handler

## 4. API surface (`/api`)

| Area | Endpoint | Access |
|---|---|---|
| Auth | `/auth/*` (Better Auth: email, Google, session, token/JWKS) | public |
| Services (public) | `GET /services` — `search, category, location, sort=price_asc\|price_desc, page, limit`; `GET /services/featured`; `GET /categories` | public (approved+active only) |
| Service detail | `GET /services/:id` — 400 on bad ObjectId, 404 if missing/not public | JWT |
| Vendor services | `POST/GET /vendor/services`, `PATCH/DELETE /vendor/services/:id`, `PATCH …/:id/availability` | vendor + ownership |
| Bookings | `POST /bookings` (customer) · `GET /bookings/mine`, `PATCH /bookings/:id/cancel` (customer, owner) · `GET /vendor/bookings`, `PATCH /vendor/bookings/:id/{accept\|reject}` (vendor, owner) | role + ownership |
| Profile | `GET/PATCH /users/me` (whitelist: `name, image, businessName, phone`) | JWT |
| Subscription | `POST /subscriptions/checkout` (vendor, uses *session* user id only) · `GET /subscriptions/me` · `POST /subscriptions/portal` or cancel | vendor |
| Webhook | `POST /webhooks/stripe` (raw body, signature verified) | Stripe only |
| Admin | `GET /admin/users` (`search, role`), `GET /admin/users/:id`, `PATCH …/block` / `unblock` · `GET /admin/services`, `PATCH …/:id/{approve\|reject\|status}`, `DELETE …/:id` · `GET /admin/transactions` (read-only) · `GET /admin/stats` | admin |
| Stats | `GET /vendor/stats`, `GET /customer/stats` | role |
| Uploads | `POST /uploads` | JWT |

Admin cannot block other admins or self. Return **401** for missing/invalid/expired token, **403** for wrong role / blocked / non-owner, **404** for missing records, **409** for duplicates, **422** for validation errors.

## 5. Business rules (enforced server-side)

- **Free plan limit:** count the vendor's services where `status ≠ 'rejected' AND isActive = true`; if `plan='free'` and count ≥ 3 → 403 `UPGRADE_REQUIRED`. Re-check when toggling a service back to active.
- **Booking create:** service must be public; reject if `service.vendorId === customer id`; admins rejected by role middleware; unique index catches duplicates (map E11000 → 409); `eventDate` must be in the future.
- **State transitions are atomic:** `findOneAndUpdate({_id, vendorId: me, status:'pending'}, {status:'accepted'})` — a null result → 409 "already processed". Same for customer cancel.
- **Blocked users:** `notBlocked` middleware on every protected route; also reject at sign-in via Better Auth hook.
- **Edited service:** a vendor update of key fields resets `status` to `pending` (decision — state it in README).
- **Rejected services** never appear in public queries; vendors still see them with status.

## 6. Stripe flow (premium only after webhook)

1. `POST /subscriptions/checkout` → create Checkout Session (`mode: 'subscription'`, test Price ID from env, `client_reference_id = userId`, `metadata.vendorId`, success/cancel URLs on client).
2. Redirect → Stripe → `/payment/success?session_id=…`. **The success page only polls `GET /subscriptions/me`; it never activates anything.**
3. Webhook (`stripe.webhooks.constructEvent` with raw body + `STRIPE_WEBHOOK_SECRET`):
   - `checkout.session.completed` → upsert transaction (idempotent on `stripeSessionId`), set `subscriptionPlan='premium'`, `subscriptionExpiresAt = current_period_end`
   - `invoice.paid` → extend expiry · `invoice.payment_failed` → mark transaction failed
   - `customer.subscription.deleted` / `updated` → set plan back to `free` / update expiry
   - `checkout.session.expired` → mark expired
4. **Expiry safety net:** plan check helper treats `subscriptionExpiresAt < now` as free (also a daily cron/startup sweep to downgrade).
5. On downgrade, existing services stay but new/reactivated ones are blocked past the limit (document this).

## 7. Security & config checklist

- `.env` git-ignored; `.env.example` committed. Vars: `MONGODB_URI, BETTER_AUTH_SECRET, BETTER_AUTH_URL, CLIENT_URL, GOOGLE_CLIENT_ID/SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, IMGBB_API_KEY, ADMIN_EMAIL, ADMIN_PASSWORD`
- zod validation on every body/query; `express-mongo-sanitize`-style operator stripping; escape regex in search
- `helmet`, rate limit on auth/uploads, CORS allowlist from `CLIENT_URL` (credentials on)
- Central `errorHandler` returning `{ success:false, message, code }`; `notFound` for invalid routes
- Env validation fails fast on boot

## 8. Commit plan (≥ 12 meaningful commits)

1. `chore: initialize Express project, folder structure, eslint, .gitignore`
2. `feat: env validation and MongoDB connection with index script`
3. `feat: configure Better Auth (email/password, Google, role fields, hooks)`
4. `feat: add JWT verification, role, and blocked-user middleware`
5. `feat: global error handler, notFound, ApiError and validation helpers`
6. `feat: seed script for admin account`
7. `feat: public services API with search, category/location filter, price sort`
8. `feat: vendor service CRUD with ownership checks and free-plan limit`
9. `feat: image upload endpoint proxying to ImgBB`
10. `feat: booking creation with duplicate protection and self-booking guard`
11. `feat: vendor accept/reject and customer cancel with atomic transitions`
12. `feat: profile update endpoint with field whitelist`
13. `feat: Stripe checkout session endpoint for vendor premium upgrade`
14. `feat: Stripe webhook handler with signature verification and idempotent transactions`
15. `feat: subscription expiry/cancellation handling`
16. `feat: admin user management (search, filter, block/unblock)`
17. `feat: admin service moderation and read-only transactions`
18. `feat: role dashboard stats endpoints`
19. `docs: README, .env.example, deployment notes`

## 9. Build order & test checklist

Order: auth/JWT → services → uploads → bookings → Stripe → admin → stats → deploy **early** (by step 3) and redeploy continuously.

Test with: Stripe CLI (`stripe listen --forward-to …/api/webhooks/stripe`), plus manual checks — customer hitting `/vendor/*` → 403, blocked user → 403, expired JWT → 401, vendor editing another vendor's service → 403, double accept → 409, webhook with bad signature → 400, premium not granted without webhook.
