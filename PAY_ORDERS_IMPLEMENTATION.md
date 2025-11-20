# Pay Orders Component - Implementation Summary

## Overview

Created a new "Pagamentos" (Payments) tab for the pagina-teste-new page that allows users to view unpaid orders, select multiple orders from multiple tables, and process payments.

## Files Created/Modified

### New Files:

1. **`src/app/components/PayOrdersComponent.jsx`**

   - Main payment component with all payment functionality
   - Features:
     - View all unpaid orders grouped by table
     - Select multiple orders from multiple tables
     - Search and filter orders by status, table, or keywords
     - Process payments with multiple payment methods (cash, card, MB Way)
     - Support for tips and discounts
     - Real-time updates via WebSocket
     - Payment calculation with tax (10%)
     - Change calculation for cash payments

2. **`src/app/components/PayOrdersComponent.scss`**
   - Styling for the PayOrders component
   - Follows the same 1.5rem border-radius white-based aesthetic as MenuComponent and StockComponent
   - Fully responsive design
   - Smooth animations and transitions

### Modified Files:

1. **`src/app/pagina-teste-new/page.jsx`**

   - Added import for PayOrdersComponent
   - Added "Pagamentos" to the navigation logic
   - Renders PayOrdersComponent when activeNavItem === "Pagamentos"

2. **`src/app/components/Sidebar.jsx`**
   - Added "Pagamentos" menu item with DollarSign icon
   - Positioned between "Stock" and "Staff" (Pessoal)

## Features

### Order Management

- **Grouped Display**: Orders are grouped by table combination (single table or multi-table orders)
- **Search**: Search by menu item name, table number, or order notes
- **Filters**: Filter by order status (pendente, aceite, pronto, a ser entregue, entregue) or by specific table
- **Selection**: Select individual orders or all orders from a table group
- **Expandable Groups**: Click to expand/collapse order groups to see individual items

### Payment Processing

- **Multiple Payment Methods**:

  - Cash (Dinheiro) - with change calculation
  - Card (Cartão)
  - MB Way

- **Payment Features**:

  - Automatic tax calculation (10%)
  - Optional tips (gorjeta)
  - Optional discounts (fixed amount or percentage)
  - Payment notes
  - Real-time payment calculation before confirmation

- **Payment Summary**:
  - Subtotal
  - Tax amount
  - Discount (if applicable)
  - Tip (if applicable)
  - Total amount
  - Change calculation (for cash payments)

### Real-time Updates

- WebSocket integration for live order updates
- Automatic removal of paid orders from the list
- Updates when orders are created, updated, or deleted
- Payment confirmation notifications

### User Experience

- Clean, modern UI matching the app's design language
- Smooth animations and transitions
- Loading states
- Success/error feedback
- Responsive design for mobile and desktop
- Keyboard-friendly with proper form controls

## API Integration

### Endpoints Used:

- `GET /api/orders` - Fetch all unpaid orders
- `GET /api/menu` - Fetch menu items for display
- `GET /api/tables` - Fetch table information
- `POST /api/payments/calculate` - Calculate payment totals before confirmation
- `POST /api/payments` - Process payment

### WebSocket Events:

- `order:created` - New order created
- `order:updated` - Order status updated
- `order:deleted` - Order deleted
- `orders:paid` - Orders marked as paid
- `payment:created` - Payment processed

## Technical Details

### State Management

- React hooks for local state
- WebSocket context for real-time updates
- Efficient memoization with useMemo for filtered data

### Data Flow

1. Load orders, menu items, and tables on mount
2. Filter and group orders by table combination
3. User selects orders to pay
4. Calculate payment totals with tax, tips, and discounts
5. Process payment through API
6. WebSocket broadcasts payment to all clients
7. Orders are removed from active list and moved to historical table

### Payment Processing Flow

1. User selects one or more orders
2. Clicks "Pagar Selecionados" button
3. Payment modal opens with order summary
4. User selects payment method
5. For cash: enters amount received
6. Optional: adds tip and/or discount
7. System calculates total with tax
8. User confirms payment
9. API processes payment and creates payment record
10. Orders moved from `order_items` to `paid_order_items` table
11. WebSocket notifies all clients
12. Success message displayed

## Database Tables Used

### Active Tables:

- `order_items` - Active unpaid orders
- `menu` - Menu item details
- `tables` - Table information
- `users` - User information for payment processing

### Historical Tables:

- `paid_order_items` - Archive of paid orders
- `payments` - Payment records
- `payment_items` - Individual items in each payment
- `payment_history` - Audit trail of payment actions

## Styling

### Design System

- Border radius: 1.5rem (24px) for main containers
- Border radius: 1rem-1.25rem for inner elements
- Color palette:
  - Primary: #ff6b35 (Mesa+ orange)
  - Background: white
  - Borders: #e9ecef, #dee2e6
  - Text: #1a1a1a (primary), #6c757d (secondary)
- Shadows: Subtle, layered shadows for depth
- Transitions: 0.2s for smooth interactions

### Component Structure

```
.pay-orders-container
  ├── .page-header (with icon and actions)
  ├── .filters-bar (search and filters)
  └── .orders-content
      └── .orders-groups
          └── .order-group
              ├── .group-header
              └── .group-orders
                  └── .order-item
```

### Modal Structure

```
.modal-backdrop
  └── .payment-modal
      ├── .modal-header
      ├── .modal-content
      │   ├── Payment method selection
      │   ├── Cash received input
      │   ├── Tip input
      │   ├── Discount controls
      │   ├── Notes textarea
      │   └── Payment summary
      └── .modal-footer (action buttons)
```

## Future Enhancements (Optional)

1. **Split Payments**: Allow splitting a single order between multiple payment methods
2. **Print Receipts**: Generate PDF receipts for payments
3. **Payment History**: View and search past payments
4. **Refund Functionality**: Process refunds for completed payments
5. **Payment Analytics**: Dashboard showing payment statistics
6. **Customer Accounts**: Link payments to customer loyalty accounts
7. **Gift Cards/Vouchers**: Support for gift card payments
8. **Multi-Currency**: Support for different currencies
9. **Payment Scheduling**: Schedule payments for later
10. **Batch Operations**: Bulk payment processing for multiple table groups

## Testing Checklist

- [ ] Orders load correctly
- [ ] Search and filters work
- [ ] Order selection (single and multiple)
- [ ] Group selection works
- [ ] Payment modal opens with correct data
- [ ] Payment method selection
- [ ] Cash received and change calculation
- [ ] Tip calculation
- [ ] Discount calculation (percentage and fixed)
- [ ] Payment processing successful
- [ ] WebSocket updates work
- [ ] Orders removed after payment
- [ ] Error handling for failed payments
- [ ] Responsive design on mobile
- [ ] Keyboard navigation
- [ ] Loading states display correctly

## Notes

- The component follows the same design patterns as MenuComponent and StockComponent
- All payments are recorded with full audit trail
- Orders are archived to `paid_order_items` table, not deleted
- Tax rate is currently hardcoded at 10% (TAXA_IMPOSTO in pagamentos.js)
- Payment numbers are auto-generated in format: PAY-YYYYMMDD-####
- WebSocket events ensure all users see real-time payment updates
