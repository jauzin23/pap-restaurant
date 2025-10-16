# Order Management Database Design

## Overview

This document outlines the complete database design for a restaurant order management system that handles the full order lifecycle from creation to completion, including dine-in and takeaway orders.

## Order Workflow States

### 1. **PENDING** - "5 min ago"

- Order created by customer/waitress
- Visible to all kitchen staff and management
- Shows timestamp since creation
- No one has claimed responsibility yet

### 2. **CLAIMED** - "ima do this one"

- Chef or waitress accepts the order
- Order is now assigned to specific staff member
- Shows who claimed it and when
- Prevents double-assignment

### 3. **IN_PROGRESS** - Currently being prepared

- Staff member is actively working on the order
- Can mark individual items as completed
- Shows progress percentage

### 4. **READY** - "waitress u can come here bitch"

- Kitchen has finished preparing the order
- Notification sent to waitresses
- Ready for pickup/delivery to table

### 5. **OUT_FOR_DELIVERY** - "im finna deliver this shi"

- Waitress has claimed delivery responsibility
- Order is being transported to table/customer
- Shows delivery person and timestamp

### 6. **DELIVERED** - "aight now when u want yall can pay for this"

- Order successfully delivered to customer
- Ready for payment processing
- Customer can now request bill

### 7. **COMPLETED** - Fully finished and paid

- Payment processed successfully
- Order cycle complete
- Data retained for analytics

## Database Schema

### Single Table Design

#### **order_items** (The ONLY table needed!)

```sql
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Table assignment OR takeaway group
    table_id UUID REFERENCES tables(id), -- NULL for takeaway
    takeaway_group_id UUID, -- Groups takeaway items together (UUID per customer)

    -- Menu item details
    menu_item_id UUID REFERENCES menu_items(id),
    item_name VARCHAR(200) NOT NULL, -- Snapshot at order time
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(8,2) NOT NULL,
    total_price DECIMAL(8,2) NOT NULL, -- quantity * unit_price

    -- Customer info (for takeaway)
    customer_name VARCHAR(100), -- Only for takeaway
    customer_phone VARCHAR(20), -- Only for takeaway

    -- WORKFLOW STATUS
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pendente',       -- Just ordered - "5 min ago"
        'aceite',   -- Being prepared
        'pronto',         -- "waitress u can come here bitch"
        'a ser entregue...', -- "im finna deliver this shi" (dine-in only)
        'entregue',     -- "aight now when u want yall can pay for this"
        'completo',     -- Paid and done
        'cancelado'      -- Cancelled item
    )),

    -- WHO DID WHAT
    claimed_by UUID REFERENCES staff(id), -- Who claimed this item
    claimed_at TIMESTAMP,
    prepared_by UUID REFERENCES staff(id), -- Who marked it ready
    prepared_at TIMESTAMP,
    delivered_by UUID REFERENCES staff(id), -- Who delivered it (dine-in only)
    delivered_at TIMESTAMP,
    completed_by UUID REFERENCES staff(id), -- Who processed payment
    completed_at TIMESTAMP,

    -- Item customizations and notes
    notas TEXT, -- "No onions, extra cheese, allergic to nuts"

    -- Payment info (filled when individual item is paid)
    tip_amount DECIMAL(8,2), -- Tip allocated to this item
    payment_method VARCHAR(50), -- 'cash', 'card', 'digital'

    -- Timing and priority
    prep_time_minutes INTEGER, -- Estimated prep time
    actual_prep_time INTEGER, -- Actual time taken
    priority_level INTEGER DEFAULT 1, -- Item-level priority

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES staff(id), -- Who added this item
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_order_items_table_id ON order_items(table_id);
CREATE INDEX idx_order_items_takeaway_group ON order_items(takeaway_group_id);
CREATE INDEX idx_order_items_status ON order_items(status);
CREATE INDEX idx_order_items_claimed_by ON order_items(claimed_by);
CREATE INDEX idx_order_items_created_at ON order_items(created_at);
CREATE INDEX idx_order_items_status_created ON order_items(status, created_at);
CREATE INDEX idx_order_items_table_status ON order_items(table_id, status);
```

## Frontend Data Grouping Examples

### Dine-in Orders (Group by table_id)

```javascript
// Frontend groups items by table
const tableOrders = items
  .filter((item) => item.table_id && !item.takeaway_group_id)
  .reduce((groups, item) => {
    const tableId = item.table_id;
    if (!groups[tableId]) groups[tableId] = [];
    groups[tableId].push(item);
    return groups;
  }, {});

// Result: { table_5_uuid: [item1, item2], table_7_uuid: [item3] }
```

### Takeaway Orders (Group by takeaway_group_id)

```javascript
// Frontend groups takeaway items by customer
const takeawayOrders = items
  .filter((item) => item.takeaway_group_id)
  .reduce((groups, item) => {
    const groupId = item.takeaway_group_id;
    if (!groups[groupId]) groups[groupId] = [];
    groups[groupId].push(item);
    return groups;
  }, {});

// Result: { uuid1: [burger, fries], uuid2: [pizza] }
```

### Multi-table Support (Same table_id for merged tables)

```javascript
// When merging tables 5, 6, 7 - just use same table_id for all items
// Frontend can display as "Table 5 (merged with 6, 7)"
// All items have table_id = table_5_uuid
// Kitchen sees one grouped order
```

## Simple API Design

### Creating Orders

```javascript
// Dine-in: All items for table 5
const dineInItems = [
  {
    table_id: "table_5_uuid",
    takeaway_group_id: null,
    menu_item_id: "burger_uuid",
    item_name: "Classic Burger",
    quantity: 2,
    unit_price: 12.99,
    total_price: 25.98,
    notas: "No onions on both",
  },
];

// Takeaway: Items for one customer
const takeawayItems = [
  {
    table_id: null,
    takeaway_group_id: crypto.randomUUID(), // Same UUID for customer's items
    customer_name: "John Doe",
    customer_phone: "+351912345678",
    menu_item_id: "pizza_uuid",
    item_name: "Margherita Pizza",
    quantity: 1,
    unit_price: 15.99,
    total_price: 15.99,
    notas: "Extra cheese",
  },
];
```

### Kitchen Interface

```javascript
// Kitchen sees ALL pending items, grouped by location
const kitchenQueue = await db.query(`
  SELECT 
    id,
    table_id,
    takeaway_group_id,
    customer_name,
    item_name,
    quantity,
    notas,
    status,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 AS wait_minutes
  FROM order_items 
  WHERE status IN ('pending', 'claimed', 'in_progress')
  ORDER BY created_at ASC
`);

// Frontend groups for display:
// "Table 5: 2x Burger (No onions)"
// "Takeaway - John: 1x Pizza (Extra cheese)"
```

## API Endpoints Design

### Item Management (Single Table Approach)

- `POST /api/items` - Add new item to table or takeaway group
- `GET /api/items/active` - Get all active items (grouped by frontend)
- `GET /api/items/table/{tableId}` - Get items for specific table
- `GET /api/items/takeaway/{groupId}` - Get items for takeaway group
- `PATCH /api/items/{id}/claim` - Claim item responsibility
- `PATCH /api/items/{id}/status` - Update item status
- `DELETE /api/items/{id}` - Cancel/remove item

### Kitchen Interface

- `GET /api/kitchen/queue` - Get all pending items (all tables + takeaway)
- `POST /api/kitchen/claim/{itemId}` - Chef claims specific item
- `PATCH /api/kitchen/items/{itemId}/ready` - Mark item as ready

### Waitress Interface

- `GET /api/waitress/ready-items` - Get ready items by table
- `POST /api/waitress/claim-delivery/{tableId}` - Claim table delivery
- `PATCH /api/waitress/deliver/{tableId}` - Mark table items as delivered

### Payment Interface

- `GET /api/payment/table/{tableId}` - Get items ready for payment
- `GET /api/payment/takeaway/{groupId}` - Get takeaway items for payment
- `POST /api/payment/process` - Process payment for items
- `PATCH /api/items/bulk-complete` - Mark multiple items as completed

### Real-time Updates

- WebSocket: `/ws/kitchen` - Live kitchen queue updates
- WebSocket: `/ws/waitress` - Live delivery notifications
- WebSocket: `/ws/table/{tableId}` - Table-specific updates

## Performance Considerations

### Indexes

```sql
-- Additional performance indexes
CREATE INDEX idx_orders_status_created ON orders(status, created_at);
CREATE INDEX idx_orders_claimed_by_status ON orders(claimed_by, status);
CREATE INDEX idx_order_items_order_status ON order_items(order_id, status);
CREATE INDEX idx_notifications_unread ON order_notifications(target_role, is_read) WHERE is_read = FALSE;
```

### Partitioning (for high volume)

```sql
-- Partition order_notifications by month for performance (if high volume)
CREATE TABLE order_notifications_2024_01 PARTITION OF order_notifications
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Integration with Table Layout

The `table_id` in orders connects directly to the existing table layout system:

- Visual table status on layout (occupied, ready for service, payment pending)
- Click table to see order details
- Color-coded status indicators
- Drag-and-drop order assignment to tables

## Takeaway Considerations

For takeaway orders:

- `table_id` is NULL
- `customer_name` and `phone` are required
- Different workflow (no delivery to table)
- SMS notifications for order ready
- Pickup confirmation system

This design provides a robust foundation for managing the complete order lifecycle while maintaining performance and providing real-time updates to all staff members.

## Frontend Data Flow

### Order Creation Process

```javascript
// When creating order, financial fields are NULL
const newOrder = {
  table_id: "table-uuid",
  order_type: "dine_in",
  status: "pending",
  // subtotal, tax_amount, tip_amount, total_amount all NULL
  // payment_method, payment_status stay default
  general_notes: "Customer birthday - bring candles",
};

// Each item gets its own detailed notes
const orderItems = [
  {
    menu_item_id: "burger-uuid",
    item_name: "Classic Burger",
    quantity: 1,
    unit_price: 12.99,
    total_price: 12.99,
    customizations: "No onions, extra pickles",
    special_notes: "Customer allergic to onions",
    cooking_instructions: "Medium rare, crispy bacon",
  },
  {
    menu_item_id: "fries-uuid",
    item_name: "French Fries",
    quantity: 1,
    unit_price: 4.99,
    total_price: 4.99,
    customizations: "Extra crispy",
    special_notes: "Share with table",
  },
];
```

### Frontend Order Display

```javascript
// Kitchen sees each item with its specific notes
const KitchenOrderCard = ({ order, items }) => (
  <div className="order-card">
    <h3>
      Order #{order.order_number} - Table {order.table_number}
    </h3>
    {items.map((item) => (
      <div key={item.id} className="order-item">
        <h4>
          {item.quantity}x {item.item_name}
        </h4>
        {item.customizations && (
          <p className="customizations">{item.customizations}</p>
        )}
        {item.cooking_instructions && (
          <p className="cooking-notes">{item.cooking_instructions}</p>
        )}
        {item.special_notes && (
          <p className="allergies">{item.special_notes}</p>
        )}
        <button onClick={() => markItemReady(item.id)}>Mark Ready</button>
      </div>
    ))}
  </div>
);

// Waitress sees consolidated order for delivery
const WaitressOrderCard = ({ order, items }) => (
  <div className="delivery-card">
    <h3>Table {order.table_number} - Ready for Delivery</h3>
    <div className="items-summary">
      {items.map((item) => (
        <span key={item.id}>
          {item.quantity}x {item.item_name}
        </span>
      ))}
    </div>
    {order.general_notes && (
      <p className="order-notes">{order.general_notes}</p>
    )}
    <button onClick={() => claimDelivery(order.id)}>I'll Deliver This</button>
  </div>
);
```

### Payment Time Calculation

```javascript
// Only calculate financial totals when payment starts
const initiatePayment = async (orderId) => {
  const items = await getOrderItems(orderId);

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const tax_amount = subtotal * 0.1; // 10% tax
  const total_before_tip = subtotal + tax_amount;

  // Update order with calculated amounts
  await updateOrder(orderId, {
    subtotal,
    tax_amount,
    total_amount: total_before_tip, // Will update again when tip added
    payment_status: "pending",
  });

  // Show payment interface to customer/waitress
  showPaymentInterface(orderId, total_before_tip);
};

// When tip is added
const addTip = async (orderId, tipAmount) => {
  const order = await getOrder(orderId);
  const newTotal = order.subtotal + order.tax_amount + tipAmount;

  await updateOrder(orderId, {
    tip_amount: tipAmount,
    total_amount: newTotal,
  });
};
```

### Why This Design Works Better

1. **Per-Item Notes**: Each dish can have unique cooking instructions, allergies, customizations
2. **Kitchen Efficiency**: Chefs see exactly what they need for each item
3. **Waitress Simplicity**: Service staff see clean summary for delivery
4. **Financial Accuracy**: No dummy $0.00 values, proper NULL until payment
5. **Performance**: No unnecessary calculations until payment time
6. **Flexibility**: Easy to add item-level pricing modifications (upcharges for extras)
