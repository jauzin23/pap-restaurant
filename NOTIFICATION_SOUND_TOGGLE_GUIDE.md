# Notification Sound Toggle - Usage Guide

## Overview

The `NotificationSoundToggle` component allows users to enable/disable notification sounds. This is an optional component that can be placed in your navigation bar or settings panel.

## Installation

The component is already created at:

```
src/components/NotificationSoundToggle.jsx
```

## Usage

### Option 1: Add to Sidebar (Recommended)

Add the toggle button to the Sidebar component for easy access:

```jsx
// In src/app/components/Sidebar.jsx

import NotificationSoundToggle from "../../components/NotificationSoundToggle";

// Inside the Sidebar component, add to the navigation area:
<div className="sidebar-controls">
  <NotificationSoundToggle />
  {/* Other controls */}
</div>;
```

### Option 2: Add to Top Navigation

```jsx
// In your navigation component

import NotificationSoundToggle from "../components/NotificationSoundToggle";

<nav className="top-nav">
  <div className="nav-actions">
    <NotificationSoundToggle />
    {/* Other action buttons */}
  </div>
</nav>;
```

### Option 3: Add to Settings Panel

```jsx
// In your settings/preferences component

import NotificationSoundToggle from "../../components/NotificationSoundToggle";

<div className="settings-section">
  <h3>Notificações</h3>
  <div className="setting-item">
    <label>Sons de Notificação</label>
    <NotificationSoundToggle />
  </div>
</div>;
```

## Features

- **Visual Feedback**: Green icon when enabled, gray when disabled
- **Hover Effect**: Background changes on hover
- **Persistent**: Preference saved to localStorage
- **Accessible**: Includes title attribute for tooltips
- **Lightweight**: No external dependencies

## Customization

You can customize the component styling by modifying the inline styles or extracting them to a CSS file:

```jsx
// Custom styling example
<NotificationSoundToggle
  style={{
    background: "your-color",
    padding: "your-padding",
    // ... other styles
  }}
/>
```

## API

The component uses the following utility functions from `src/lib/notificationSound.js`:

- `isNotificationSoundEnabled()` - Check current sound state
- `setNotificationSoundEnabled(boolean)` - Enable/disable sounds

## Default Behavior

- Sounds are **enabled by default**
- User preference is saved to `localStorage` with key `mesa_notification_sound`
- Preference persists across browser sessions

## Testing

To test the sound toggle:

1. Add the component to your UI
2. Click the toggle button
3. Trigger a notification (via WebSocket event)
4. Verify sound plays or doesn't play based on toggle state

## Notes

- Sounds use the Web Audio API (no audio files needed)
- Graceful fallback if browser doesn't support Web Audio API
- Each notification type has a different frequency/tone
- Sound duration is short (150ms) to be non-intrusive
