/**
 * Notification sound utility
 * Provides subtle audio feedback for notifications
 */

let audioContext = null;
let soundEnabled = true;

/**
 * Initialize Web Audio API context
 */
const getAudioContext = () => {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return null;
    }
  }
  return audioContext;
};

/**
 * Play a simple notification beep using Web Audio API
 * This avoids needing actual audio files
 * @param {string} type - Notification type
 * @param {number} volume - Volume level (0.0 to 1.0)
 */
export const playNotificationSound = (type = "default", volume = 0.15) => {
  if (!soundEnabled) return;

  const context = getAudioContext();
  if (!context) return;

  try {
    // Create oscillator for tone
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    // Different frequencies for different notification types
    const frequencies = {
      order: 800,
      takeaway: 750,
      reservation: 850,
      menu: 700,
      attendance: 900,
      stock: 650,
      payment: 950,
      table: 700,
      default: 800,
    };

    oscillator.frequency.value = frequencies[type] || frequencies.default;
    oscillator.type = "sine";

    // Volume envelope for smooth sound
    const now = context.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.01); // Attack
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15); // Decay

    // Play the sound
    oscillator.start(now);
    oscillator.stop(now + 0.15);
  } catch (error) {
    // Silently handle sound playback errors
  }
};

/**
 * Enable/disable notification sounds
 */
export const setNotificationSoundEnabled = (enabled) => {
  soundEnabled = enabled;

  // Save preference to localStorage
  try {
    localStorage.setItem("mesa_notification_sound", enabled ? "1" : "0");
  } catch (e) {
    // Silently handle localStorage errors
  }
};

/**
 * Check if notification sounds are enabled
 */
export const isNotificationSoundEnabled = () => {
  try {
    const saved = localStorage.getItem("mesa_notification_sound");
    if (saved !== null) {
      soundEnabled = saved === "1";
    }
  } catch (e) {
    // localStorage not available
  }
  return soundEnabled;
};

// Initialize sound preference on load
if (typeof window !== "undefined") {
  isNotificationSoundEnabled();
}
