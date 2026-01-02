import { useEffect, useRef, useContext } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { NotificationContext } from "../contexts/NotificationContext";
import { getNotificationTemplate } from "../lib/notificationTemplates";

/**
 * Debounce helper to prevent notification spam
 * Prevents multiple notifications of the same type within a time window
 */
const createDebouncer = () => {
  const lastNotificationTime = new Map();
  const DEBOUNCE_WINDOW = 1000; // 1 second

  return (eventType, callback) => {
    const now = Date.now();
    const lastTime = lastNotificationTime.get(eventType) || 0;

    if (now - lastTime > DEBOUNCE_WINDOW) {
      lastNotificationTime.set(eventType, now);
      callback();
      return true;
    }
    return false;
  };
};

/**
 * Custom hook to subscribe to WebSocket events and display notifications
 * This hook should be called once at the app level (in pagina-teste-new)
 */
export const useNotifications = () => {
  const { socket, connected } = useWebSocketContext();
  const context = useContext(NotificationContext);
  const debouncerRef = useRef(createDebouncer());

  useEffect(() => {
    if (!context) {
      return;
    }

    if (!socket || !connected) {
      return;
    }

    const { addNotification } = context;
    const debouncer = debouncerRef.current;

    // ==================== ORDER EVENTS ====================
    const handleOrderCreated = (order) => {
      debouncer("order:created", () => {
        try {
          const template = getNotificationTemplate("order:created", order);
          addNotification(template);
        } catch (error) {
          console.error("Error creating order notification:", error);
        }
      });
    };

    // ==================== TAKEAWAY EVENTS ====================
    const handleTakeawayCreated = (order) => {
      debouncer("takeaway:created", () => {
        try {
          const template = getNotificationTemplate("takeaway:created", order);
          addNotification(template);
        } catch (error) {
          console.error("Error creating takeaway notification:", error);
        }
      });
    };

    // ==================== RESERVATION EVENTS ====================
    const handleReservationCreated = (reservation) => {
      debouncer("reservation:created", () => {
        try {
          const template = getNotificationTemplate(
            "reservation:created",
            reservation
          );
          addNotification(template);
        } catch (error) {
          console.error("Error creating reservation notification:", error);
        }
      });
    };

    // ==================== MENU EVENTS ====================
    const handleMenuCreated = (item) => {
      debouncer("menu:created", () => {
        try {
          const template = getNotificationTemplate("menu:created", item);
          addNotification(template);
        } catch (error) {
          console.error("Error creating menu notification:", error);
        }
      });
    };

    // ==================== ATTENDANCE EVENTS ====================
    const handlePresencaRegistada = (data) => {
      // Use unique key per user to allow multiple users clocking in simultaneously
      const debounceKey = `presenca:${data.user_id || data.id}`;
      debouncer(debounceKey, () => {
        try {
          const template = getNotificationTemplate("presenca:registada", data);
          addNotification(template);
        } catch (error) {
          console.error("Error creating attendance notification:", error);
        }
      });
    };

    // ==================== STOCK EVENTS (OPTIONAL) ====================
    const handleStockAlert = (alert) => {
      debouncer("stock:alert:created", () => {
        try {
          const template = getNotificationTemplate(
            "stock:alert:created",
            alert
          );
          addNotification(template);
        } catch (error) {
          console.error("Error creating stock alert notification:", error);
        }
      });
    };

    const handleStockInventoryUpdated = (inventory) => {
      debouncer(`stock:inventory:updated:${inventory.stock_item_id}`, () => {
        try {
          const template = getNotificationTemplate(
            "stock:inventory:updated",
            inventory
          );
          addNotification(template);
        } catch (error) {
          console.error("Error creating stock inventory notification:", error);
        }
      });
    };

    // ==================== ORDER UPDATE EVENTS ====================
    const handleOrderUpdated = (order) => {
      // Only notify for important status changes
      const status = order.status || order.order_status;
      if (status === "preparing" || status === "ready") {
        debouncer(`order:updated:${order.id}`, () => {
          try {
            const template = getNotificationTemplate("order:updated", order);
            if (template) addNotification(template);
          } catch (error) {
            console.error("Error creating order update notification:", error);
          }
        });
      }
    };

    // ==================== TAKEAWAY UPDATE EVENTS ====================
    const handleTakeawayUpdated = (order) => {
      const status = order.status || order.order_status;
      if (status === "ready") {
        debouncer(`takeaway:updated:${order.id}`, () => {
          try {
            const template = getNotificationTemplate("takeaway:updated", order);
            if (template) addNotification(template);
          } catch (error) {
            console.error(
              "Error creating takeaway update notification:",
              error
            );
          }
        });
      }
    };

    // ==================== PAYMENT EVENTS ====================
    const handlePaymentCreated = (payment) => {
      debouncer("payment:created", () => {
        try {
          const template = getNotificationTemplate("payment:created", payment);
          addNotification(template);
        } catch (error) {
          console.error("Error creating payment notification:", error);
        }
      });
    };

    // ==================== RESERVATION UPDATE EVENTS ====================
    const handleReservationUpdated = (reservation) => {
      if (
        reservation.status === "confirmed" ||
        reservation.status === "cancelled"
      ) {
        debouncer(`reservation:updated:${reservation.id}`, () => {
          try {
            const template = getNotificationTemplate(
              "reservation:updated",
              reservation
            );
            if (template) addNotification(template);
          } catch (error) {
            console.error(
              "Error creating reservation update notification:",
              error
            );
          }
        });
      }
    };

    // ==================== TABLE UPDATE EVENTS ====================
    const handleTableUpdated = (table) => {
      if (table.status || table.table_status) {
        debouncer(`table:updated:${table.id}`, () => {
          try {
            const template = getNotificationTemplate("table:updated", table);
            if (template) addNotification(template);
          } catch (error) {
            console.error("Error creating table update notification:", error);
          }
        });
      }
    };

    // ==================== SUBSCRIBE TO EVENTS ====================
    socket.on("order:created", handleOrderCreated);
    socket.on("order:updated", handleOrderUpdated);
    socket.on("takeaway:created", handleTakeawayCreated);
    socket.on("takeaway:updated", handleTakeawayUpdated);
    socket.on("reservation:created", handleReservationCreated);
    socket.on("reservation:updated", handleReservationUpdated);
    socket.on("menu:created", handleMenuCreated);
    socket.on("presenca:registada", handlePresencaRegistada);
    socket.on("stock:alert:created", handleStockAlert);
    socket.on("stock:inventory:updated", handleStockInventoryUpdated);
    socket.on("payment:created", handlePaymentCreated);
    socket.on("table:updated", handleTableUpdated);

    // ==================== CLEANUP ====================
    return () => {
      socket.off("order:created", handleOrderCreated);
      socket.off("order:updated", handleOrderUpdated);
      socket.off("takeaway:created", handleTakeawayCreated);
      socket.off("takeaway:updated", handleTakeawayUpdated);
      socket.off("reservation:created", handleReservationCreated);
      socket.off("reservation:updated", handleReservationUpdated);
      socket.off("menu:created", handleMenuCreated);
      socket.off("presenca:registada", handlePresencaRegistada);
      socket.off("stock:alert:created", handleStockAlert);
      socket.off("stock:inventory:updated", handleStockInventoryUpdated);
      socket.off("payment:created", handlePaymentCreated);
      socket.off("table:updated", handleTableUpdated);
    };
  }, [socket, connected, context]);
};
