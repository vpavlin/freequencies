# 0006. A night's money is a KYM category in the crew's budget

- Status: proposed
- Date: 2026-10-10

## Context

ROADMAP step 2: "KYM: a budget per night, linked to the event id". KYM is a zero-based budget: a
budget (a household, or here a crew) has accounts, category groups and categories; money is assigned to
categories per month and spending is recorded against a category. Transactions have no memo or tag, and
income may only land in an asset account (KYM's invariant), never in a category.

## Decision (proposed)

1. **The crew keeps its own KYM budget** (not anyone's household budget), shared by its pairing code
   like any KYM budget.
2. **Each night that has money gets a category** in a "Nights" group, named `<YYYY-MM-DD> <night>`.
   "Plan money" in Frequencies creates it and assigns the planned amount in the night's month; the
   line-up's fee total (ADR 0004) is offered as the starting amount.
3. **The link is a Scala `ext` item** on the night:
   `{ns:"xyz.frequencies", kind:"budget", target:<event id>, id:"budget-<event id>",
     data:{budgetId, categoryId, category}}`.
4. **The night panel shows** assigned, spent and available for that category, read from KYM. Spending
   is recorded in KYM (or from Frequencies: "Record a cost" → KYM `spend` on that category).
5. **Revenue (door, bar) is not modelled per night** in v1: KYM records income only into accounts.
   A later option is one "Nights income" account per venue, or a per-night split once KYM has memos.

## Needs in KYM first

- **Budget-scoped calls.** KYM's core works on the *selected* budget (`selectBudget`), so Frequencies
  calling it would switch what the KYM app shows. Needed: `budgetJsonFor(budgetId)`,
  `addCategoryTo(budgetId, name, group)`, `assignIn(budgetId, category, month, amount)`,
  `spendIn(budgetId, amount, account, category)`, or a `budgetId` argument on the existing calls.
- **Android:** a kym-sdk (the logos-app-sdk recipe) so the Frequencies app can do the same.

## Open questions

- Is one category per night right, or one per *series* (a residency) with per-night spending?
- Who may see a night's money: everyone in the Scala calendar sees the link; only budget members
  (holders of the pairing code) can read the numbers. Is that the split we want?
