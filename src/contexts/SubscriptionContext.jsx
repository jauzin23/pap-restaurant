"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { client } from "@/lib/appwrite";

const SubscriptionContext = createContext();

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider"
    );
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const subscriptions = useRef(new Map());
  const debounceTimers = useRef(new Map());
  const callbacks = useRef(new Map());

  // Debounced callback execution to prevent rapid-fire updates
  const debounceCallback = useCallback((key, callback, delay = 500) => {
    // Clear existing timer
    if (debounceTimers.current.has(key)) {
      clearTimeout(debounceTimers.current.get(key));
    }

    // Set new timer
    const timer = setTimeout(() => {
      callback();
      debounceTimers.current.delete(key);
    }, delay);

    debounceTimers.current.set(key, timer);
  }, []);

  // Subscribe to a channel with automatic deduplication
  const subscribe = useCallback(
    (channel, callback, options = {}) => {
      const { debounce = true, debounceDelay = 500 } = options;

      // Create unique key for this subscription
      const key = `${channel}_${Date.now()}_${Math.random()}`;

      // Check if we already have a subscription for this channel
      let subscription = subscriptions.current.get(channel);

      if (!subscription) {
        // Create new subscription
        const unsubscribe = client.subscribe(channel, (response) => {
          // Get all callbacks for this channel
          const channelCallbacks = callbacks.current.get(channel) || new Map();

          // Execute all callbacks for this channel
          channelCallbacks.forEach((callbackInfo, callbackKey) => {
            const {
              callback: cb,
              debounce: shouldDebounce,
              debounceDelay: delay,
            } = callbackInfo;

            if (shouldDebounce) {
              debounceCallback(
                `${channel}_${callbackKey}`,
                () => cb(response),
                delay
              );
            } else {
              cb(response);
            }
          });
        });

        subscription = {
          unsubscribe,
          refCount: 0,
        };
        subscriptions.current.set(channel, subscription);
        callbacks.current.set(channel, new Map());
      }

      // Add callback to this channel
      const channelCallbacks = callbacks.current.get(channel);
      channelCallbacks.set(key, { callback, debounce, debounceDelay });

      // Increment reference count
      subscription.refCount++;

      // Return unsubscribe function
      return () => {
        const sub = subscriptions.current.get(channel);
        const channelCbs = callbacks.current.get(channel);

        if (sub && channelCbs) {
          // Remove this specific callback
          channelCbs.delete(key);
          sub.refCount--;

          // If no more callbacks for this channel, unsubscribe
          if (sub.refCount === 0) {
            if (sub.unsubscribe && typeof sub.unsubscribe === "function") {
              sub.unsubscribe();
            }
            subscriptions.current.delete(channel);
            callbacks.current.delete(channel);
          }
        }

        // Clear any pending debounce timer
        const timerKey = `${channel}_${key}`;
        if (debounceTimers.current.has(timerKey)) {
          clearTimeout(debounceTimers.current.get(timerKey));
          debounceTimers.current.delete(timerKey);
        }
      };
    },
    [debounceCallback]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all debounce timers
      debounceTimers.current.forEach((timer) => clearTimeout(timer));
      debounceTimers.current.clear();

      // Unsubscribe from all channels
      subscriptions.current.forEach((subscription) => {
        if (
          subscription.unsubscribe &&
          typeof subscription.unsubscribe === "function"
        ) {
          subscription.unsubscribe();
        }
      });
      subscriptions.current.clear();
      callbacks.current.clear();
    };
  }, []);

  const value = {
    subscribe,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
