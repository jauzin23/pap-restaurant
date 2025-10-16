# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mesa+** is a comprehensive restaurant management system built with Next.js 15 and React 19. It manages tables, orders, staff, inventory, and provides gamification features for employee performance tracking.

## Technology Stack

- **Frontend**: Next.js 15.4.6 (App Router), React 19.1.0
- **Styling**: SCSS + Tailwind CSS (being migrated from Tailwind to pure SCSS)
- **Backend**: Dual system:
  - **Custom Express API** (localhost:3001) - New custom backend for advanced features
- **UI Libraries**: Radix UI, Framer Motion, Recharts, Ant Design
- **Language**: TypeScript/JavaScript (mixed codebase)

## Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Authentication Architecture

The project uses **dual authentication systems** (in transition):

### 1. Appwrite Authentication (Legacy)
- Configured in `src/lib/appwrite.js`
- Used by older components via `AppContext`
- Direct Appwrite SDK calls

### 2. Custom API Authentication (Current)
- Configured in `src/lib/api.js` and `src/lib/auth.js`
- Token-based authentication with localStorage
- Automatic token expiration handling
- Endpoints: `/auth/login`, `/auth/me`, `/auth/logout`

**Important**: When adding new features, use the **Custom API** system (`src/lib/api.js`), not Appwrite.

## Database Architecture

### Appwrite Collections
Database IDs and collection IDs are defined in `src/lib/appwrite.js`:

- `DBRESTAURANTE` - Main restaurant database
  - `COL_MENU` - Menu items
  - `COL_ORDERS` - Orders
  - `COL_TABLES` - Table layouts
  - `COL_STOCK` - Inventory
  - `COL_TAGS` - Menu tags
  - `COL_CATEGORY` - Menu categories
  - `COL_CATEGORY_STOCK` - Stock categories
  - `COL_SUPPLIER` - Suppliers
  - `LOCATION_STOCK` - Stock locations
  - `PAYMENT_METHODS` - Payment methods

- `DB_ATTENDANCE` - Staff management
  - `COL_ATTENDANCE` - Staff attendance records

### Custom Database Design
See `database-design.md` and `order-management-database.md` for complete SQL schemas:

- **Staff Management**: Complex attendance, absence tracking, and points system
- **Order Management**: Single-table design using `order_items` with status workflow:
  - `pendente` → `aceite` → `pronto` → `a ser entregue...` → `entregue` → `completo`
- **Gamification**: Automated points system (see `sistema-pontos.md`)

## Project Structure

```
src/
├── app/
│   ├── components/          # Reusable React components
│   │   ├── Header.jsx       # Main navigation header
│   │   ├── RestLayout.tsx   # Table layout visualization
│   │   ├── MenuComponent.jsx # Menu management
│   │   ├── StockComponent.jsx # Inventory management
│   │   ├── ManagerStaffView.jsx # Staff dashboard
│   │   └── Mesas.tsx        # Table management
│   ├── login/              # Authentication page
│   ├── order/[[...mesas]]/ # Dynamic order pages (catch-all routes)
│   ├── menu/               # Menu management
│   ├── stock/              # Inventory management
│   ├── pedidos/            # Orders view
│   ├── dash2/              # Dashboard v2
│   ├── staff-management/   # Staff management interface
│   └── page.jsx            # Main dashboard (root)
├── contexts/
│   └── AppContext.jsx      # Global app state (Appwrite)
└── lib/
    ├── appwrite.js         # Appwrite configuration (legacy)
    ├── api.js              # Custom API client (current)
    └── auth.js             # Authentication utilities (current)
```

## Key Architectural Patterns

### 1. Component Organization
- Mix of `.jsx` and `.tsx` files (migrating to TypeScript)
- Styles in separate `.scss` files colocated with components
- Client components use `"use client"` directive

### 2. State Management
- `AppContext` for Appwrite-based features
- Local component state with hooks
- No Redux/Zustand (kept simple)

### 3. Routing
- Next.js App Router with file-based routing
- Catch-all routes: `order/[[...mesas]]` for dynamic table orders
- Protected routes check authentication in page components

### 4. API Integration
Use the custom API client from `src/lib/api.js`:

```javascript
import { auth, orders, tables, users } from '@/lib/api';

// Authentication
const result = await auth.login(email, password);
const currentUser = await auth.get();

// Orders
const allOrders = await orders.list();
const tableOrders = await orders.getByTables(tableIds);
await orders.create(orderData);
await orders.createBatch(ordersArray);

// Tables
const allTables = await tables.list();
const layoutTables = await tables.getByLayout(layoutId);
```

### 5. Mobile Responsiveness
- Uses `react-responsive` with `useMediaQuery`
- Mobile users redirected to `/unsupported`
- Check: `const isMobile = useMediaQuery({ maxWidth: 640 })`

## Important Implementation Notes

### Order System
- **Single-table architecture**: All order items in one `order_items` table
- **Frontend grouping**: Group by `table_id` (dine-in) or `takeaway_group_id` (takeaway)
- **Status workflow**: Orders flow through 7 states from pending to completed
- See `order-management-database.md` for complete design

### Staff Gamification
- **Automatic points**: System tracks actions and assigns points automatically
- **Real-time updates**: Points calculated on every tracked action
- **Multiple roles**: Chef, waiter, hostess, cleaner, etc.
- See `sistema-pontos.md` for complete point rules

### Styling Migration
**Active migration**: Moving from Tailwind CSS to pure SCSS
- Prefer SCSS for new components
- When editing existing components, consider migrating Tailwind classes to SCSS
- Tailwind still configured in `tailwind.config.js` for compatibility

## API Environment Variables

```bash
# Required for Custom API
NEXT_PUBLIC_API_URL=http://localhost:3001

# Appwrite is hardcoded in src/lib/appwrite.js
# Endpoint: https://appwrite.jauzin23.com/v1
# Project: 689c99120038471811fa
```

## Common Workflows

### Adding a New Feature
1. Use the Custom API client (`src/lib/api.js`), not Appwrite
2. Create components in `src/app/components/`
3. Use SCSS for styling (create `.scss` file)
4. Add routes in `src/app/` following Next.js App Router patterns
5. Protect routes by checking auth in the page component

### Working with Orders
- Orders are item-based, not order-based (important!)
- Each item has its own status and assignment
- Kitchen sees individual items, waiters see grouped by table
- Use `orders.createBatch()` for multiple items

### Working with Tables
- Tables belong to layouts (`table_layouts`)
- Visual editor at `/RestLayout`
- Table status reflects order status
- Tables can be merged (same `table_id` for all items)

### Staff Management
- Attendance tracked automatically
- Points calculated by triggers/system events
- Multiple absence types with different penalties
- See `database-design.md` for complete staff schema

## Development Notes

### TODO List (from README.md)
Active work items to be aware of:
- Checkout functionality needs implementation
- Calculator for change/tips
- Notification and messaging system
- Reports generation
- Password reset page
- 404 page
- Daily insights with PDF export
- AI integration for insights
- Stock images implementation
- Table cleaning workflow
- Fix stock component (currently buggy)
- Save `entregadoEm` timestamp in orders
- Fix cash display on table orders

### Known Issues
- Stock component has bugs (see README.md line 29-30)
- Menu editing during layout edit needs fixing
- Sidebar doesn't close on click
- Order cash number display issue

## Code Style Preferences

- Use async/await over promises
- Functional components with hooks
- Clear prop destructuring
- Meaningful variable names
- Console.log for debugging (development)
- Comments in Portuguese are acceptable (bilingual codebase)

## Integration Points

### Appwrite Buckets
- `BUCKET_MENU_IMG` - Menu item images
- `BUCKET_STOCK_IMG` - Stock item images
- `BUCKET_USER_IMG` - User profile images
- Use `storage` from `src/lib/appwrite.js`

### Custom API Endpoints
- `/auth/*` - Authentication
- `/users/*` - User management
- `/orders/*` - Order management
- `/tables/*` - Table management
- `/table-layouts/*` - Layout management

## Testing Strategy

No formal test suite currently. When adding features:
- Manual testing in development
- Test authentication flows thoroughly
- Verify order state transitions
- Check mobile responsiveness
- Validate table layout changes don't break existing data


APPWRITE IS TO BE DITCHED