# Notification System Implementation Plan

## Executive Summary

Implementation of a real-time notification system for the Mesa+ restaurant management system. The system will display stackable notifications in the top-right corner of the screen for critical events across the entire application within `pagina-teste-new`.

## System Architecture Overview

### Components

1. **NotificationProvider** - Context provider for notification state management
2. **NotificationContainer** - UI component for rendering stacked notifications
3. **WebSocket Event Listeners** - Hooks into existing WebSocket infrastructure
4. **Backend Emitters** - Already exist, may need minor enhancements

---

## Phase 1: Core Infrastructure Setup (Foundation)

### 1.1 Create Notification Context & Provider

**Files to Create:**

- `src/contexts/NotificationContext.jsx`

**Implementation:**

- Create a context that manages notification state (list of active notifications)
- Store notification data: id, type, title, message, timestamp, duration
- Provide methods: `addNotification()`, `removeNotification()`, `clearAll()`
- Auto-dismiss timer functionality (default 5 seconds, configurable)
- Maximum notification limit (e.g., 5 visible at once, older ones dismissed automatically)

**Notification Types:**

```javascript
{
  id: string (uuid),
  type: 'order' | 'reservation' | 'menu' | 'attendance' | 'stock',
  title: string,
  message: string,
  timestamp: Date,
  duration: number (milliseconds),
  icon: ReactElement,
  color: string (theme color)
}
```

---

### 1.2 Create Notification UI Component

**Files to Create:**

- `src/components/notifications/NotificationContainer.jsx`
- `src/components/notifications/NotificationItem.jsx`
- `src/components/notifications/NotificationContainer.scss`

**Implementation:**

- Use Ant Design's `notification` API with custom configuration
- Positioned at `top-right` with proper z-index (above everything)
- Stackable notifications with smooth animations (slide-in from right)
- Each notification shows:
  - Icon (based on notification type)
  - Title
  - Message
  - Timestamp (relative time: "just now", "2m ago")
  - Close button
- Hover to pause auto-dismiss timer
- Simple, non-interactive display (no click actions)

**Ant Design Configuration:**

```javascript
import { notification } from "antd";

notification.config({
  placement: "topRight",
  duration: 5,
  maxCount: 5,
  rtl: false,
  top: 24,
});
```

---

### 1.3 Integrate into pagina-teste-new

**Files to Modify:**

- `src/app/pagina-teste-new/page.jsx`

**Changes:**

1. Wrap `RestaurantDashboardContent` with `NotificationProvider`
2. Notification system should be inside `WebSocketProvider` to access socket
3. Structure:

```jsx
<WebSocketProvider>
  <NotificationProvider>
    <RestaurantDashboardContent />
  </NotificationProvider>
</WebSocketProvider>
```

---

## Phase 2: WebSocket Event Listeners (Event Handling)

### 2.1 Create Notification Hook for WebSocket Events

**Files to Create:**

- `src/hooks/useNotifications.js`

**Implementation:**

- Custom hook that subscribes to WebSocket events
- Maps WebSocket events to notification types
- Filters events based on user role (managers see everything, staff see relevant)
- Debouncing logic to prevent notification spam

**Events to Monitor:**

#### Order Events

- `order:created` - New dine-in order
- `takeaway:created` - New takeaway order
- `order:updated` (only status changes to 'preparing' or 'ready')

#### Reservation Events

- `reservation:created` - New reservation made
- `reservation:updated` (only status changes or time changes within 1 hour)

#### Menu Events

- `menu:created` - New menu item added
- `menu:updated` (only price changes or availability changes)

#### Attendance Events (Clock In/Out)

- `presenca:registada` - Employee clocked in/out

#### Stock Events (Optional - Phase 3)

- `stock:alert:created` - Critical stock level alert

---

## Phase 3: Notification Templates & Formatting

### 3.1 Create Notification Templates

**Files to Create:**

- `src/lib/notificationTemplates.js`

**Templates for Each Event Type:**

#### New Order (Dine-In)

```javascript
{
  type: 'order',
  icon: <UtensilsCrossed />,
  color: '#ff6b35',
  title: 'Novo Pedido',
  message: `Mesa ${tableNumber} - ${itemCount} itens - €${total}`
}
```

#### New Takeaway

```javascript
{
  type: 'takeaway',
  icon: <Package />,
  color: '#4ECDC4',
  title: 'Novo Takeaway',
  message: `${customerName} - ${itemCount} itens - €${total}`
}
```

#### New Reservation

```javascript
{
  type: 'reservation',
  icon: <Calendar />,
  color: '#45B7D1',
  title: 'Nova Reserva',
  message: `${customerName} - ${guestCount} pessoas - ${formattedDate}`
}
```

#### New Menu Item

```javascript
{
  type: 'menu',
  icon: <UtensilsCrossed />,
  color: '#F7DC6F',
  title: 'Novo Item no Menu',
  message: `${itemName} - €${price}`
}
```

#### Clock In/Out

```javascript
{
  type: 'attendance',
  icon: <Clock />,
  color: tipo === 'entrada' ? '#52B788' : '#EF5350',
  title: tipo === 'entrada' ? 'Entrada Registada' : 'Saída Registada',
  message: `${employeeName} - ${formattedTime}`
}
```

---

## Phase 4: Sound & Visual Enhancements

### 4.1 Add Notification Sounds (Optional)

**Files to Create:**

- `public/sounds/notification-order.mp3`
- `public/sounds/notification-reservation.mp3`
- `public/sounds/notification-default.mp3`

**Implementation:**

- Play subtle sound on notification (can be toggled in settings)
- Different sounds for different notification types
- Volume control
- Respect browser autoplay policies

---

### 4.2 Browser Notifications (Optional - Future)

**Implementation:**

- Request browser notification permission
- Show browser notifications when app is in background
- Use Web Notification API
- Fallback to in-app only if permission denied

---

## Phase 5: User Preferences & Settings

### 5.1 Notification Settings UI

**Files to Create:**

- `src/components/notifications/NotificationSettings.jsx`

**Settings to Include:**

- Enable/disable notifications globally
- Enable/disable per notification type (orders, reservations, menu, attendance)
- Sound on/off
- Notification duration (3s, 5s, 10s, never auto-dismiss)
- Max visible notifications (3, 5, 10)

**Storage:**

- Save preferences to localStorage
- Key: `mesa_notification_preferences_${userId}`

---

### 5.2 Settings Integration

**Files to Modify:**

- Add settings button in top-right near profile
- Add settings modal/drawer
- Include notification settings section

---

## Phase 6: Testing & Optimization

### 6.1 Testing Checklist

- [ ] Multiple notifications appear stacked correctly
- [ ] Auto-dismiss works as expected
- [ ] Hover pauses auto-dismiss
- [ ] Click actions navigate correctly
- [ ] Close button removes notification
- [ ] WebSocket reconnection maintains notification state
- [ ] No duplicate notifications on rapid events
- [ ] Role-based filtering works correctly
- [ ] Mobile responsive design
- [ ] Performance with 10+ rapid notifications

---

### 6.2 Performance Optimizations

- Debounce rapid events (max 1 notification per event type per second)
- Limit notification history in memory (max 50)
- Use React.memo for NotificationItem
- Optimize re-renders with useMemo/useCallback
- Lazy load sounds

---

## Backend Modifications (If Needed)

### Current State Analysis

✅ **Already implemented in backend:**

- All major events already have WebSocket emitters
- Events are emitted to proper rooms ('pedidos', 'reservas', 'menu', 'presencas', 'gestores')
- Proper event naming conventions

### Potential Enhancements

#### 7.1 Add Event Metadata (Optional)

**Files to Modify:**

- `api/src/websocket/emissores.js`

**Enhancements:**

- Add `priority` field to events (low, normal, high, critical)
- Add `requiresAction` boolean flag
- Add `summary` field for quick notification display
- Add `actionUrl` for deep linking

**Example:**

```javascript
pedidoCriado: (pedido) => {
  const payload = {
    ...pedido,
    metadata: {
      priority: "high",
      requiresAction: true,
      summary: `Mesa ${pedido.table_id?.join(", ")} - ${
        pedido.items?.length
      } itens`,
      actionUrl: `/orders/${pedido.id}`,
      timestamp: new Date().toISOString(),
    },
  };
  io.to("pedidos").emit("order:created", payload);
  // ... rest of code
};
```

---

## Implementation Timeline

### Week 1: Foundation

- **Days 1-2:** Phase 1 (Core Infrastructure)
  - NotificationContext
  - NotificationContainer component
  - Integration into pagina-teste-new
- **Days 3-4:** Phase 2 (WebSocket Listeners)
  - useNotifications hook
  - Event subscription logic
  - Role-based filtering

### Week 2: Features & Polish

- **Days 5-6:** Phase 3 (Templates & Formatting)

  - All notification templates
  - Action handlers
  - Navigation integration

- **Day 7:** Phase 4 (Enhancements)
  - Sound effects
  - Animations refinement

### Week 3: Settings & Testing

- **Days 8-9:** Phase 5 (User Preferences)

  - Settings UI
  - localStorage integration

- **Days 10-11:** Phase 6 (Testing & Optimization)

  - Comprehensive testing
  - Performance optimization
  - Bug fixes

- **Day 12:** Phase 7 (Backend Enhancements - if needed)
  - Add metadata to events
  - Testing end-to-end

---

## Technical Specifications

### Dependencies

**Already Installed:**

- `antd` (v5.27.4) - Notification component
- `socket.io-client` (v4.8.1) - WebSocket client
- `lucide-react` - Icons
- `framer-motion` - Animations (optional)

**No new dependencies needed!**

### File Structure

```
src/
├── contexts/
│   ├── NotificationContext.jsx           [NEW]
│   └── WebSocketContext.jsx              [EXISTS]
├── hooks/
│   ├── useNotifications.js               [NEW]
│   └── useWebSocket.js                   [EXISTS]
├── components/
│   └── notifications/
│       ├── NotificationContainer.jsx     [NEW]
│       ├── NotificationItem.jsx          [NEW]
│       ├── NotificationSettings.jsx      [NEW]
│       └── NotificationContainer.scss    [NEW]
├── lib/
│   └── notificationTemplates.js          [NEW]
└── app/
    └── pagina-teste-new/
        └── page.jsx                      [MODIFY]

api/
└── src/
    └── websocket/
        └── emissores.js                  [OPTIONAL MODIFY]

public/
└── sounds/
    ├── notification-order.mp3            [NEW - OPTIONAL]
    ├── notification-reservation.mp3      [NEW - OPTIONAL]
    └── notification-default.mp3          [NEW - OPTIONAL]
```

---

## Code Examples

### Example: NotificationContext (Simplified)

```javascript
// src/contexts/NotificationContext.jsx
import React, { createContext, useContext, useState, useCallback } from "react";
import { notification } from "antd";
import { v4 as uuidv4 } from "uuid"; // or custom ID generator

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notificationData) => {
    const id = uuidv4();
    const newNotification = {
      id,
      timestamp: new Date(),
      duration: 5000,
      ...notificationData,
    };

    // Use Ant Design's notification API
    notification.open({
      key: id,
      message: newNotification.title,
      description: newNotification.message,
      icon: newNotification.icon,
      duration: newNotification.duration / 1000,
      placement: "topRight",
      style: {
        borderLeft: `4px solid ${newNotification.color}`,
      },
    });

    setNotifications((prev) => [...prev, newNotification].slice(-50)); // Keep last 50
  }, []);

  const removeNotification = useCallback((id) => {
    notification.close(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    notification.destroy();
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationContext must be used within NotificationProvider"
    );
  }
  return context;
};
```

### Example: useNotifications Hook

```javascript
// src/hooks/useNotifications.js
import { useEffect } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { useNotificationContext } from "../contexts/NotificationContext";
import { getNotificationTemplate } from "../lib/notificationTemplates";

export const useNotifications = () => {
  const { socket, connected } = useWebSocketContext();
  const { addNotification } = useNotificationContext();

  useEffect(() => {
    if (!socket || !connected) return;

    // New Order
    const handleOrderCreated = (order) => {
      const template = getNotificationTemplate("order:created", order);
      addNotification(template);
    };

    // New Takeaway
    const handleTakeawayCreated = (order) => {
      const template = getNotificationTemplate("takeaway:created", order);
      addNotification(template);
    };

    // New Reservation
    const handleReservationCreated = (reservation) => {
      const template = getNotificationTemplate(
        "reservation:created",
        reservation
      );
      addNotification(template);
    };

    // New Menu Item
    const handleMenuCreated = (item) => {
      const template = getNotificationTemplate("menu:created", item);
      addNotification(template);
    };

    // Clock In/Out
    const handlePresencaRegistada = (data) => {
      const template = getNotificationTemplate("presenca:registada", data);
      addNotification(template);
    };

    // Subscribe to events
    socket.on("order:created", handleOrderCreated);
    socket.on("takeaway:created", handleTakeawayCreated);
    socket.on("reservation:created", handleReservationCreated);
    socket.on("menu:created", handleMenuCreated);
    socket.on("presenca:registada", handlePresencaRegistada);

    // Cleanup
    return () => {
      socket.off("order:created", handleOrderCreated);
      socket.off("takeaway:created", handleTakeawayCreated);
      socket.off("reservation:created", handleReservationCreated);
      socket.off("menu:created", handleMenuCreated);
      socket.off("presenca:registada", handlePresencaRegistada);
    };
  }, [socket, connected, addNotification]);
};
```

---

## Advantages of This Approach

✅ **Leverages Existing Infrastructure:**

- Uses existing WebSocket connection
- Uses existing event emitters
- No backend changes required (unless optional enhancements)

✅ **Minimal Dependencies:**

- Uses already installed `antd` notification system
- No new packages needed
- Lightweight implementation

✅ **Role-Based & Contextual:**

- Managers see all events
- Staff see relevant events
- Personalized experience

✅ **User-Friendly:**

- Stackable notifications
- Auto-dismiss with hover-pause
- Click-to-action functionality
- Customizable settings

✅ **Performance Optimized:**

- Debouncing prevents spam
- Limited notification history
- React optimization best practices

✅ **Scalable:**

- Easy to add new notification types
- Template-based system
- Extensible with sounds, browser notifications, etc.

---

## Future Enhancements (Post-MVP)

1. **Notification History Panel**

   - View all past notifications
   - Mark as read/unread
   - Search & filter

2. **Browser Push Notifications**

   - When app is in background
   - Service Worker integration

3. **Email/SMS Notifications**

   - For critical events
   - Configurable thresholds

4. **Analytics Dashboard**

   - Notification engagement metrics
   - Most common notification types
   - Response times

5. **Smart Notifications**
   - AI-powered priority sorting
   - Predictive notifications
   - Pattern recognition

---

## Conclusion

This notification system will significantly enhance the real-time operational efficiency of the Mesa+ restaurant management system. By using existing infrastructure (WebSocket, Ant Design) and following a phased approach, we can deliver a robust, user-friendly notification system in approximately 2-3 weeks of development time.

The system is designed to be:

- **Non-intrusive** - stackable, auto-dismissing notifications
- **Contextual** - role-based filtering and personalized content
- **Actionable** - quick navigation to relevant sections
- **Extensible** - easy to add new notification types and features

**Recommended Start:** Phase 1 & 2 for MVP, then iterate with user feedback.
