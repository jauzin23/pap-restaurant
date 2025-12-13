# Points Analytics API Endpoints

## New Analytics Endpoints

### 1. Points Timeline

**GET** `/api/points/analytics/timeline`

- **Query Params:** `period` (day/week/month/all), `month` (YYYY-MM), `days` (number)
- **Returns:** Points distribution over time with positive/negative breakdown

### 2. Top Actions Breakdown

**GET** `/api/points/analytics/actions`

- **Query Params:** `period`, `month`, `limit`
- **Returns:** Most common actions with counts and points

### 3. Active Days Comparison

**GET** `/api/points/analytics/active-days`

- **Query Params:** `period`, `month`
- **Returns:** Users ranked by active days

### 4. Points Velocity (Growth Rate)

**GET** `/api/points/analytics/velocity`

- **Query Params:** `period`
- **Returns:** Period-over-period growth rates for all users

### 5. Hourly Activity Pattern

**GET** `/api/points/analytics/hourly`

- **Query Params:** `period`, `month`
- **Returns:** Activity patterns by hour of day (0-23)

### 6. Rank Movement Tracker

**GET** `/api/points/analytics/rank-history`

- **Query Params:** `days` (default: 30), `top` (default: 10)
- **Returns:** Daily ranking history for top users

### 7. Achievement Milestones

**GET** `/api/points/analytics/milestones`

- **Returns:** All users who achieved point milestones (100, 500, 1000, 2500, 5000, 10000, 25000, 50000)

## Charts Implemented

1. ✅ **Points Distribution Over Time** - Area chart showing positive/negative trends
2. ✅ **Category Breakdown** - Pie chart of action categories
3. ✅ **Top Actions Leaderboard** - Horizontal bar chart
4. ✅ **Points Velocity** - Growth rate indicators with up/down arrows
5. ✅ **Active Days Comparison** - Bar chart
6. ✅ **Hourly Pattern** - Radar chart showing 24-hour activity
7. ✅ **Rank Movement Tracker** - Multi-line chart showing ranking changes
8. ✅ **Achievement Milestones** - Timeline of milestone achievements
9. ✅ **Enhanced Leaderboard** - With inline velocity indicators

## Usage

Import the new hook in your component:

```jsx
import { usePointsAnalytics } from "@/hooks/usePointsAnalytics";

const {
  timeline,
  topActions,
  activeDays,
  velocity,
  hourlyPattern,
  rankHistory,
  milestones,
} = usePointsAnalytics(period, month);
```

All endpoints require authentication token in headers.
