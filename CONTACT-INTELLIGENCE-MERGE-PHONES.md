# Contact Intelligence - Merge Phones (Google Places + Receita Federal)

## Overview

The Contact Intelligence system cross-references phone numbers from two sources:
- **Google Places** (direct from business listing): usually the actual business phone
- **Receita Federal** (Brazilian federal revenue database): often the accountant's phone

This document explains how they are merged and which is recommended.

---

## Source Priority & Scoring

| Source | Base Score | Description |
|--------|-----------|-------------|
| **MANUAL** | 90 | Manually entered by user (highest priority) |
| **WEBSITE_SCRAPER** | 80 | Extracted from business website |
| **GOOGLE** | 70 | Google Places official listing |
| **WEB_SEARCH** | 60 | Found via web search/scraping |
| **RECEITA** | 55 | Brazilian Receita Federal database |

### Why Google > Receita?

1. **Receita** phone is often the **accountant** (contador) — a support contact, not direct business
2. **Google** phone is the **primary business contact** — what customers use
3. Score difference (70 vs 55) ensures Google is recommended when both exist

---

## Merge Flow

### Frontend (`mergeResults()` in searchService.ts)

When search results come back from both RF and Google:

1. **Index RF results by normalized company name**
2. **Process Google results first**:
   - If name matches an RF entry → **MERGE**:
     - Keep Google phone (actual business contact)
     - Keep Google website (if available)
     - Enrich with RF CNPJ, legal name, and company size
   - If no RF match → Keep Google result as-is
3. **Add RF-only results** (not found in Google)

**Result**: Same company appears once, with both data sources merged.

### Backend (`syncLeadContacts()` in db-sync.ts)

When syncing a lead:

1. **Extract Google phone** from Places API → store as `LeadContact` with:
   - `source: 'GOOGLE'`
   - `confidenceScore: 70`
   - `isPrimary: true`

2. **Extract RF phone** (from `rfCompany.ddd + telefone`) → store as `LeadContact` with:
   - `source: 'RECEITA'`
   - `confidenceScore: 55`
   - `isPrimary: true` **only if** no Google phone exists

3. **Both stored** in the database — Contact Intelligence compares them at query time.

---

## Contact Intelligence Recommendation

### Query Behavior

When you call the Contact Intelligence API:

```
GET /api/leads/{id}/contact-intelligence
```

The system:

1. **Fetches all LeadContact records** for this lead
2. **Computes effective score** for each phone:
   - Base score (70 for Google, 55 for Receita)
   - Adjustments:
     - `-20` if contains accountant pattern (e.g., "contabil", "fiscal", "escritório")
     - `-35` if phone shared with 5+ other companies
     - `-15` if phone shared with 2-4 companies
     - `+10` if phone appears in multiple sources
     - `+5` if marked as primary by user
3. **Picks best by effective score**
4. **Returns recommended phone + alternatives**

### Example: Cafe Central

**RF Database**: 
- Phone: `11 3333-4444` (Contador João)
- Score: 55

**Google Places**:
- Phone: `11 9876-5432` (Direct business)
- Score: 70

**Result**: `11 9876-5432` recommended ✓

---

## Data Flow Diagram

```
Google Places API
    ↓
    ├─→ Extract: nationalPhoneNumber (11987654321)
    ├─→ Store in Lead.phone (quick access)
    └─→ Store in LeadContact (source=GOOGLE, score=70)
           ↓
           ├─→ Keep as isPrimary=true
           └─→ Contact Intelligence uses this for recommendation

Receita Federal (RF) Database
    ↓
    ├─→ Fuzzy match by name+address OR detect CNPJ
    ├─→ Extract: ddd (11) + telefone (33334444)
    ├─→ Build: 1133334444
    └─→ Store in LeadContact (source=RECEITA, score=55)
           ↓
           ├─→ Set isPrimary=false (if Google exists)
           └─→ Available as alternative in Contact Intelligence

Frontend Search Results Merge
    ↓
    mergeResults(rfPlaces, googlePlaces)
    ├─→ Match by company name
    ├─→ Prefer Google phone in UI
    └─→ Display: 11 9876-5432 (direct, not accountant)
```

---

## Testing

Run the test suite:

```bash
npm run test -- backend/src/__tests__/merge-phone-sources.test.ts
```

**Coverage**:
- ✅ Frontend merge: keeps Google phone, enriches with RF data
- ✅ Backend sync: stores both phone sources, Google as primary
- ✅ Scoring: Google beats Receita by default
- ✅ Edge cases: handles null/missing phones, duplicate names

---

## Common Scenarios

### Scenario 1: Business has both Google presence and RF entry

```
Input:
  Google: "11 9876-5432" (business owner)
  Receita: "11 3333-4444" (accountant)

Output:
  Recommended: "11 9876-5432" ✓
  Alternative: "11 3333-4444"
```

### Scenario 2: Only Receita phone available

```
Input:
  Google: null
  Receita: "11 3333-4444"

Output:
  Recommended: "11 3333-4444" ✓
  (Receita becomes primary because no Google)
```

### Scenario 3: Shared accountant phone (fraud signal)

```
Input:
  Google: "11 9876-5432" (unique)
  Receita: "11 1111-1111" (shared with 12 companies)

Processing:
  - Google: score 70 (unique)
  - Receita: score 55 - 35 = 20 (shared with 5+)

Output:
  Recommended: "11 9876-5432" ✓
```

---

## Future Improvements

1. **Manual override**: Allow users to mark a phone as "definitely correct"
2. **Validation**: Cross-check phone format consistency (country code, length)
3. **WhatsApp validation**: Attempt WhatsApp API ping to verify active number
4. **Historical recency**: Boost score if phone was recently verified/used
5. **Competitor detection**: Reduce score if phone appears in competitor database

---

## References

- [contact-intelligence.ts](../lib/contact-intelligence.ts) — Scoring algorithm
- [db-sync.ts](../lib/db-sync.ts) — Google + Receita extraction & sync
- [rf-fuzzy-match.ts](../lib/rf-fuzzy-match.ts) — Receita full-text search
- [searchService.ts](../../frontend/src/lib/searchService.ts) — Frontend merge logic
