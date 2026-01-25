# Use Case Descriptions — Template Style (Plain Language)

Below, each use case follows your template fields (ID, Trigger, Description, Preconditions, Postconditions, Normal Flow, Alternative Flows, Exceptions, Priority, Frequency, Business Rules, Other Information, Assumptions) but keeps the wording simple for non‑technical readers.

---

## UC‑15: Favourites — Add/Remove
- UC ID and name: UC‑15 — Favourites: Add/Remove
- Created By: Team
- Date Created: 11/10/2025
- Primary Actor: Customer
- Secondary Actors: —

- Trigger: The shopper taps the heart icon on a product.
- Description: Save a product to the personal favourites list or remove it later.

- Preconditions:
  - PRE1: The shopper is signed in.
  - PRE2: The product is visible and allowed to be saved.

- Postconditions:
  - POST1: The favourites list is updated.
  - POST2: The heart icon and favourites counter show the new state.

- Normal Flow:
  1. The shopper presses the heart on a product.
  2. The system checks that the shopper is signed in.
  3. If the product is not saved, it is added; if it is already saved, it is removed.
  4. The heart appearance and the counter update immediately.
  5. A short confirmation message may appear.

- Alternative Flows:
  - AF1: The shopper is not signed in → show a friendly prompt to log in.
  - AF2: The product is no longer available → show a brief message that it cannot be saved.

- Exceptions:
  - E1: Temporary connection issue → show “Something went wrong, please try again.”

- Priority: High, Must.
- Frequency of Use: Frequent while browsing products.

- Business Rules:
  - Each account has its own favourites list.
  - Items that are not for sale should not be added.

- Other Information:
  1. Works on both product cards and the product page.
  2. The favourites count also shows near the heart icon in the header.

- Assumptions: The shopper knows that the heart icon represents favourites.

---

## UC‑17: Favourites — View
- UC ID and name: UC‑17 — Favourites: View
- Created By: Team
- Date Created: 11/10/2025
- Primary Actor: Customer
- Secondary Actors: —

- Trigger: The shopper opens their favourites from the header or menu.
- Description: Show a simple grid of saved products with easy actions.

- Preconditions:
  - PRE1: The shopper is signed in.

- Postconditions:
  - POST1: The favourites list appears with images, names and prices.
  - POST2: The shopper can remove items, open details or add to cart.

- Normal Flow:
  1. The shopper opens the Favourites page.
  2. The system loads the saved items.
  3. The page displays a clean grid of products.
  4. The shopper removes an item or goes to its product page if desired.
  5. The list updates right away after any change.

- Alternative Flows:
  - AF1: No saved items → show a friendly empty state and a link back to shop.

- Exceptions:
  - E1: Slow or failed loading → show a short message and allow retry.

- Priority: High.
- Frequency of Use: Medium to high.

- Business Rules:
  - Items that are no longer available should be hidden or clearly marked.

- Other Information:
  1. Keep the layout light so it loads fast, especially on mobile.
  2. Images should be clear and consistent in size.

- Assumptions: The shopper recognizes favourites as a personal list.

---

## UC‑30: Admin Dashboard — Overview
- UC ID and name: UC‑30 — View Admin Dashboard (Overview)
- Created By: Team
- Date Created: 11/10/2025
- Primary Actor: Admin
- Secondary Actors: —

- Trigger: The administrator opens the dashboard.
- Description: Provide a quick snapshot of store health: recent revenue, total orders, user counts, and a simple status breakdown.

- Preconditions:
  - PRE1: The administrator is signed in with the right permissions.

- Postconditions:
  - POST1: Key numbers and a small breakdown table are visible.

- Normal Flow:
  1. The administrator opens the dashboard.
  2. The system summarises recent revenue, orders and users.
  3. The page shows clear metric cards for the key numbers.
  4. A small table shows how many orders are in each status.
  5. The administrator can open detailed views for deeper analysis.

- Alternative Flows:
  - AF1: There is no activity yet → show zeros and a helpful empty state.

- Exceptions:
  - E1: Data fails to load → show a clear error and a way to try again.

- Priority: High.
- Frequency of Use: Daily.

- Business Rules:
  - Revenue should not include failed or refunded payments.
  - Status names are consistent across all dashboard sections.

- Other Information:
  1. Numbers should use proper currency and thousands separators.
  2. A “recent orders” snippet may show the latest purchases.

- Assumptions: The admin understands basic dashboard cards and tables.

---

## UC‑32: Admin — User List
- UC ID and name: UC‑32 — User: List
- Created By: Team
- Date Created: 11/10/2025
- Primary Actor: Admin
- Secondary Actors: —

- Trigger: The administrator opens the Users area in the dashboard.
- Description: Browse accounts with search, role/status filters and simple paging.

- Preconditions:
  - PRE1: The administrator is signed in and allowed to manage users.
  - PRE2: The system can read user data.

- Postconditions:
  - POST1: A table of accounts is displayed with basic details.
  - POST2: Filters and search refine the list smoothly.

- Normal Flow:
  1. The administrator opens the Users section.
  2. The system loads accounts.
  3. The page shows a table with Name, Email, Role, Status, Joined date and Actions.
  4. The administrator searches by name/email/phone and filters by role/status.
  5. The administrator moves through pages using Previous/Next.

- Alternative Flows:
  - AF1: No accounts match the filters → show “No matching users found”.
  - AF2: The administrator resets filters to see all accounts again.

- Exceptions:
  - E1: The list cannot be loaded → show “Unable to load users, please try again later.”

- Priority: High, Must.
- Frequency of Use: Frequent for administrators.

- Business Rules:
  - Only administrators can access this area.
  - Large results are split into pages for speed and clarity.

- Other Information:
  1. By default, newer accounts can appear first.
  2. Page size remains moderate to avoid long scrolls.

- Assumptions: The admin knows how to use table filters.

---

## c
- UC ID and name: UC‑33 — User: Detail
- Created By: Team
- Date Created: 11/10/2025
- Primary Actor: Admin
- Secondary Actors: —

- Trigger: The administrator chooses “View detail” for a person in the list.
- Description: Show profile information and recent purchasing activity for that person.

- Preconditions:
  - PRE1: The administrator is signed in and allowed to manage users.
  - PRE2: The selected account exists.

- Postconditions:
  - POST1: Profile details and simple stats are visible.
  - POST2: Recent orders (if any) are listed.

- Normal Flow:
  1. The administrator opens the person’s detail.
  2. The system loads the profile summary and simple purchase stats.
  3. The page shows name, email, role, status and other basics.
  4. A small section shows total orders, total spent and the time of the latest order.
  5. A short list of recent orders appears.

- Alternative Flows:
  - AF1: The person has not placed any orders → show a friendly empty state.

- Exceptions:
  - E1: Details fail to load → show a short error and allow retry.

- Priority: High.
- Frequency of Use: Regular when investigating accounts.

- Business Rules:
  - Only administrators can view these details.

- Other Information:
  1. Money values use the shop’s currency and formatting.

- Assumptions: The data shown is up‑to‑date and accurate.

---

## UC‑34: Admin — Block/Unblock User
- UC ID and name: UC‑34 — User: Block/Unblock
- Created By: Team
- Date Created: 11/10/2025
- Primary Actor: Admin
- Secondary Actors: —

- Trigger: The administrator clicks “Lock” or “Unlock” for an account.
- Description: Stop someone from signing in, or restore their access.

- Preconditions:
  - PRE1: The administrator is signed in and allowed to manage users.
  - PRE2: The account is not the administrator’s own account.

- Postconditions:
  - POST1: The account’s status changes and is saved.
  - POST2: The page shows the new status and a confirmation message.

- Normal Flow:
  1. The administrator chooses Lock or Unlock.
  2. The system confirms and performs the change.
  3. The page updates the status badge and the button label.
  4. A short success message appears.

- Alternative Flows:
  - AF1: The administrator tries to lock their own account → show a clear message and do nothing.
  - AF2: The administrator cancels the action → no change.

- Exceptions:
  - E1: The change cannot be saved because of a temporary issue → show “Could not update status, please try again.”

- Priority: High.
- Frequency of Use: Moderate.

- Business Rules:
  - Only administrators can lock or unlock accounts.
  - Locked users cannot sign in until they are unlocked.

- Other Information:
  1. While the change is happening, the button can be disabled or show a spinner.

- Assumptions: Administrators understand the impact of locking an account.

