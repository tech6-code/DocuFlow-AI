# Troubleshooting: Data Not Saving

## Quick Checklist

Run through these checks to find why data isn't saving:

### ☐ 1. Database Tables Created?

Run this in Supabase SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'ct_filing%';
```

**Expected Result:** Should show 4 tables
- `ct_filing_typetwo`
- `ct_filing_step_balances`
- `ct_filing_transactions`
- `ct_filing_step_data`

**If tables don't exist:**
1. Run `server/src/database/drop_tables.sql` (clean slate)
2. Then run `server/src/database/ctfillingtype_schema.sql` (create tables)

---

### ☐ 2. Backend Server Running?

Check if your server is running:
```bash
# In server directory
npm run dev
```

Server should start on: `http://localhost:5000`

**Check server logs for:**
- ✅ "Server running on port 5000"
- ✅ Routes registered successfully
- ❌ Any errors or warnings

---

### ☐ 3. Routes Registered?

Check `server/src/index.ts` has this line:
```typescript
app.use("/api/ct-filing-typetwo", ctFilingSessionsRoutes);
```

And this import at the top:
```typescript
import ctFilingSessionsRoutes from "./routes/ctFilingSessions";
```

---

### ☐ 4. Test API Manually

Use curl or Postman to test if API works:

```bash
# Test: Create a session
curl -X POST http://localhost:5000/api/ct-filing-typetwo/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "test-company-123",
    "customerId": "test-customer-456", 
    "filingPeriodId": "test-period-789"
  }'
```

**Expected:** Should return JSON with session data including an `id`

**If you get 404:**
- Server not running
- Routes not registered correctly

**If you get 500:**
- Database tables don't exist
- Column names mismatch

---

### ☐ 5. Check Database Column Names

Run this to see actual column names:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'ct_filing_step_balances';
```

**Expected columns:**
- `id`
- `ct_type_id` (NOT ct_filing_typetwo_id)
- `step_number`
- `opening_balance`
- etc.

**If you see `ct_filing_typetwo_id` instead of `ct_type_id`:**
Run the migration: `server/src/database/migrate_column_rename.sql`

---

### ☐ 6. Frontend Environment Variables

Check `client/.env` has:
```
VITE_API_URL=http://localhost:5000/api
```

---

### ☐ 7. Browser Console Errors

Open browser DevTools (F12) → Console tab

**Look for:**
- ❌ Network errors (failed API calls)
- ❌ CORS errors
- ❌ 404 not found errors

**Network tab should show:**
- `POST /api/ct-filing-typetwo/sessions` → Status 200 or 201
- Response body contains `id` field

---

### ☐ 8. Verify Data Actually Saved

After making a test API call, check database:
```sql
SELECT * FROM ct_filing_typetwo ORDER BY created_at DESC LIMIT 5;
```

Should show your test data.

---

## Common Issues & Fixes

### Issue 1: "column ct_type_id does not exist"
**Fix:** Column names don't match
```sql
-- Check what columns actually exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'ct_filing_transactions';

-- If shows ct_filing_typetwo_id, run migration:
-- server/src/database/migrate_column_rename.sql
```

### Issue 2: "404 Not Found" on API calls
**Fix:** Routes not registered or server not running
- Restart server: `npm run dev` in server directory
- Check `server/src/index.ts` has route registration

### Issue 3: CORS errors in browser
**Fix:** Add CORS configuration in `server/src/index.ts`:
```typescript
app.use(cors({
  origin: 'http://localhost:5173', // Vite default
  credentials: true
}));
```

### Issue 4: Data saves but frontend doesn't show it
**Fix:** Frontend not calling the service
- Check if `ctFilingSessionService` is imported
- Check if functions are actually called
- Add console.logs to verify

---

## Step-by-Step Test

Run this complete test:

### 1. Start Backend
```bash
cd server
npm run dev
```

### 2. Test API with curl
```bash
curl -X POST http://localhost:5000/api/ct-filing-typetwo/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "test-123",
    "customerId": "test-456",
    "filingPeriodId": "test-789"
  }'
```

### 3. Check Database
```sql
SELECT * FROM ct_filing_typetwo;
```

**If this works:** Backend is fine, issue is in frontend integration

**If this fails:** Check error message and fix backend/database

---

## Quick Test Script

Save this as `test-api.js` and run with `node test-api.js`:

```javascript
const API_BASE = 'http://localhost:5000/api';

async function testAPI() {
  try {
    // Test 1: Create session
    console.log('Testing: Create Session...');
    const response = await fetch(`${API_BASE}/ct-filing-typetwo/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 'test-company',
        customerId: 'test-customer',
        filingPeriodId: 'test-period'
      })
    });
    
    if (!response.ok) {
      console.error('❌ Failed:', response.status, await response.text());
      return;
    }
    
    const session = await response.json();
    console.log('✅ Session created:', session.id);
    
    // Test 2: Save balances
    console.log('Testing: Save Balances...');
    const balanceResponse = await fetch(
      `${API_BASE}/ct-filing-typetwo/sessions/${session.id}/balances`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepNumber: 1,
          stepName: 'Test Step',
          openingBalance: 100.00,
          closingBalance: 200.00,
          totalCount: 10
        })
      }
    );
    
    if (!balanceResponse.ok) {
      console.error('❌ Failed:', balanceResponse.status, await balanceResponse.text());
      return;
    }
    
    console.log('✅ Balances saved');
    console.log('✅ All tests passed! Data is saving correctly.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();
```

---

## What to Do Next

1. **Run through the checklist above** ☑️
2. **Find which step fails** 🔍
3. **Apply the fix** 🔧
4. **Test again** ✅

Share the error message you get, and I'll help you fix it!
