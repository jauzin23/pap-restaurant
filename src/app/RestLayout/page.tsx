import React from "react";
import RestaurantTabsLayout from "../components/RestaurantTabsLayout";

export default function RestLayoutPage() {
  // This would normally get user data from your auth context
  // For now, we'll pass a mock user - you can integrate with your actual auth system
  const mockUser = {
    $id: "user123",
    labels: ["manager"], // Remove this to test non-manager view
    name: "Restaurant Manager",
    email: "manager@restaurant.com",
  };

  return <RestaurantTabsLayout user={mockUser} />;
}
