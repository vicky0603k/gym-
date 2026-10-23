# Assets — Gym Retention PWA

Every non-code asset the project needs, who provides it, and the required format. Collect the "Blocking" items before the pilot launch; development can start with placeholders.

## Blocking — needed for a real launch

| Asset | Format / size | Provided by | Used in |
|---|---|---|---|
| Gym logo (dark-background version) | SVG preferred, or PNG with transparency, min 512×512 | Gym owner | Landing page, app header, receipts |
| Gym logo (light version, if it exists) | Same as above | Gym owner | Documents/receipts on white |
| App icon source | Square PNG, 1024×1024, no rounded corners, no text smaller than the main mark | Gym owner / Vikas | Generated into 192, 512 and maskable PWA icons (`public/icons/`) |
| Gym photos | JPG, min 1600px wide: entrance, workout floor, cardio area, one class/training shot (4–8 photos) | Gym owner (phone photos are acceptable) | Landing page hero and gallery |
| Trainer photos + names + specialisation | Square JPG, min 800×800, with each trainer's consent to publish | Gym owner / trainers | Landing page, add-on cards |
| Gym details (text) | Name, address, Google Maps link, phone/WhatsApp, opening hours, holiday notes | Gym owner | Landing page, settings seed |
| Plans and prices (text) | Final written list: plan name, duration, price, discount, benefits, freeze rules | Gym owner, confirmed in writing | `plans` table, landing page |

## Needed during the pilot

| Asset | Format | Notes |
|---|---|---|
| QR display standee / desk screen | A tablet or spare phone at the gate running the QR display page | Never a printed static check-in QR (see `SECURITY.md`). A printed QR that only opens the website URL is allowed for promotion. |
| UPI payment QR of the gym | PNG/JPG as the gym already uses | Shown on the renewal payment-instruction screen in the manual MVP flow |
| Supplement product photos | JPG, one per product, plain background preferred | Add-on cards; price and stock come from `addons`, not the photo |
| Diet/PT programme one-pagers (text) | Short bullet text: inclusions, exclusions, terms | Add-on detail sheets — no medical or transformation claims (see `PRD.md` rules) |

## Placeholders used during development

Until real assets arrive, development uses:
- A simple text-based placeholder logo ("GYM" monogram generated from the accent colour).
- Stock-free placeholder blocks (solid themed panels with the section name) instead of photos — never hotlink random internet images into the product.
- Seed trainer names/photos are initials avatars only (no real faces in seed data).

## Naming and storage

- Files: lowercase, hyphens, descriptive — `trainer-rahul-sharma.jpg`, `gym-floor-01.jpg`.
- Originals are kept in `docs/raw-assets/` (not deployed); optimised versions used by the app live in `public/images/` and `public/icons/`.
- Member photos are **not** collected in the MVP — member avatars are initials. (If photos are added later, consent and storage rules must be added to `SECURITY.md` first.)
