// Centralized subscription channels to avoid duplication
export const SUBSCRIPTION_CHANNELS = {
  // Attendance subscriptions
  ATTENDANCE: (DB_ATTENDANCE, COL_ATTENDANCE) =>
    `databases.${DB_ATTENDANCE}.collections.${COL_ATTENDANCE}.documents`,

  // Tables subscriptions
  TABLES: (DATABASE_ID, COLLECTION_ID) =>
    `databases.${DATABASE_ID}.collections.${COLLECTION_ID}.documents`,

  // Orders subscriptions
  ORDERS: (DATABASE_ID, COL_ORDERS) =>
    `databases.${DATABASE_ID}.collections.${COL_ORDERS}.documents`,

  // Settings subscriptions
  SETTINGS: (DATABASE_ID, SETTINGS_COLLECTION_ID) =>
    `databases.${DATABASE_ID}.collections.${SETTINGS_COLLECTION_ID}.documents`,
};

// Helper function to check if event matches patterns
export const eventMatches = (events, patterns) => {
  return events.some((event) =>
    patterns.some(
      (pattern) => event.includes(pattern) || event.endsWith(pattern)
    )
  );
};

// Common event patterns
export const EVENT_PATTERNS = {
  CREATE: [".create"],
  UPDATE: [".update"],
  DELETE: [".delete"],
  ALL_CRUD: [".create", ".update", ".delete"],
};
