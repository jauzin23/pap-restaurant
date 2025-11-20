# 💳 Payment System - Quick Summary

## What We're Building

A complete payment processing page that allows waitstaff to:

- Select tables and order items to pay
- Edit prices with reason tracking
- Apply discounts (preset or custom)
- Calculate change for cash payments
- Split bills multiple ways
- Process payments with multiple methods
- Generate receipts
- Track who processed each payment

---

## For Backend Developer: Priority Tasks

### 🔴 **CRITICAL - Build These First (Week 1)**

#### 1. Create Database Tables

Run these SQL scripts:

```sql
-- 1. Main payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(20) UNIQUE NOT NULL,
    table_ids UUID[] NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tip_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_methods JSONB NOT NULL,
    cash_received DECIMAL(10,2),
    change_given DECIMAL(10,2),
    processed_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Payment items table (links payments to order items)
CREATE TABLE payment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id),
    item_name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL,
    original_price DECIMAL(10,2) NOT NULL,
    adjusted_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    price_adjustment_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Update order_items table
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id);

-- 4. Create indexes
CREATE INDEX idx_payments_table_ids ON payments USING GIN(table_ids);
CREATE INDEX idx_payment_items_payment_id ON payment_items(payment_id);
CREATE INDEX idx_order_items_is_paid ON order_items(is_paid);
```

#### 2. Implement These 5 API Endpoints

**Endpoint 1: Calculate Payment**

```
POST /api/payments/calculate

Request: {
  "order_item_ids": ["uuid1", "uuid2"],
  "price_adjustments": [{
    "order_item_id": "uuid1",
    "new_price": 10.50
  }],
  "discount": {"type": "percentage", "value": 10},
  "tip_amount": 5.00
}

Response: {
  "subtotal": 45.00,
  "tax_amount": 4.50,
  "discount_amount": 4.95,
  "tip_amount": 5.00,
  "total_amount": 49.55
}
```

**Endpoint 2: Process Payment**

```
POST /api/payments

Request: {
  "table_ids": ["table-uuid"],
  "order_item_ids": ["uuid1", "uuid2"],
  "payment_methods": [
    {"method": "cash", "amount": 50.00}
  ],
  "cash_received": 50.00,
  "tip_amount": 5.00
}

Response: {
  "payment": {
    "id": "payment-uuid",
    "payment_number": "PAY-20251112-0001",
    "total_amount": 49.55,
    "change_given": 0.45
  }
}
```

**Endpoint 3: Get Unpaid Items for Table**

```
GET /api/payments/table/:table_id/unpaid

Response: {
  "table_id": "uuid",
  "table_number": 5,
  "unpaid_items": [
    {
      "id": "order-uuid",
      "item_name": "Burger",
      "price": 12.99,
      "status": "entregue"
    }
  ],
  "total": 45.00
}
```

**Endpoint 4: Get Payment Details**

```
GET /api/payments/:id

Response: {
  "payment": {...full payment details...},
  "items": [...payment items...],
  "processed_by_user": {
    "name": "Maria Silva",
    "profile_image": "image-id"
  }
}
```

**Endpoint 5: List Payments**

```
GET /api/payments?status=completed&date_from=2025-11-01

Response: {
  "payments": [...list of payments...],
  "total": 150
}
```

#### 3. Business Logic Functions

**Generate Payment Number:**

```javascript
// Format: PAY-YYYYMMDD-####
const generatePaymentNumber = async () => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await pool.query(
    `SELECT COUNT(*) FROM payments WHERE payment_number LIKE $1`,
    [`PAY-${today}-%`]
  );
  const sequence = String(parseInt(count.rows[0].count) + 1).padStart(4, "0");
  return `PAY-${today}-${sequence}`;
};
```

**Payment Processing (ATOMIC TRANSACTION):**

```javascript
const processPayment = async (paymentData, userId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Generate payment number
    const paymentNumber = await generatePaymentNumber();

    // 2. Calculate totals
    const subtotal = calculateSubtotal(paymentData.order_item_ids);
    const tax = subtotal * 0.10; // 10% tax
    const total = subtotal + tax + paymentData.tip_amount;
    const change = paymentData.cash_received ? paymentData.cash_received - total : 0;

    // 3. Create payment record
    const payment = await client.query(`
      INSERT INTO payments (
        payment_number, table_ids, subtotal, tax_amount,
        tip_amount, total_amount, payment_methods,
        cash_received, change_given, processed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      paymentNumber, paymentData.table_ids, subtotal, tax,
      paymentData.tip_amount, total, JSON.stringify(paymentData.payment_methods),
      paymentData.cash_received, change, userId
    ]);

    // 4. Create payment items
    for (const item of paymentData.items) {
      await client.query(`
        INSERT INTO payment_items (
          payment_id, order_item_id, item_name, quantity,
          original_price, adjusted_price, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [payment.rows[0].id, item.order_item_id, ...]);
    }

    // 5. Mark order items as paid
    await client.query(`
      UPDATE order_items
      SET is_paid = true, paid_at = NOW(), payment_id = $1
      WHERE id = ANY($2)
    `, [payment.rows[0].id, paymentData.order_item_ids]);

    // 6. Update order status to 'pago' if all items paid
    await client.query(`
      UPDATE order_items
      SET status = 'pago'
      WHERE table_id = ANY($1)
      AND NOT EXISTS (
        SELECT 1 FROM order_items
        WHERE table_id = ANY($1) AND is_paid = false
      )
    `, [paymentData.table_ids]);

    await client.query('COMMIT');

    // 7. Emit WebSocket event
    io.emit('payment:created', {
      payment_id: payment.rows[0].id,
      table_ids: paymentData.table_ids,
      total_amount: total
    });

    return payment.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

#### 4. WebSocket Events to Emit

```javascript
// When payment is processed
io.emit("payment:created", {
  payment_id: "uuid",
  payment_number: "PAY-20251112-0001",
  table_ids: ["table-uuid"],
  total_amount: 49.55,
  processed_by: { name: "Maria Silva" },
});

// When order items are paid
io.emit("order:paid", {
  order_item_ids: ["uuid1", "uuid2"],
  payment_id: "payment-uuid",
  table_ids: ["table-uuid"],
});
```

---

## 🟡 **MEDIUM PRIORITY - Build After MVP (Week 2)**

### Additional Endpoints

**1. Discount Presets**

```
GET /api/discounts/presets
POST /api/discounts/presets (manager only)
```

**2. Payment Refunds**

```
POST /api/payments/:id/refund (requires manager approval)
```

**3. Daily Reports**

```
GET /api/payments/reports/daily?date=2025-11-12
```

### Additional Tables

**payment_history** - Audit trail

```sql
CREATE TABLE payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    action VARCHAR(50) NOT NULL,
    performed_by UUID NOT NULL REFERENCES users(id),
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**discount_presets** - Pre-configured discounts

```sql
CREATE TABLE discount_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    discount_type VARCHAR(20) NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    requires_manager_approval BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE
);
```

---

## Validation Rules

### Payment Creation

✅ At least one order item must be selected
✅ All items must exist and be unpaid (`is_paid = false`)
✅ Total amount must be positive
✅ Payment methods must sum to total amount
✅ If cash payment: `cash_received >= total_amount`

### Price Adjustments

✅ Adjusted price must be > 0
✅ Must provide reason if price decreased
✅ Manager approval required if discount > 30%

### Refunds

✅ Payment must be "completed" status
✅ Must provide reason
✅ Requires manager authentication
✅ Cannot refund same payment twice

---

## Response Format Examples

### Always Include User Info

```javascript
// Example: Get payment with staff info
const payment = await pool.query(
  `
  SELECT 
    p.*,
    u.name as processed_by_name,
    u.profile_image as processed_by_image
  FROM payments p
  LEFT JOIN users u ON p.processed_by = u.id
  WHERE p.id = $1
`,
  [paymentId]
);

// Return formatted
return {
  ...payment.rows[0],
  processed_by_user: {
    name: payment.rows[0].processed_by_name,
    profile_image: payment.rows[0].processed_by_image,
  },
};
```

---

## Testing Checklist

### Test These Scenarios

- [ ] Create payment with single item
- [ ] Create payment with multiple items
- [ ] Create payment with price adjustment
- [ ] Create payment with discount
- [ ] Cash payment with correct change calculation
- [ ] Split payment (multiple methods)
- [ ] Get unpaid items for table
- [ ] List payments with filters
- [ ] WebSocket event emitted on payment
- [ ] Transaction rollback on error

---

## Common Calculations

### Tax Calculation

```javascript
const TAX_RATE = 0.1; // 10%
const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
```

### Discount Calculation

```javascript
// Percentage discount
const discount = Math.round(subtotal * (discountValue / 100) * 100) / 100;

// Fixed discount
const discount = discountValue;
```

### Change Breakdown

```javascript
const calculateChangeBreakdown = (changeAmount) => {
  const denominations = [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05];
  const breakdown = {};
  let remaining = Math.round(changeAmount * 100) / 100;

  for (const denom of denominations) {
    const count = Math.floor(remaining / denom);
    if (count > 0) {
      breakdown[denom] = count;
      remaining = Math.round((remaining - count * denom) * 100) / 100;
    }
  }

  return breakdown;
  // Example: {20: 1, 10: 1, 5: 1, 2: 1, 0.50: 1} = €37.50
};
```

---

## Questions to Ask Backend Dev

1. ✅ **Do you understand the table structure?**

   - payments (main), payment_items (links), order_items (updated)

2. ✅ **Can you implement the 5 priority endpoints by end of week?**

   - calculate, create payment, get unpaid, get payment, list payments

3. ✅ **Will you use transactions for payment processing?**

   - All payment operations must be atomic (BEGIN/COMMIT/ROLLBACK)

4. ✅ **Can you emit WebSocket events?**

   - payment:created, order:paid

5. ✅ **Do you need any clarification on calculations?**
   - Tax: subtotal \* 0.10
   - Total: subtotal + tax - discount + tip
   - Change: cash_received - total

---

## Quick Start Command

**Tell your backend dev:**

"Hey! I've created a complete plan for the payment system in `PAYMENT_PAGE_PLAN.md`.

**TL;DR - I need 3 database tables and 5 API endpoints:**

**Tables:**

1. `payments` - Main payment records
2. `payment_items` - Links payments to order items
3. Update `order_items` - Add `is_paid`, `paid_at`, `payment_id`

**Endpoints (Priority 1):**

1. POST /api/payments/calculate - Preview totals
2. POST /api/payments - Process payment
3. GET /api/payments/table/:id/unpaid - Get unpaid items
4. GET /api/payments/:id - Get payment details
5. GET /api/payments - List all payments

**Key requirement:** All payment operations must be atomic transactions (BEGIN/COMMIT).

Check `PAYMENT_SUMMARY.md` for quick reference, or `PAYMENT_PAGE_PLAN.md` for full details with schemas, examples, and business logic.

Let me know when Priority 1 is done so I can start building the frontend!"

---

## File References

- **Full Plan**: `PAYMENT_PAGE_PLAN.md` (80+ pages, comprehensive)
- **This Summary**: `PAYMENT_SUMMARY.md` (quick reference)
- **Similar Component**: `src/app/components/TableLayout.tsx` (study this for patterns)
- **API Client**: `src/lib/api.js` (add payment methods here)

---

**Next Steps:**

1. Backend dev reads this summary
2. Backend dev implements Priority 1 (5 endpoints + tables)
3. You test endpoints with Postman
4. You start building frontend components
5. Iterate and add Priority 2 features

Good luck! 🚀
