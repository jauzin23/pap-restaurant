import React from "react";

const DividerComponent = ({ style = "solid", spacing = "md" }) => {
  return (
    <hr className={`divider-component style-${style} spacing-${spacing}`} />
  );
};

export default DividerComponent;
