# Coromandel CPC | Purchase & Retailer Analytics Dashboard

A full-stack enterprise analytics and fraud/anomaly detection dashboard built for **Coromandel International Limited — Crop Protection Chemicals (CPC) Division**. Built with Next.js 14 (App Router), TypeScript strict mode, Tailwind CSS, and Recharts.

---

## Architecture & Data Ingestion

The dashboard reads directly from the committed CSV file on the server:
- Primary file location: `/data/orders.csv` (fallback: `report_data.csv`)
- **Zero stale caching**: Configured with `export const dynamic = 'force-dynamic'` and `cache: 'no-store'` so any manual daily commit or replacement of `/data/orders.csv` is immediately reflected without requiring server restarts or rebuilds.
- **Server-side streaming/sync parsing**: Ingests thousands of records in under 20ms using `csv-parse` on the server before rendering or streaming through the API.

---

## How to Update the CSV Daily

1. Simply overwrite the file at `/data/orders.csv` with the latest daily export from your database or ERP:
   ```bash
   cp /path/to/latest_export.csv ./data/orders.csv
   ```
2. Commit and push the updated CSV to your Git repository:
   ```bash
   git add data/orders.csv
   git commit -m "data: update daily orders feed for YYYY-MM-DD"
   git push
   ```
3. In the dashboard UI, click the **"Sync CSV"** button in the header (or refresh the browser). The updated records, KPIs, product sales volumes, and anomaly watchlists will immediately update.

---

## CSV Schema & Parsing Rules

The raw CSV schema expects 25 columns:

| Column | Type / Format | Parsing & Transformation Rule |
| :--- | :--- | :--- |
| `retailer_no` | String | Unique retailer identifier / phone number. |
| `retailer_name` | String | Commercial store or distributor name. |
| `retailer_location` | String | Store town or village. |
| `retailer_short_code`| String | Internal distribution shortcode. |
| `retailer_locale_code`| String | Locale / language code (e.g. `mr_IN`, `pa-IN`, `hi-IN`). |
| `retailer_district` | String | Retailer district. |
| `retailer_state` | String | Retailer state (e.g. Maharashtra, Punjab, Haryana). |
| `retailer_address` | String | Postal address of retailer. |
| `retailer_pin_code` | String | Postal PIN code. |
| `farmer_no` | String | Farmer contact number. |
| `farmer_name` | String | Registered farmer name. |
| `farmer_uuid` | UUID / String | Unique persistent farmer identifier. |
| `farmer_state` | String | Domicile state of farmer. |
| `farmer_district` | String | Domicile district of farmer. |
| `farmer_crop` | String | Comma-separated multi-crop string (e.g. `"grapes,tomato,fruits_vegetables"`). Literal `"NULL"` strings are parsed into an empty array `[]`. |
| `farmer_land` | Float / String | Land holding in acres. Literal `"NULL"` or `"0"` treated appropriately. |
| `address` | String | Farmer delivery / residential address. |
| `purchase_id` | String / Int | Unique purchase order ID. |
| `product1_name` | String | Multi-product string in the format `"<Product> <Pack Size> <Quantity>"`, comma-separated (e.g. `"Fantac Plus 1 ltr 1, Prachand 40 ml 4"`). Parsed into structured line items: `{ productName, packSize, quantity }`. Units handled include `ltr`, `ml`, `gm`, `kg`. |
| `is_approve_by_retailer` | Integer | `0` = Pending, `1` = Approved, `2` = Rejected. Mapped to typed `ApprovalStatus` enum with color-coded UI badges. |
| `retailer_approve_date`| Datetime | Timestamp when retailer took action. Used with `created_at` to compute `approval_latency_hours = retailer_approve_date - created_at`. |
| `no_product_purchase`| Integer | Total units purchased. |
| `wa_status` | String | WhatsApp notification delivery state (`read`, `delivered`, `sent`). |
| `coupon_code` | String | Comma-separated list of coupon voucher codes, split into an array. `"NULL"` values are treated as empty array. |
| `created_at` | Datetime | Order creation timestamp. |

## Data Transformation Rules

1. **Status mapping**: `is_approve_by_retailer` → `0` = Pending, `1` = Approved, `2` = Rejected. Mapped to typed `ApprovalStatus` enum with color-coded UI badges everywhere in the dashboard.

2. **Product parsing**: `product1_name` is a comma-separated list of purchased items. Each item follows the exact pattern:

   `<Product Name> <SKU Size> <Quantity>`

   Example: `"Fantac Plus 1 ltr 1, Prachand 40 ml 4"` means:

   | Product Name | SKU Size | Quantity |
   | :--- | :--- | :--- |
   | Fantac Plus | 1 ltr | 1 |
   | Prachand | 40 ml | 4 |

   That is: **Fantac Plus** is the product, **1 ltr** is the SKU/pack size, and **1** is the quantity ordered. Likewise **Prachand** is the product, **40 ml** is the SKU size, and **4** is the quantity ordered. The last number in each comma-separated segment is always the quantity; the token immediately before it (number + unit, e.g. `1 ltr`, `40 ml`, `200 gm`, `250 ml`) is the SKU size; everything before that is the product name (product names can contain multiple words, e.g. "Fantac Plus", "Blitz").

   **Parser logic:**
   - Split the full string on `,` to get each item segment.
   - For each segment, split on whitespace.
   - The last token = `quantity` (integer).
   - The two tokens before that = `skuSize` (number + unit, e.g. `"1 ltr"`, `"40 ml"`, `"800 gm"`).
   - All remaining tokens at the start = `productName` (join with spaces).

   This produces normalized line items like:
   ```json
   [
     { "productName": "Fantac Plus", "skuSize": "1 ltr", "quantity": 1 },
     { "productName": "Prachand", "skuSize": "40 ml", "quantity": 4 }
   ]
   ```

   **Handle units**: `ltr`, `ml`, `gm`, `kg` (extend as new units appear in the data). Tested with unit tests against real sample rows, including multi-product orders like:
   `"Blitz 80 gm 4, Marvex 150 ml 1, Benofit 200 gm 2, Prachand 40 ml 1, Fantac Plus 25 ml 2"` → 5 line items.

3. **Coupon codes**: `coupon_code` is a comma-separated list (or `NULL`), split into an array.
4. **Dates & Latency**: `created_at` and `retailer_approve_date` parsed as datetimes; derived `approval_latency_hours = retailer_approve_date - created_at`.
5. **Farmer/Retailer location mismatch flag**: derived boolean `location_mismatch = true` when farmer state/district differs from retailer state/district.
6. **Null handling**: `farmer_crop` parsed into an array; literal `"NULL"` treated as empty/unknown.

---

## Data Quality & Anomaly Watchlist Engine

A dedicated forensic rules engine continuously evaluates live order patterns:

1. **Multi-Retailer / Multi-State Velocity**:
   - Flags accounts where a single `farmer_uuid` places purchases through 3+ different retailers, or across 2+ distinct states in short timeframes.
2. **Zero-Approval Pattern**:
   - Identifies accounts with multiple purchase attempts where 100% of orders remain `Pending` or are `Rejected` by retailers, with 0 ever approved.
3. **Dummy / Test Account Fingerprint**:
   - Detects accounts with unregistered crops (`farmer_crop = NULL`) paired with unusually precise non-zero land figures (e.g. `0.4125` acres) or repeated synthetic signatures.
4. **Risk Scoring (0–100)**:
   - Aggregates weighted risk triggers into `Critical` (70+), `High` (50–69), and `Medium` (30–49) tiers.
   - Provides full click-through dossier inspection showing the complete order timeline across stores.

---

## Dashboard Pages & Features

1. **Overview**:
   - 6 KPI summary cards with percentage breakdowns and progress indicators.
   - Interactive Recharts time-series chart (stacked daily volume by status: Approved, Pending, Rejected) with 7D, 14D, 30D, and All-Time presets.
   - Top CPC products volume progress bars and retailer leaderboard snapshot.
   - High-priority anomaly alert banner.
2. **Orders Explorer**:
   - Full sortable, searchable, filterable data table.
   - Filters for status, state, crop, and location mismatch.
   - Expandable rows showing normalized product line items, pack sizes, quantities, and coupon codes.
   - One-click CSV export of filtered datasets.
3. **Products Analytics**:
   - Top products volume bar chart.
   - Detailed Product × Pack Size SKU matrix table with total units sold, order frequency, and average basket sizes.
4. **Retailer Performance**:
   - Retailer leaderboard with total orders, approval rates, average approval latency in hours, and rejections.
   - State-wise volume distribution chart.
5. **Farmer Network**:
   - Farmer directory with land holdings, crop tags, total orders, and approval ratios.
   - Interactive farmer dossier modal with complete order history and retailer touchpoints.
6. **Data Quality / Watchlist**:
   - Automated ranking of suspicious accounts.
   - Category filtering (Velocity, Zero Approvals, Dummy Accounts).
   - Forensic dossier modal with timeline auditing.

---

## Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
