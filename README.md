# WedPlan Server

Express + MongoDB (Mongoose, Atlas-ready) + Stripe backend for WedPlan.
Authentication is owned by the frontend (Better Auth). This server is a **JWT resource server**:

- Frontend sends `Authorization: Bearer <jwt>` (Better Auth jwt plugin `/api/auth/token` or `set-auth-jwt` header).
- Server verifies the JWT with `jose` against the Better Auth JWKS (`BETTER_AUTH_JWKS_URL` or `<BETTER_AUTH_URL>/api/auth/jwks`), with HS256 fallback using `BETTER_AUTH_SECRET`.
- Role, `isBlocked`, and plan are always re-read from MongoDB per request. JWT only identifies the user.

## Setup

```bash
npm install
cp .env.example .env   # fill in values (MongoDB Atlas URI, secrets)
npm run create:indexes
npm run dev            # or: npm start
```

## Env vars

| Var | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas (or local) connection string |
| `PORT` | default `8000` |
| `BETTER_AUTH_SECRET` | shared secret (HS256 fallback + encryption compat) |
| `BETTER_AUTH_URL` | frontend/auth base URL, e.g. `http://localhost:3000` |
| `BETTER_AUTH_JWKS_URL` | optional override for the JWKS endpoint |
| `CLIENT_URL` | frontend URL for CORS + Stripe redirect URLs |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | webhook signing secret |
| `STRIPE_PRICE_ID` | premium subscription price id |
| `FREEIMAGE_API_KEY` | freeimage.host API key |
| `ADMIN_EMAIL` | seed admin email (`npm run seed:admin`) |

## API (`/api`)

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Services (public) | `GET /services`, `GET /services/featured`, `GET /categories` |
| Service detail | `GET /services/:id` (JWT; private services visible to owner/admin only) |
| Vendor | `POST/GET /vendor/services`, `PATCH/DELETE /vendor/services/:id`, `PATCH /vendor/services/:id/availability` |
| Bookings | `POST /bookings`, `GET /bookings/mine`, `PATCH /bookings/:id/cancel`, `GET /vendor/bookings`, `PATCH /vendor/bookings/:id/accept\|reject` |
| Profile | `GET/PATCH /users/me` (whitelist: `name, image, businessName, phone`), `PATCH /users/me/onboarding-role` (one-time) |
| Subscriptions | `POST /subscriptions/checkout`, `GET /subscriptions/me`, `POST /subscriptions/portal` |
| Webhooks | `POST /webhooks/stripe` (raw body, signature verified) |
| Admin | `GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/block\|unblock`, `GET /admin/services`, `PATCH /admin/services/:id/approve\|reject\|status`, `DELETE /admin/services/:id`, `GET /admin/transactions`, `GET /admin/stats` |
| Stats | `GET /vendor/stats`, `GET /customer/stats` |
| Uploads | `POST /uploads` (multipart `image`, ≤2MB, jpg/png/webp → freeimage.host) |

Status codes: **401** bad/missing/expired token, **403** wrong role / blocked / non-owner, **404** missing records, **409** duplicates/already-processed, **422** validation errors.

## Business rules

- Public visibility = `status: 'approved'` AND `isActive: true`. Rejected services never appear in public queries; vendors still see their own.
- **Free plan limit:** vendors on `free` may have at most 3 services with `status != 'rejected'` AND `isActive: true`. Counts are checked on create and on re-activation → 403 `UPGRADE_REQUIRED`.
- **Booking:** service must be public; no self-booking; `eventDate` must be future; unique partial index on `(serviceId, customerId, eventDate)` for pending/accepted → E11000 mapped to 409.
- **Transitions are atomic:** `findOneAndUpdate({_id, owner, status:'pending'})`; null result → 409 `ALREADY_PROCESSED`.
- **Blocked users** are rejected on every protected route (`notBlocked`); sign-in blocking lives on the frontend auth config.
- Vendor edits to key fields (`serviceName, category, description, price, location`) reset `status` to `pending` (re-moderation).
- Admins cannot block themselves or other admins.

## Stripe (one-time premium payment, webhook-activated)

1. `POST /subscriptions/checkout` creates a Checkout Session (`mode: 'payment'`, `client_reference_id = userId`).
2. Redirect → Stripe → `/payment/success?session_id=…`. The success page **only polls `GET /subscriptions/me`**; it never activates anything locally.
3. Webhook (`checkout.session.completed` with `payment_status=paid`, `mode=payment`) upserts the transaction idempotently on `stripeSessionId` and sets `subscriptionPlan='premium'` permanently. Delayed methods resolve via `checkout.session.async_payment_succeeded/failed`; abandoned sessions → `expired`; refunds via `charge.refunded`.
4. Premium never expires — no renewals, no downgrade sweep, no subscription events.

Test locally with the Stripe CLI:

```bash
stripe listen --forward-to localhost:8000/api/webhooks/stripe
```

## Deploy

- Use a long-running host (Render/Railway). Set all env vars, add the Stripe webhook URL (`https://<host>/api/webhooks/stripe`), and use `/health` + an uptime ping to avoid cold starts.
