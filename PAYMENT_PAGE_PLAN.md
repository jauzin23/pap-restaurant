# 💳 Payment Page - Complete Implementation Plan

## 📋 Overview

This document provides a comprehensive plan for implementing a professional payment processing page for the restaurant management system. The payment page will handle bill splitting, price adjustments, change calculations, payment method selection, and full documentation of who processed each payment.

---

## 🎯 Features Required

### Core Features

1. **Table/Order Selection** - Select which tables and orders to process payment for
2. **Item Selection** - Choose specific items from orders to pay (partial or full)
3. **Price Editing** - Adjust individual item prices (discounts, corrections)
4. **Payment Calculator** - Built-in calculator for change calculation
5. **Payment Methods** - Cash, Card, MB Way, Split payment
6. **Change Calculation** - Real-time calculation with multiple denominations
7. **Staff Tracking** - Document who processed the payment
8. **Receipt Generation** - Print/download receipt after payment
9. **Payment History** - View all payment transactions

### Advanced Features

1. **Split Bill** - Divide bill among multiple customers
2. **Tip Management** - Add tips before payment
3. **Discount Application** - Apply percentage or fixed discounts
4. **Multi-Payment** - Process same bill with multiple payment methods
5. **Payment Undo** - Reverse incorrect payments (with manager approval)

---

## 🗄️ Database Design

### New Tables Required

#### 1. **payments** (Main payment records)

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Payment identification
    payment_number VARCHAR(20) UNIQUE NOT NULL, -- Format: PAY-20251112-0001

    -- Table reference (which table(s) were paid)
    table_ids UUID[] NOT NULL, -- Array of table IDs (supports merged tables)

    -- Financial totals (calculated from payment_items)
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tip_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL, -- Final amount paid

    -- Payment method breakdown
    payment_methods JSONB NOT NULL, -- [{"method": "cash", "amount": 50.00}, {"method": "card", "amount": 30.00}]

    -- Change given (for cash payments)
    cash_received DECIMAL(10,2) DEFAULT NULL,
    change_given DECIMAL(10,2) DEFAULT NULL,

    -- Staff tracking
    processed_by UUID NOT NULL REFERENCES users(id), -- Waiter who processed payment
    approved_by UUID REFERENCES users(id), -- Manager approval (for discounts/refunds)

    -- Status and workflow
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN (
        'completed',  -- Payment successfully processed
        'partial',    -- Partial payment (waiting for rest)
        'refunded',   -- Payment refunded
        'cancelled'   -- Payment cancelled
    )),

    -- Notes and metadata
    customer_name VARCHAR(100),
    notes TEXT,
    discount_reason TEXT, -- Why discount was applied

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP DEFAULT NOW(),
    refunded_at TIMESTAMP DEFAULT NULL,

    -- Indexes
    CONSTRAINT positive_amounts CHECK (
        total_amount >= 0 AND
        subtotal >= 0
    )
);

-- Indexes for performance
CREATE INDEX idx_payments_table_ids ON payments USING GIN(table_ids);
CREATE INDEX idx_payments_processed_by ON payments(processed_by);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_payments_payment_number ON payments(payment_number);
```

#### 2. **payment_items** (Individual items paid)

```sql
CREATE TABLE payment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to payment
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

    -- Link to original order item
    order_item_id UUID NOT NULL REFERENCES order_items(id),

    -- Item snapshot (in case order item is deleted later)
    item_name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,

    -- Pricing
    original_price DECIMAL(10,2) NOT NULL, -- Price from menu
    adjusted_price DECIMAL(10,2) NOT NULL, -- Price after adjustments
    total_price DECIMAL(10,2) NOT NULL, -- adjusted_price * quantity
    price_adjustment_reason TEXT, -- Why price was changed

    -- Tax breakdown (if needed for reports)
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_items_payment_id ON payment_items(payment_id);
CREATE INDEX idx_payment_items_order_item_id ON payment_items(order_item_id);
```

#### 3. **payment_history** (Audit trail)

```sql
CREATE TABLE payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to payment
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

    -- Action tracking
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'created',
        'modified',
        'refunded',
        'cancelled',
        'approved',
        'price_adjusted'
    )),

    -- Who did what
    performed_by UUID NOT NULL REFERENCES users(id),

    -- Details
    old_values JSONB, -- State before change
    new_values JSONB, -- State after change
    reason TEXT,

    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_history_payment_id ON payment_history(payment_id);
CREATE INDEX idx_payment_history_performed_by ON payment_history(performed_by);
CREATE INDEX idx_payment_history_created_at ON payment_history(created_at);
```

#### 4. **discount_presets** (Pre-configured discounts)

```sql
CREATE TABLE discount_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Discount details
    name VARCHAR(100) NOT NULL, -- e.g., "Happy Hour", "Senior Discount"
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL,

    -- Conditions
    requires_manager_approval BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,

    -- Usage tracking
    times_used INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Modifications to Existing Tables

#### Update **order_items** table

```sql
-- Add payment tracking fields to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP DEFAULT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- Add index
CREATE INDEX IF NOT EXISTS idx_order_items_is_paid ON order_items(is_paid);
CREATE INDEX IF NOT EXISTS idx_order_items_payment_id ON order_items(payment_id);
```

---

## 🔌 API Endpoints Required

### Payment Creation & Processing

#### **POST /api/payments/calculate**

Calculate payment totals before confirming payment.

**Request Body:**

```json
{
  "order_item_ids": ["uuid1", "uuid2", "uuid3"],
  "price_adjustments": [
    {
      "order_item_id": "uuid1",
      "new_price": 10.5,
      "reason": "Customer complaint"
    }
  ],
  "discount": {
    "type": "percentage",
    "value": 10
  },
  "tip_amount": 5.0
}
```

**Response:**

```json
{
  "subtotal": 45.0,
  "tax_amount": 4.5,
  "discount_amount": 4.95,
  "tip_amount": 5.0,
  "total_amount": 49.55,
  "items": [
    {
      "order_item_id": "uuid1",
      "item_name": "Burger",
      "original_price": 12.99,
      "adjusted_price": 10.5,
      "quantity": 1,
      "total_price": 10.5
    }
  ]
}
```

#### **POST /api/payments**

Process and complete a payment.

**Request Body:**

```json
{
  "table_ids": ["table-uuid-1", "table-uuid-2"],
  "order_item_ids": ["uuid1", "uuid2"],
  "price_adjustments": [
    {
      "order_item_id": "uuid1",
      "new_price": 10.5,
      "reason": "Discount for complaint"
    }
  ],
  "payment_methods": [
    {
      "method": "cash",
      "amount": 30.0
    },
    {
      "method": "card",
      "amount": 19.55
    }
  ],
  "cash_received": 50.0,
  "tip_amount": 5.0,
  "discount": {
    "type": "percentage",
    "value": 10,
    "reason": "Happy Hour"
  },
  "customer_name": "John Doe",
  "notes": "Customer was very satisfied"
}
```

**Response:**

```json
{
  "payment": {
    "id": "payment-uuid",
    "payment_number": "PAY-20251112-0001",
    "subtotal": 45.00,
    "tax_amount": 4.50,
    "discount_amount": 4.95,
    "tip_amount": 5.00,
    "total_amount": 49.55,
    "cash_received": 50.00,
    "change_given": 0.45,
    "status": "completed",
    "created_at": "2025-11-12T14:30:00Z"
  },
  "payment_items": [...],
  "order_items_updated": ["uuid1", "uuid2"]
}
```

### Payment Retrieval

#### **GET /api/payments**

Get all payments with optional filters.

**Query Parameters:**

- `status` - Filter by status (completed, partial, refunded, cancelled)
- `date_from` - Start date
- `date_to` - End date
- `processed_by` - Filter by staff member UUID
- `table_id` - Filter by table UUID
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset

**Response:**

```json
{
  "payments": [
    {
      "id": "uuid",
      "payment_number": "PAY-20251112-0001",
      "table_ids": ["table-uuid"],
      "total_amount": 49.55,
      "status": "completed",
      "processed_by_user": {
        "name": "Maria Silva",
        "profile_image": "image-id"
      },
      "created_at": "2025-11-12T14:30:00Z",
      "item_count": 3
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

#### **GET /api/payments/:id**

Get detailed payment information.

**Response:**

```json
{
  "payment": {
    "id": "uuid",
    "payment_number": "PAY-20251112-0001",
    "table_ids": ["table-uuid-1"],
    "subtotal": 45.0,
    "tax_amount": 4.5,
    "discount_amount": 4.95,
    "tip_amount": 5.0,
    "total_amount": 49.55,
    "payment_methods": [
      { "method": "cash", "amount": 30.0 },
      { "method": "card", "amount": 19.55 }
    ],
    "cash_received": 50.0,
    "change_given": 0.45,
    "status": "completed",
    "processed_by": "user-uuid",
    "processed_by_user": {
      "name": "Maria Silva",
      "profile_image": "image-id"
    },
    "customer_name": "John Doe",
    "notes": "Customer was very satisfied",
    "created_at": "2025-11-12T14:30:00Z"
  },
  "items": [
    {
      "id": "item-uuid",
      "order_item_id": "order-uuid",
      "item_name": "Burger",
      "quantity": 1,
      "original_price": 12.99,
      "adjusted_price": 10.5,
      "total_price": 10.5,
      "price_adjustment_reason": "Discount for complaint"
    }
  ],
  "history": [
    {
      "action": "created",
      "performed_by_user": {
        "name": "Maria Silva"
      },
      "created_at": "2025-11-12T14:30:00Z"
    }
  ]
}
```

#### **GET /api/payments/table/:table_id/unpaid**

Get unpaid order items for a specific table.

**Response:**

```json
{
  "table_id": "table-uuid",
  "table_number": 5,
  "unpaid_items": [
    {
      "id": "order-item-uuid",
      "item_name": "Burger",
      "quantity": 1,
      "price": 12.99,
      "status": "entregue",
      "created_at": "2025-11-12T14:00:00Z",
      "menu_info": {
        "nome": "Burger",
        "image_id": "image-uuid"
      }
    }
  ],
  "total": 45.0
}
```

### Payment Actions

#### **POST /api/payments/:id/refund**

Refund a payment (requires manager approval).

**Request Body:**

```json
{
  "reason": "Customer complaint - food was cold",
  "refund_amount": 49.55,
  "refund_method": "cash"
}
```

**Response:**

```json
{
  "payment": {
    "id": "uuid",
    "status": "refunded",
    "refunded_at": "2025-11-12T15:00:00Z"
  },
  "refund_transaction": {
    "id": "refund-uuid",
    "amount": 49.55,
    "method": "cash",
    "reason": "Customer complaint - food was cold"
  }
}
```

#### **POST /api/payments/:id/partial**

Add partial payment to existing payment.

**Request Body:**

```json
{
  "payment_method": {
    "method": "card",
    "amount": 20.0
  }
}
```

### Discount Management

#### **GET /api/discounts/presets**

Get all discount presets.

**Response:**

```json
{
  "discounts": [
    {
      "id": "uuid",
      "name": "Happy Hour",
      "discount_type": "percentage",
      "discount_value": 10,
      "requires_manager_approval": false,
      "active": true,
      "times_used": 45
    }
  ]
}
```

#### **POST /api/discounts/presets**

Create new discount preset (manager only).

**Request Body:**

```json
{
  "name": "Senior Discount",
  "discount_type": "percentage",
  "discount_value": 15,
  "requires_manager_approval": false
}
```

### Reports & Analytics

#### **GET /api/payments/reports/daily**

Get daily payment summary.

**Query Parameters:**

- `date` - Date (YYYY-MM-DD)

**Response:**

```json
{
  "date": "2025-11-12",
  "total_payments": 45,
  "total_revenue": 1250.5,
  "total_tips": 125.0,
  "payment_methods": {
    "cash": 750.0,
    "card": 450.5,
    "mb_way": 50.0
  },
  "average_bill": 27.79,
  "discounts_given": 125.5,
  "refunds": 0
}
```

#### **GET /api/payments/reports/staff-performance**

Get staff payment performance.

**Query Parameters:**

- `date_from` - Start date
- `date_to` - End date
- `staff_id` - Optional: specific staff member

**Response:**

```json
{
  "staff_performance": [
    {
      "staff_id": "uuid",
      "staff_name": "Maria Silva",
      "payments_processed": 25,
      "total_revenue": 650.0,
      "average_bill": 26.0,
      "tips_received": 65.0,
      "discounts_applied": 25.0
    }
  ]
}
```

---

## 🎨 Frontend UI Design

### Page Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Payment Page                                  [X Close] │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐  ┌───────────────────────────┐   │
│  │  Table Selection │  │   Selected Items          │   │
│  │                  │  │                           │   │
│  │  □ Table 5       │  │  ┌─────────────────────┐ │   │
│  │  ☑ Table 6       │  │  │ Burger      €12.99  │ │   │
│  │  □ Table 7       │  │  │ [Edit] [Remove]     │ │   │
│  │                  │  │  └─────────────────────┘ │   │
│  │  [Load Orders]   │  │  ┌─────────────────────┐ │   │
│  │                  │  │  │ Fries       €4.50   │ │   │
│  └──────────────────┘  │  │ [Edit] [Remove]     │ │   │
│                        │  └─────────────────────┘ │   │
│                        └───────────────────────────┘   │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Payment Summary                                  │ │
│  │                                                   │ │
│  │  Subtotal:              €45.00                   │ │
│  │  Tax (10%):             €4.50                    │ │
│  │  Discount:              -€4.95                   │ │
│  │  Tip:                   €5.00                    │ │
│  │  ─────────────────────────────                   │ │
│  │  TOTAL:                 €49.55                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │  Calculator      │  │  Payment Methods          │  │
│  │                  │  │                           │  │
│  │  ┌────────────┐  │  │  ○ Cash                  │  │
│  │  │   €49.55   │  │  │  ○ Card                  │  │
│  │  └────────────┘  │  │  ○ MB Way                │  │
│  │  [7][8][9][-]   │  │  ○ Split Payment         │  │
│  │  [4][5][6][+]   │  │                           │  │
│  │  [1][2][3][×]   │  │  Cash Received: €50.00   │  │
│  │  [0][.][C][÷]   │  │  Change:        €0.45    │  │
│  └──────────────────┘  └───────────────────────────┘  │
│                                                         │
│  [Apply Discount]  [Add Tip]   [Process Payment]      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. **PaymentPage Component** (Main Container)

- Path: `/src/app/payment/page.tsx`
- Manages overall payment flow
- Handles table/order selection
- Coordinates all sub-components

#### 2. **ItemSelectionTable Component**

- Displays unpaid order items in table format
- Columns: Image, Item Name, Quantity, Original Price, Status, Actions
- Checkboxes for item selection
- Inline price editing
- Similar styling to TableLayout's order table

#### 3. **PaymentCalculator Component**

- Built-in calculator UI
- Number pad (0-9, decimal, operations)
- Display current amount
- Quick amount buttons (€5, €10, €20, €50)
- Clear and backspace functions

#### 4. **PaymentSummary Component**

- Shows subtotal, tax, discounts, tip
- Real-time calculation updates
- Large, clear total display with NumberFlow animation
- Breakdown of all charges

#### 5. **PaymentMethodSelector Component**

- Radio buttons for payment method selection
- Split payment option (multiple methods)
- Cash: Shows cash received input and change calculation
- Card: Shows card terminal integration status
- MB Way: Shows phone number input

#### 6. **ChangeCalculation Component**

- Shows recommended bills/coins for change
- Example: "Give: 1×€20, 1×€10, 1×€5, 1×€2, 2×€0.50"
- Visual representation of cash denominations

#### 7. **DiscountModal Component**

- Select from preset discounts
- Custom discount input (percentage or fixed)
- Discount reason text area
- Manager approval indicator

#### 8. **PaymentReceipt Component**

- Print preview of receipt
- Shows all items, payments, change
- Staff name who processed payment
- QR code for digital receipt
- Print and download buttons

---

## 🔄 User Workflow

### Standard Payment Flow

1. **Access Payment Page**

   - Click "Payment" from main menu
   - Or click "Process Payment" from TableLayout modal

2. **Select Tables/Orders**

   - Choose which table(s) to process
   - System loads all unpaid order items
   - Display items in table format

3. **Select Items to Pay**

   - Check boxes for items to include
   - Can pay partial orders
   - Edit prices if needed (with reason)

4. **Apply Discounts (Optional)**

   - Click "Apply Discount"
   - Choose preset or custom discount
   - Enter reason for audit trail
   - Manager approval may be required

5. **Add Tip (Optional)**

   - Click "Add Tip" button
   - Enter tip amount or percentage
   - Tip is distributed to staff later

6. **Calculate Total**

   - System automatically calculates:
     - Subtotal from selected items
     - Tax (10% or configured rate)
     - Discount deduction
     - Tip addition
     - Final total

7. **Choose Payment Method**

   - Select: Cash, Card, MB Way, or Split
   - For cash:
     - Enter amount received
     - System calculates change
     - Shows bills/coins breakdown

8. **Process Payment**

   - Click "Process Payment" button
   - System creates payment record
   - Updates order items to `is_paid = true`
   - Updates order status to `pago` if all items paid
   - Generates payment number
   - Logs staff member who processed

9. **Print Receipt (Optional)**
   - Receipt preview appears
   - Option to print
   - Option to email/SMS to customer

### Split Payment Flow

1. Select items and apply discounts/tips as normal
2. Click "Split Payment" method
3. Choose split type:
   - **Even Split**: Divide equally (e.g., 4 people)
   - **Custom Split**: Assign items to people
   - **Amount Split**: Each person pays specific amount
4. For each payment:
   - Select payment method
   - Process individual payment
   - System tracks as sub-payment
5. When all paid, main payment is marked complete

---

## 🎨 Styling Guidelines

### Color Scheme

- **Primary**: `#3b82f6` (Blue) - Action buttons
- **Success**: `#10b981` (Green) - Complete payment button
- **Warning**: `#f59e0b` (Amber) - Discount indicators
- **Danger**: `#ef4444` (Red) - Refund/cancel buttons
- **Neutral**: `#6b7280` (Gray) - Secondary text
- **Background**: `#f9fafb` (Light gray) - Page background

### Typography

- **Font Family**: `Nunito` (consistent with app)
- **Heading**: `font-weight: 700, font-size: 20px`
- **Subheading**: `font-weight: 600, font-size: 16px`
- **Body**: `font-weight: 400, font-size: 14px`
- **Price Display**: `font-weight: 700, font-size: 24px` with NumberFlow

### Component Styling

- **Border Radius**: `1.5rem` (24px) for cards and buttons
- **Shadows**: `box-shadow: 0 4px 6px rgba(0,0,0,0.1)` for elevated elements
- **Spacing**: `padding: 16px 24px` for cards
- **Transitions**: `transition: all 0.2s ease` for interactive elements

### Responsive Design

- **Desktop**: Full layout with side-by-side components
- **Tablet**: Stacked components with full width
- **Mobile**: Single column, simplified calculator

---

## 📊 Data Flow

### Payment Creation Process

```
User selects tables/items
         ↓
Frontend validates selection
         ↓
POST /api/payments/calculate
         ↓
Backend calculates totals
         ↓
Frontend shows summary
         ↓
User confirms and adds payment details
         ↓
POST /api/payments
         ↓
Backend creates payment record
         ↓
Backend creates payment_items records
         ↓
Backend updates order_items (is_paid = true, payment_id)
         ↓
Backend updates order status to "pago" if all items paid
         ↓
Backend creates payment_history record
         ↓
WebSocket emits payment:created event
         ↓
Frontend updates UI
         ↓
Show receipt
```

### WebSocket Events

#### **payment:created**

Emitted when new payment is processed.

```json
{
  "payment_id": "uuid",
  "payment_number": "PAY-20251112-0001",
  "table_ids": ["table-uuid"],
  "total_amount": 49.55,
  "status": "completed",
  "processed_by": {
    "name": "Maria Silva",
    "profile_image": "image-id"
  }
}
```

#### **payment:refunded**

Emitted when payment is refunded.

```json
{
  "payment_id": "uuid",
  "refund_amount": 49.55,
  "reason": "Customer complaint",
  "refunded_by": {
    "name": "Manager Name"
  }
}
```

#### **order:paid**

Emitted when order status changes to "pago".

```json
{
  "order_item_ids": ["uuid1", "uuid2"],
  "payment_id": "payment-uuid",
  "table_ids": ["table-uuid"]
}
```

---

## 🧪 Testing Checklist

### Unit Tests

- [ ] Payment calculation with no discounts
- [ ] Payment calculation with percentage discount
- [ ] Payment calculation with fixed discount
- [ ] Payment calculation with tip
- [ ] Payment calculation with multiple adjustments
- [ ] Change calculation with various amounts
- [ ] Split payment calculation
- [ ] Tax calculation

### Integration Tests

- [ ] Create payment with single item
- [ ] Create payment with multiple items
- [ ] Create payment with price adjustments
- [ ] Create payment with discount
- [ ] Create split payment
- [ ] Refund payment
- [ ] Get payment history
- [ ] Filter payments by date range
- [ ] Filter payments by staff member

### UI Tests

- [ ] Table selection works correctly
- [ ] Item selection checkboxes function
- [ ] Price editing updates totals
- [ ] Calculator inputs correctly
- [ ] Change calculation displays properly
- [ ] Discount modal applies correctly
- [ ] Payment method selection works
- [ ] Receipt generation works
- [ ] Mobile responsive design
- [ ] WebSocket updates in real-time

---

## 🔐 Security Considerations

### Permissions

- **All Staff**: Can process standard payments
- **Manager Only**:
  - Approve discounts over 20%
  - Process refunds
  - Edit payment history
  - Access detailed reports

### Audit Trail

- Every payment action logged in `payment_history`
- Track who created, modified, refunded payments
- Store old and new values for changes
- Cannot delete payment records (only cancel)

### Validation

- Price adjustments must have reason
- Large discounts require manager approval
- Refunds require manager authentication
- Payment amounts must match selected items

---

## 📝 Instructions for Backend Developer

### Step 1: Database Setup

**Create the three new tables:**

1. `payments` table as specified above
2. `payment_items` table as specified above
3. `payment_history` table as specified above
4. `discount_presets` table as specified above

**Modify existing table:**

1. Add `paid_at`, `payment_id`, `is_paid` columns to `order_items`
2. Create indexes as specified

### Step 2: API Endpoints Implementation

**Priority 1 (Critical for MVP):**

1. `POST /api/payments/calculate` - Calculate payment totals
2. `POST /api/payments` - Process payment
3. `GET /api/payments/table/:table_id/unpaid` - Get unpaid items for table
4. `GET /api/payments/:id` - Get payment details
5. `GET /api/payments` - List payments with filters

**Priority 2 (Important):** 6. `POST /api/payments/:id/refund` - Refund payment 7. `GET /api/discounts/presets` - Get discount presets 8. `POST /api/discounts/presets` - Create discount preset 9. `GET /api/payments/reports/daily` - Daily summary

**Priority 3 (Nice to have):** 10. `POST /api/payments/:id/partial` - Add partial payment 11. `GET /api/payments/reports/staff-performance` - Staff performance

### Step 3: Business Logic

**Payment Number Generation:**

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

**Tax Calculation:**

```javascript
// 10% tax rate (configurable)
const TAX_RATE = 0.1;

const calculateTax = (subtotal) => {
  return Math.round(subtotal * TAX_RATE * 100) / 100;
};
```

**Change Breakdown:**

```javascript
// Calculate optimal bills/coins for change
const calculateChangeBreakdown = (changeAmount) => {
  const denominations = [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
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
};
```

### Step 4: WebSocket Events

**Emit these events when actions occur:**

1. When payment created:

```javascript
io.emit("payment:created", {
  payment_id: payment.id,
  payment_number: payment.payment_number,
  table_ids: payment.table_ids,
  total_amount: payment.total_amount,
  status: payment.status,
  processed_by: userInfo,
});
```

2. When order items are paid:

```javascript
io.emit("order:paid", {
  order_item_ids: paidItemIds,
  payment_id: payment.id,
  table_ids: payment.table_ids,
});
```

3. When payment refunded:

```javascript
io.emit("payment:refunded", {
  payment_id: payment.id,
  refund_amount: refundAmount,
  reason: reason,
  refunded_by: userInfo,
});
```

### Step 5: Validation Rules

**Payment Creation Validation:**

- At least one order item must be selected
- All order items must exist and be unpaid
- Total amount must be positive
- Payment methods must sum to total amount
- If cash payment, cash_received must be >= total_amount
- If discount > 20%, must have manager approval

**Price Adjustment Validation:**

- Adjusted price must be > 0
- Must provide reason if price decreased
- Manager approval required if discount > 30%

**Refund Validation:**

- Payment must be in "completed" status
- Must provide reason
- Must be approved by manager
- Cannot refund twice

### Step 6: Database Transactions

**All payment operations must be atomic:**

```javascript
const processPayment = async (paymentData) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create payment record
    const payment = await client.query(INSERT_PAYMENT_SQL, [...]);

    // 2. Create payment items
    for (const item of paymentData.items) {
      await client.query(INSERT_PAYMENT_ITEM_SQL, [...]);
    }

    // 3. Update order items
    await client.query(
      `UPDATE order_items SET is_paid = true, payment_id = $1, paid_at = NOW()
       WHERE id = ANY($2)`,
      [payment.id, itemIds]
    );

    // 4. Update order status to 'pago' if all items paid
    await client.query(
      `UPDATE order_items SET status = 'pago'
       WHERE table_id = ANY($1) AND NOT EXISTS (
         SELECT 1 FROM order_items
         WHERE table_id = ANY($1) AND is_paid = false
       )`,
      [paymentData.table_ids]
    );

    // 5. Create audit log
    await client.query(INSERT_PAYMENT_HISTORY_SQL, [...]);

    await client.query('COMMIT');
    return payment;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

### Step 7: Return Data Format

**Always include user info in responses:**

```javascript
// Join with users table to get staff info
const payment = await pool.query(
  `
  SELECT 
    p.*,
    u.name as processed_by_name,
    u.profile_image as processed_by_image,
    m.name as approved_by_name,
    m.profile_image as approved_by_image
  FROM payments p
  LEFT JOIN users u ON p.processed_by = u.id
  LEFT JOIN users m ON p.approved_by = m.id
  WHERE p.id = $1
`,
  [paymentId]
);

// Format response
return {
  ...payment.rows[0],
  processed_by_user: {
    name: payment.rows[0].processed_by_name,
    profile_image: payment.rows[0].processed_by_image,
  },
  approved_by_user: payment.rows[0].approved_by
    ? {
        name: payment.rows[0].approved_by_name,
        profile_image: payment.rows[0].approved_by_image,
      }
    : null,
};
```

---

## 🚀 Frontend Implementation Phases

### Phase 1: Basic Payment (Week 1)

- [ ] Create payment page route
- [ ] Build ItemSelectionTable component
- [ ] Build PaymentSummary component
- [ ] Implement basic payment flow (single method)
- [ ] API integration for payment creation
- [ ] WebSocket listener for real-time updates

### Phase 2: Calculator & Change (Week 2)

- [ ] Build PaymentCalculator component
- [ ] Build ChangeCalculation component
- [ ] Integrate calculator with payment flow
- [ ] Cash payment with change calculation

### Phase 3: Advanced Features (Week 3)

- [ ] Build DiscountModal component
- [ ] Build PaymentMethodSelector component
- [ ] Implement split payment
- [ ] Price adjustment functionality

### Phase 4: Receipts & Reports (Week 4)

- [ ] Build PaymentReceipt component
- [ ] Receipt printing functionality
- [ ] Payment history view
- [ ] Daily reports dashboard

---

## 📖 Summary for Developer Conversation

**Tell your backend developer:**

"I need you to implement a complete payment system for our restaurant app. Here's what we need:

### Database Changes:

1. **Create 4 new tables**:

   - `payments` (main payment records with totals, methods, staff tracking)
   - `payment_items` (individual items paid, with price adjustments)
   - `payment_history` (audit trail for all payment actions)
   - `discount_presets` (pre-configured discount options)

2. **Update existing table**:
   - Add `is_paid`, `paid_at`, `payment_id` to `order_items` table

### API Endpoints (11 total):

**Priority 1 (MVP - Need first):**

1. `POST /api/payments/calculate` - Calculate totals before confirming
2. `POST /api/payments` - Create and process payment
3. `GET /api/payments/table/:table_id/unpaid` - Get unpaid items for table
4. `GET /api/payments/:id` - Get payment details
5. `GET /api/payments` - List all payments with filters

**Priority 2:** 6. `POST /api/payments/:id/refund` - Refund payment (manager only) 7. `GET /api/discounts/presets` - Get available discounts 8. `POST /api/discounts/presets` - Create discount (manager only) 9. `GET /api/payments/reports/daily` - Daily payment summary

**Priority 3 (Later):** 10. `POST /api/payments/:id/partial` - Add partial payment 11. `GET /api/payments/reports/staff-performance` - Staff stats

### Key Features:

- **Payment Calculation**: Subtotal + Tax - Discount + Tip = Total
- **Multiple Payment Methods**: Cash, Card, MB Way, Split payment
- **Change Calculation**: For cash payments, calculate change and optimal bills/coins
- **Price Adjustments**: Allow editing item prices (with reason + manager approval)
- **Staff Tracking**: Every payment logs who processed it
- **Audit Trail**: Full history of all payment actions
- **WebSocket Events**: Emit `payment:created`, `order:paid`, `payment:refunded`

### Business Rules:

- All payment operations must be **atomic transactions** (use BEGIN/COMMIT)
- When all items from a table are paid, update order status to `'pago'`
- Discounts over 20% require manager approval
- All refunds require manager approval
- Payment numbers format: `PAY-YYYYMMDD-####` (e.g., PAY-20251112-0001)
- Tax rate is 10% (but make it configurable)

### Data Structure:

Each payment includes:

- Financial breakdown (subtotal, tax, discount, tip, total)
- Array of payment methods used (can split between cash/card/etc)
- Cash handling (received amount, change given, change breakdown)
- Reference to table IDs and order items
- Staff member who processed payment
- Timestamps for audit trail

I've documented everything in `PAYMENT_PAGE_PLAN.md` - please read the full spec for detailed table schemas, endpoint request/response examples, validation rules, and WebSocket event formats. Let me know when you've implemented Priority 1 endpoints so I can start building the frontend!"

---

## 📋 Final Checklist

**Backend Developer Deliverables:**

- [ ] All database tables created with indexes
- [ ] Priority 1 API endpoints implemented
- [ ] WebSocket events implemented
- [ ] Request/response validation
- [ ] Transaction handling for payments
- [ ] Error handling and logging
- [ ] API documentation/Postman collection

**Frontend Developer Deliverables:**

- [ ] Payment page route and layout
- [ ] Item selection table component
- [ ] Payment calculator component
- [ ] Payment summary component
- [ ] Payment method selector
- [ ] Change calculation display
- [ ] Discount modal
- [ ] Receipt preview/print
- [ ] WebSocket integration
- [ ] Mobile responsive design

**Testing Deliverables:**

- [ ] Unit tests for calculations
- [ ] Integration tests for API endpoints
- [ ] UI tests for payment flow
- [ ] Test cash payment with change
- [ ] Test split payment
- [ ] Test discount application
- [ ] Test refund process

---

_This plan follows the existing architecture of TableLayout and order management system, maintaining consistency in styling, WebSocket usage, and data flow patterns._
