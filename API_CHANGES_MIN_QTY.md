# API Changes: min_qty Migration to Inventory Level

## Summary
The `min_qty` field has been moved from `stock_items` table to `stock_inventory` table. This allows for different minimum quantity thresholds per warehouse, providing more flexibility in stock management.

---

## Breaking Changes

### 1. **GET /api/stock/items**
**What Changed:**
- Response no longer includes `min_qty` at the item level
- `min_qty` is now specific to each warehouse

**Old Response:**
```json
{
  "documents": [
    {
      "$id": "1",
      "name": "Product A",
      "qty": 100,
      "min_qty": 20,
      ...
    }
  ]
}
```

**New Response:**
```json
{
  "documents": [
    {
      "$id": "1",
      "name": "Product A",
      "qty": 100,
      ...
    }
  ]
}
```

**Action Required:**
- Remove `min_qty` from item list displays
- To get min_qty info, fetch item details or inventory breakdown

---

### 2. **GET /api/stock/items/:id**
**What Changed:**
- Response no longer includes `min_qty` at root level
- Each warehouse in `warehouses` array now includes `min_qty`

**Old Response:**
```json
{
  "$id": "1",
  "name": "Product A",
  "qty": 100,
  "min_qty": 20,
  "warehouses": [
    {
      "warehouse_id": "1",
      "warehouse_name": "Main Warehouse",
      "qty": 60,
      "position": "A1-B2"
    }
  ]
}
```

**New Response:**
```json
{
  "$id": "1",
  "name": "Product A",
  "qty": 100,
  "warehouses": [
    {
      "warehouse_id": "1",
      "warehouse_name": "Main Warehouse",
      "qty": 60,
      "min_qty": 15,
      "position": "A1-B2"
    }
  ]
}
```

**Action Required:**
- Update UI to show min_qty per warehouse instead of per item
- Update any logic that checks stock levels against min_qty to work per warehouse

---

### 3. **POST /api/stock/items**
**What Changed:**
- Request body no longer accepts `min_qty` at item level
- `min_qty` must be specified in the `inventory` array for each warehouse

**Old Request:**
```json
{
  "name": "New Product",
  "cost_price": 10.50,
  "min_qty": 25,
  "inventory": [
    {
      "warehouse_id": 1,
      "qty": 100,
      "position": "A1-B2"
    }
  ]
}
```

**New Request:**
```json
{
  "name": "New Product",
  "cost_price": 10.50,
  "inventory": [
    {
      "warehouse_id": 1,
      "qty": 100,
      "min_qty": 25,
      "position": "A1-B2"
    }
  ]
}
```

**Action Required:**
- Remove `min_qty` from item creation form root level
- Add `min_qty` input field for each warehouse in inventory section
- Update form validation to ensure `min_qty` is provided per warehouse

---

### 4. **PUT /api/stock/items/:id**
**What Changed:**
- Request body no longer accepts `min_qty`
- To update `min_qty`, use the inventory endpoints instead

**Old Request:**
```json
{
  "name": "Updated Product",
  "min_qty": 30
}
```

**New Request:**
```json
{
  "name": "Updated Product"
}
```

**Action Required:**
- Remove `min_qty` field from item edit form
- Use `PUT /api/stock/items/:id/inventory/:warehouse_id` to update min_qty per warehouse

---

### 5. **GET /api/stock/items/:id/inventory**
**What Changed:**
- Response now includes `min_qty` for each warehouse

**Old Response:**
```json
{
  "documents": [
    {
      "$id": "1",
      "warehouse_id": "1",
      "warehouse_name": "Main Warehouse",
      "qty": 60,
      "position": "A1-B2"
    }
  ]
}
```

**New Response:**
```json
{
  "documents": [
    {
      "$id": "1",
      "warehouse_id": "1",
      "warehouse_name": "Main Warehouse",
      "qty": 60,
      "min_qty": 15,
      "position": "A1-B2"
    }
  ]
}
```

**Action Required:**
- Display `min_qty` in inventory breakdown views

---

### 6. **POST /api/stock/items/:id/inventory**
**What Changed:**
- Request body now accepts `min_qty` field

**Old Request:**
```json
{
  "warehouse_id": 1,
  "qty": 50,
  "position": "C2-D3"
}
```

**New Request:**
```json
{
  "warehouse_id": 1,
  "qty": 50,
  "min_qty": 20,
  "position": "C2-D3"
}
```

**Action Required:**
- Add `min_qty` field to inventory add/update forms
- Make it optional (defaults to 0 if not provided)

---

### 7. **PUT /api/stock/items/:id/inventory/:warehouse_id**
**What Changed:**
- Request body now accepts `min_qty` field for updating

**Old Request:**
```json
{
  "qty": 75,
  "position": "D1-E2"
}
```

**New Request:**
```json
{
  "qty": 75,
  "min_qty": 25,
  "position": "D1-E2"
}
```

**Action Required:**
- Add `min_qty` field to inventory update forms
- Allow updating min_qty independently from qty

---

### 8. **GET /api/stock/alerts**
**What Changed:**
- Alerts are now per warehouse, not per item
- Response structure includes warehouse information
- Alert ID format changed to `{item_id}_{warehouse_id}`

**Old Response:**
```json
{
  "documents": [
    {
      "$id": "1",
      "name": "Product A",
      "qty": 18,
      "min_qty": 20,
      "status": "critical"
    }
  ]
}
```

**New Response:**
```json
{
  "documents": [
    {
      "$id": "1_1",
      "item_id": "1",
      "name": "Product A",
      "warehouse_id": "1",
      "warehouse_name": "Main Warehouse",
      "qty": 18,
      "min_qty": 20,
      "status": "critical"
    }
  ]
}
```

**Action Required:**
- Update alerts display to show warehouse information
- Update alert item clicking logic to handle new ID format
- Show which warehouse has the critical/warning stock

---

### 9. **GET /api/stock/stats**
**What Changed:**
- Statistics now count warehouse-level inventory records, not items
- `critical_stock`, `warning_stock`, and `ok_stock` counts represent inventory records per warehouse

**Behavior:**
- If one item is in 2 warehouses and both are critical, it counts as 2 critical_stock
- This better represents actual warehouse stock status

**Action Required:**
- Update dashboard labels to clarify that counts are per warehouse location
- Consider showing "X locations need attention" instead of "X items low"

---

## WebSocket Changes

### Stock Alerts
**Old Format:**
```json
{
  "name": "Product A",
  "qty": 18,
  "min_qty": 20,
  "status": "critical",
  "message": "Item 'Product A' está em nível crítico (18/20)"
}
```

**New Format:**
```json
{
  "name": "Product A",
  "warehouse_id": "1",
  "warehouse_name": "Main Warehouse",
  "qty": 18,
  "min_qty": 20,
  "status": "critical",
  "message": "Item 'Product A' em Main Warehouse está em nível crítico (18/20)"
}
```

**Action Required:**
- Update WebSocket alert handlers to include warehouse information
- Update alert notifications to show which warehouse

---

## Migration Steps

1. **Run the SQL migration:**
   ```bash
   psql -U your_user -d your_database -f migrate_min_qty_to_inventory.sql
   ```

2. **Update your frontend code** following the changes above

3. **Set min_qty values** for existing inventory records (currently defaulted to 0)

4. **Test thoroughly:**
   - Item creation with multiple warehouses
   - Inventory updates
   - Alert generation
   - Stats dashboard

---

## Example: Complete Item Creation Flow

**Frontend Form:**
```
Product Name: [Coffee Beans]
Cost Price: [€8.50]
Category: [Beverages]

Inventory:
  Warehouse: [Main Warehouse ▼]
    Quantity: [100]
    Min Quantity: [20]  ← NEW
    Position: [A1-B2]

  Warehouse: [Secondary Warehouse ▼]
    Quantity: [50]
    Min Quantity: [10]  ← NEW
    Position: [C2-D1]
```

**API Request:**
```json
{
  "name": "Coffee Beans",
  "cost_price": 8.50,
  "category": "Beverages",
  "inventory": [
    {
      "warehouse_id": 1,
      "qty": 100,
      "min_qty": 20,
      "position": "A1-B2"
    },
    {
      "warehouse_id": 2,
      "qty": 50,
      "min_qty": 10,
      "position": "C2-D1"
    }
  ]
}
```

---

## Questions?
Contact the backend team if you need clarification on any of these changes.
