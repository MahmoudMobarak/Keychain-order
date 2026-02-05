# Keychain Order Website

GitHub Pages + Supabase + EmailJS website for ordering customizable keychains.

## Files
- `index.html` - product + order page (single-page with two sections)
- `script.js` - order flow, promo, uploads, DB insert, receipt modal + PDF, EmailJS
- `admin.html` - admin login + orders dashboard
- `admin.js` - admin auth + list orders + download files
- `admin-config.example.js` - example for admin password hash

## Setup
1. **Supabase tables**
   - `orders` with columns: `id`, `created_at`, `customer_email`, `phone`, `items` (jsonb), `promo_code`, `discount_amount`, `total_price_aed`, `front_photo_path`, `back_photo_path`
   - `promo_codes` with columns: `code`, `description`, `discount_type` (`percent` or `fixed`), `discount_value`, `active`
2. **Supabase storage bucket**
   - Bucket name: `order-photos`
3. **Set admin password hash**
   - Copy `admin-config.example.js` to `admin-config.js`
   - Put your hash in `window.ADMIN_PASSWORD_HASH`
4. **EmailJS templates**
   - Keep public key/service/template IDs in `script.js` synced with your EmailJS dashboard
5. **Deploy**
   - Push repo to GitHub and enable GitHub Pages (root)

## Important note
Because this is a static GitHub Pages site, admin password validation is still client-side and not secure for production. For real security use Supabase Auth or a backend.
