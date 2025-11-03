# Multi-Warehouse Stock Management API Documentation

## Overview

This document describes the updated Stock Management API that now supports **multi-warehouse inventory management**. The system allows tracking stock items across multiple physical warehouse locations with granular control over quantities and positions.

---

## Database Schema Changes

### New Tables

#### 1. `warehouses`
Physical storage locations for inventory.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| name | VARCHAR(255) | Warehouse name (unique) |
| description | TEXT | Optional description |
| address | TEXT | Physical address |
| is_active | BOOLEAN | Active status |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### 2. `stock_items`
Product catalog (replaces old `stock` table).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| name | VARCHAR(255) | Item name |
| category | VARCHAR(255) | Category name |
| description | TEXT | Item description |
| supplier_id | INTEGER | FK to `supplier` table |
| cost_price | DECIMAL(10,2) | Unit cost price |
| min_qty | INTEGER | Minimum quantity threshold |
| image_id | VARCHAR(255) | Image file reference |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### 3. `stock_inventory`
Junction table linking items to warehouses with quantities.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| stock_item_id | INTEGER | FK to `stock_items` |
| warehouse_id | INTEGER | FK to `warehouses` |
| qty | INTEGER | Quantity at this warehouse |
| position | VARCHAR(50) | Shelf/location code (e.g., "A1-B5") |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Unique constraint:** `(stock_item_id, warehouse_id)` - One item can only have one record per warehouse.

### Changed Tables

- **`stock`** table → **DELETED** (replaced by `stock_items` + `stock_inventory`)
- **`location_stock`** table → **DELETED** (replaced by `warehouses`)
- **`category_stock`** → **NO CHANGES**
- **`supplier`** → **NO CHANGES**

---

## Key Concepts

### Total Quantity
The total quantity of an item is calculated by **summing** all quantities across all warehouses:
```sql
SELECT SUM(qty) FROM stock_inventory WHERE stock_item_id = <item_id>
```

### Position Codes
Each inventory record can have a `position` field (e.g., "AB-ZZ", "A1-B5") to specify the exact location within the warehouse.

### Inventory Operations
1. **Set** - Replace quantity at warehouse
2. **Add** - Increment quantity at warehouse
3. **Transfer** - Move stock between warehouses (atomic operation)

---

## API Endpoints

### Base URL
All endpoints are prefixed with `/stock`

**Authentication:** All endpoints require authentication token via `autenticarToken` middleware.

---

## 1. Warehouses

### GET `/stock/warehouses`
List all warehouses.

**Response:**
```json
{
  "documents": [
    {
      "$id": "1",
      "name": "Warehouse A",
      "description": "Main central warehouse",
      "address": "Rua Principal 123, Lisboa",
      "is_active": true,
      "$createdAt": "2024-01-15T10:30:00.000Z",
      "$updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 1
}
```

### GET `/stock/warehouses/:id`
Get single warehouse details.

**Response:**
```json
{
  "$id": "1",
  "name": "Warehouse A",
  "description": "Main central warehouse",
  "address": "Rua Principal 123, Lisboa",
  "is_active": true,
  "$createdAt": "2024-01-15T10:30:00.000Z",
  "$updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### POST `/stock/warehouses`
Create new warehouse.

**Request Body:**
```json
{
  "name": "Warehouse C",
  "description": "Cold storage facility",
  "address": "Rua Fria 789, Porto",
  "is_active": true
}
```

**Response:** Same as GET single warehouse (201 Created)

### PUT `/stock/warehouses/:id`
Update warehouse details.

**Request Body:** (all fields optional)
```json
{
  "name": "Warehouse C - Updated",
  "description": "New description",
  "address": "New address",
  "is_active": false
}
```

**Response:** Updated warehouse object

### DELETE `/stock/warehouses/:id`
Delete warehouse.

**Important:** Cannot delete a warehouse that has inventory. Must transfer or remove all items first.

**Response:**
```json
{
  "message": "Warehouse eliminado com sucesso"
}
```

**Error (400):**
```json
{
  "error": "Não é possível eliminar warehouse com inventário. Transfira ou remova os items primeiro."
}
```

---

## 2. Stock Items

### GET `/stock/items`
List all stock items with **aggregated total quantities**.

**Response:**
```json
{
  "documents": [
    {
      "$id": "1",
      "name": "Ice Tea Lipton",
      "category": "Beverages",
      "description": "Lipton Ice Tea 500ml",
      "supplier_id": 1,
      "supplier_name": "Lipton Distributors",
      "cost_price": 1.50,
      "qty": 1700,  // Total across all warehouses
      "min_qty": 100,
      "num_warehouses": 3,  // Number of warehouses storing this item
      "image_id": "12345.jpg",
      "$createdAt": "2024-01-15T10:30:00.000Z",
      "$updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 1
}
```

### GET `/stock/items/:id`
Get single stock item with **warehouse breakdown**.

**Response:**
```json
{
  "$id": "1",
  "name": "Ice Tea Lipton",
  "category": "Beverages",
  "description": "Lipton Ice Tea 500ml",
  "supplier_id": 1,
  "supplier_name": "Lipton Distributors",
  "cost_price": 1.50,
  "qty": 1700,
  "min_qty": 100,
  "image_id": "12345.jpg",
  "$createdAt": "2024-01-15T10:30:00.000Z",
  "$updatedAt": "2024-01-15T10:30:00.000Z",
  "warehouses": [
    {
      "inventory_id": "1",
      "warehouse_id": "1",
      "warehouse_name": "Warehouse A",
      "qty": 1000,
      "position": "A1-B5",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "inventory_id": "2",
      "warehouse_id": "2",
      "warehouse_name": "Warehouse B",
      "qty": 200,
      "position": "C3-D7",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "inventory_id": "3",
      "warehouse_id": "3",
      "warehouse_name": "Warehouse C",
      "qty": 500,
      "position": "E2-F4",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### POST `/stock/items`
Create new stock item with initial inventory distribution.

**Request Body:**
```json
{
  "name": "Orange Juice",
  "category": "Beverages",
  "description": "Fresh orange juice 1L",
  "supplier_id": 5,
  "cost_price": 2.50,
  "min_qty": 120,
  "image_id": "orange.jpg",
  "inventory": [
    {
      "warehouse_id": 1,
      "qty": 500,
      "position": "B3-C2"
    },
    {
      "warehouse_id": 2,
      "qty": 300,
      "position": "D3-E2"
    }
  ]
}
```

**Notes:**
- `inventory` array is optional - you can create an item without initial stock
- `supplier_id` is the ID from the `supplier` table
- Each inventory entry requires `warehouse_id` and `qty`
- `position` is optional

**Response:** Created item with warehouse breakdown (201 Created)

### PUT `/stock/items/:id`
Update stock item **basic information only** (NOT inventory).

**Request Body:** (all fields optional)
```json
{
  "name": "Ice Tea Lipton - Updated",
  "category": "Beverages",
  "description": "New description",
  "supplier_id": 2,
  "cost_price": 1.75,
  "min_qty": 150,
  "image_id": "newimage.jpg"
}
```

**Important:** This endpoint does NOT update inventory quantities. Use the inventory endpoints below for that.

**Response:** Updated item object

### DELETE `/stock/items/:id`
Delete stock item.

**Behavior:**
- Automatically deletes all associated inventory records (CASCADE)
- Deletes associated image file if exists

**Response:**
```json
{
  "message": "Item eliminado com sucesso"
}
```

---

## 3. Inventory Management

### GET `/stock/items/:id/inventory`
Get inventory breakdown for a specific item across all warehouses.

**Response:**
```json
{
  "documents": [
    {
      "$id": "1",
      "warehouse_id": "1",
      "warehouse_name": "Warehouse A",
      "warehouse_description": "Main central warehouse",
      "qty": 1000,
      "position": "A1-B5",
      "$createdAt": "2024-01-15T10:30:00.000Z",
      "$updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "$id": "2",
      "warehouse_id": "2",
      "warehouse_name": "Warehouse B",
      "warehouse_description": "Secondary storage",
      "qty": 200,
      "position": "C3-D7",
      "$createdAt": "2024-01-15T10:30:00.000Z",
      "$updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 2
}
```

### POST `/stock/items/:id/inventory`
Add or update inventory for an item at a specific warehouse.

**Request Body:**
```json
{
  "warehouse_id": 1,
  "qty": 100,
  "position": "A1-B5",
  "operation": "add"  // or "set" (default)
}
```

**Operations:**
- **`set`** (default): Replace the quantity at the warehouse with the specified value
- **`add`**: Add the quantity to the existing quantity at the warehouse

**Examples:**

**Set Operation:**
```json
{
  "warehouse_id": 1,
  "qty": 500,
  "position": "A1-B5",
  "operation": "set"
}
```
Result: Warehouse 1 will have exactly 500 units

**Add Operation:**
```json
{
  "warehouse_id": 1,
  "qty": 100,
  "position": "A1-B5",
  "operation": "add"
}
```
Result: If warehouse had 500, it will now have 600 units

**Response:** (201 Created)
```json
{
  "$id": "1",
  "stock_item_id": "5",
  "warehouse_id": "1",
  "warehouse_name": "Warehouse A",
  "qty": 500,
  "position": "A1-B5",
  "$createdAt": "2024-01-15T10:30:00.000Z",
  "$updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### PUT `/stock/items/:id/inventory/:warehouse_id`
Update inventory details at a specific warehouse.

**Request Body:** (all fields optional)
```json
{
  "qty": 450,
  "position": "A2-B6"
}
```

**Response:** Updated inventory object

### DELETE `/stock/items/:id/inventory/:warehouse_id`
Remove all inventory of an item from a specific warehouse.

**Response:**
```json
{
  "message": "Inventory removido com sucesso"
}
```

### POST `/stock/items/:id/transfer`
Transfer stock between warehouses (atomic operation).

**Request Body:**
```json
{
  "from_warehouse_id": 1,
  "to_warehouse_id": 2,
  "qty": 100
}
```

**Validations:**
- Source and destination warehouses must be different
- Source warehouse must have sufficient quantity
- Quantity must be greater than zero

**Behavior:**
- Decreases quantity at source warehouse
- Increases quantity at destination warehouse (creates record if doesn't exist)
- If source quantity becomes 0, the inventory record is deleted
- **Transaction-safe**: Either both operations succeed or both fail

**Response:**
```json
{
  "message": "Transferência realizada com sucesso",
  "transfer": {
    "stock_item_id": "1",
    "from_warehouse_id": "1",
    "from_warehouse_name": "Warehouse A",
    "to_warehouse_id": "2",
    "to_warehouse_name": "Warehouse B",
    "qty": 100,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
```json
{
  "error": "Item não existe no warehouse de origem"
}
```
```json
{
  "error": "Quantidade insuficiente no warehouse de origem (disponível: 50)"
}
```

---

## 4. Categories

### GET `/stock/categories`
List all stock categories.

**Response:**
```json
{
  "documents": [
    {
      "$id": "1",
      "name": "Beverages",
      "category": "Beverages",  // backwards compatibility
      "description": "Drinks and beverages",
      "$createdAt": "2024-01-15T10:30:00.000Z",
      "$updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 1
}
```

### POST `/stock/categories`
Create new category.

**Request Body:**
```json
{
  "name": "Condiments",
  "description": "Sauces and seasonings"
}
```

**Response:** Created category (201 Created)

---

## 5. Suppliers

### GET `/stock/suppliers`
List all suppliers.

**Response:**
```json
{
  "documents": [
    {
      "$id": "1",
      "name": "Lipton Distributors",
      "supplier": "Lipton Distributors",  // backwards compatibility
      "contact_name": "João Silva",
      "email": "joao@lipton.pt",
      "phone": "+351 21 123 4567",
      "address": "Lisboa",
      "notes": "Main tea supplier",
      "$createdAt": "2024-01-15T10:30:00.000Z",
      "$updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 1
}
```

### POST `/stock/suppliers`
Create new supplier.

**Request Body:**
```json
{
  "name": "Delta Cafés",
  "contact_name": "Ana Costa",
  "email": "ana@deltacafes.pt",
  "phone": "+351 24 456 7890",
  "address": "Campo Maior",
  "notes": "Coffee supplier"
}
```

**Response:** Created supplier (201 Created)

---

## 6. Images

### POST `/stock/upload-image`
Upload stock item image.

**Request Body:**
```json
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "filename": "product.jpg"
}
```

**Response:**
```json
{
  "$id": "1736952345_stock_abc123.jpg",
  "filename": "1736952345_stock_abc123.jpg",
  "url": "/files/imagens-stock/1736952345_stock_abc123.jpg",
  "message": "Imagem de stock carregada com sucesso"
}
```

### GET `/stock/image/:imageId`
Get/download stock image.

**Response:** Image file (binary)

### DELETE `/stock/image/:imageId`
Delete stock image.

**Response:**
```json
{
  "message": "Imagem eliminada com sucesso"
}
```

---

## 7. Statistics & Analytics

### GET `/stock/stats`
Get overall stock statistics.

**Response:**
```json
{
  "total_items": 10,
  "critical_stock": 2,   // Items at or below min_qty
  "warning_stock": 3,    // Items between min_qty and min_qty+5
  "ok_stock": 5,         // Items above min_qty+5
  "total_stock_value": 12500.50  // Sum of (qty * cost_price) across all items
}
```

### GET `/stock/alerts`
Get items with critical or warning stock levels.

**Response:**
```json
{
  "documents": [
    {
      "$id": "1",
      "name": "Ice Tea Lipton",
      "category": "Beverages",
      "supplier_name": "Lipton Distributors",
      "qty": 80,
      "min_qty": 100,
      "status": "critical",  // or "warning"
      "$createdAt": "2024-01-15T10:30:00.000Z",
      "$updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 1
}
```

**Status Levels:**
- **`critical`**: qty ≤ min_qty
- **`warning`**: min_qty < qty ≤ min_qty + 5
- **`ok`**: qty > min_qty + 5

---

## WebSocket Events

The system emits real-time events via WebSocket. All stock-related events are sent to the `"stock"` room.

### Connection
Users automatically join the `"stock"` room upon WebSocket connection.

### Events

#### Stock Items
- **`stock:item:created`** - New item created
- **`stock:item:updated`** - Item updated
- **`stock:item:deleted`** - Item deleted
  ```json
  { "id": "1" }
  ```

#### Warehouses
- **`stock:warehouse:created`** - New warehouse created
- **`stock:warehouse:updated`** - Warehouse updated
- **`stock:warehouse:deleted`** - Warehouse deleted
  ```json
  { "id": "1" }
  ```

#### Inventory
- **`stock:inventory:updated`** - Inventory updated at warehouse
  ```json
  {
    "$id": "1",
    "stock_item_id": "5",
    "warehouse_id": "1",
    "warehouse_name": "Warehouse A",
    "qty": 500,
    "position": "A1-B5"
  }
  ```
- **`stock:inventory:deleted`** - Inventory removed from warehouse
  ```json
  {
    "stock_item_id": "1",
    "warehouse_id": "2"
  }
  ```
- **`stock:transfer`** - Stock transferred between warehouses
  ```json
  {
    "stock_item_id": "1",
    "from_warehouse_id": "1",
    "from_warehouse_name": "Warehouse A",
    "to_warehouse_id": "2",
    "to_warehouse_name": "Warehouse B",
    "qty": 100,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
  ```

#### Alerts
- **`stock:alert:created`** - Stock alert triggered (sent to both `"stock"` and `"gestores"` rooms)
  ```json
  {
    "$id": "1",
    "name": "Ice Tea Lipton",
    "qty": 80,
    "min_qty": 100,
    "status": "critical",
    "message": "Item \"Ice Tea Lipton\" está em nível crítico (80/100)"
  }
  ```

#### Categories & Suppliers (unchanged)
- `stock:category:created`
- `stock:category:updated`
- `stock:category:deleted`
- `stock:supplier:created`
- `stock:supplier:updated`
- `stock:supplier:deleted`

---

## Frontend Implementation Guide

### 1. Display Stock Items Table
**Endpoint:** `GET /stock/items`

Show aggregated view with total quantities:
```typescript
// Columns
- Name
- Category
- Supplier
- Total Qty (sum across warehouses)
- Min Qty
- # Warehouses
- Status (critical/warning/ok)
```

### 2. Item Detail View with Warehouse Breakdown
**Endpoint:** `GET /stock/items/:id`

Display warehouses as expandable sections or tabs:
```typescript
// Item Info
- Name, Category, Description, Supplier, Cost Price, Min Qty

// Warehouse Breakdown
For each warehouse in item.warehouses[]:
  - Warehouse Name
  - Quantity
  - Position (shelf location)
  - Actions: Edit Qty, Remove from Warehouse
```

### 3. Adding Stock to Warehouse
**Endpoint:** `POST /stock/items/:id/inventory`

UI Flow:
1. Select warehouse from dropdown
2. Enter quantity
3. Choose operation: "Set" or "Add"
4. Optionally enter position code
5. Submit

### 4. Transferring Stock
**Endpoint:** `POST /stock/items/:id/transfer`

UI Flow:
1. Select source warehouse (must have stock)
2. Select destination warehouse (different from source)
3. Enter quantity (validate against available qty)
4. Confirm transfer

### 5. Creating New Item
**Endpoint:** `POST /stock/items`

UI Flow:
1. Enter item details (name, category, supplier, etc.)
2. Add initial inventory (optional):
   - Select warehouse(s)
   - For each: enter qty and position
3. Submit

### 6. Warehouse Management
**Endpoints:**
- List: `GET /stock/warehouses`
- Create: `POST /stock/warehouses`
- Update: `PUT /stock/warehouses/:id`
- Delete: `DELETE /stock/warehouses/:id` (only if empty)

---

## Migration Notes

### Breaking Changes
1. **Removed Tables:**
   - `stock` → Use `stock_items` + `stock_inventory`
   - `location_stock` → Use `warehouses`

2. **Changed Fields:**
   - `stock.location` (text) → `warehouses.id` (FK)
   - `stock.qty` (single value) → `SUM(stock_inventory.qty)` (aggregated)
   - `stock.supplier` (text) → `stock_items.supplier_id` (FK to `supplier`)

3. **New Concepts:**
   - Items can exist in multiple warehouses
   - Each warehouse location has its own quantity
   - Position codes for shelf locations

### Backwards Compatibility
- API response format uses `$id`, `$createdAt`, `$updatedAt` for consistency
- Supplier and category endpoints remain unchanged
- Image upload/management unchanged

---

## Common Use Cases

### 1. Receiving Stock Shipment
```javascript
// Add 500 units to Warehouse A at position C1-D2
POST /stock/items/1/inventory
{
  "warehouse_id": 1,
  "qty": 500,
  "position": "C1-D2",
  "operation": "add"
}
```

### 2. Moving Stock for Fulfillment
```javascript
// Transfer 100 units from Warehouse A to Warehouse B
POST /stock/items/1/transfer
{
  "from_warehouse_id": 1,
  "to_warehouse_id": 2,
  "qty": 100
}
```

### 3. Stock Taking / Adjustment
```javascript
// After physical count, set exact quantity
PUT /stock/items/1/inventory/1
{
  "qty": 487,  // Actual counted quantity
  "position": "A1-B5"
}
```

### 4. Opening New Warehouse
```javascript
// 1. Create warehouse
POST /stock/warehouses
{
  "name": "Warehouse D",
  "description": "New expansion facility",
  "address": "New Location"
}

// 2. Transfer stock from existing warehouse
POST /stock/items/1/transfer
{
  "from_warehouse_id": 1,
  "to_warehouse_id": 4,  // New warehouse
  "qty": 500
}
```

---

## Error Handling

### Common Error Codes

**400 Bad Request**
```json
{
  "error": "warehouse_id é obrigatório"
}
```

**404 Not Found**
```json
{
  "error": "Item não encontrado"
}
```

**400 Validation Error**
```json
{
  "error": "Quantidade insuficiente no warehouse de origem (disponível: 50)"
}
```

**409 Conflict**
```json
{
  "error": "Warehouse com esse nome já existe"
}
```

---

## Testing & Mock Data

The migration script (`migrate_stock_schema.sql`) includes comprehensive mock data:
- 3 warehouses (A, B, C)
- 10 different products
- 23 inventory records
- 8 suppliers

You can use this data for testing the frontend implementation.

---

## Questions & Support

For any questions about the API or implementation, contact the backend team or refer to the source code in `src/rotas/stock.js`.
