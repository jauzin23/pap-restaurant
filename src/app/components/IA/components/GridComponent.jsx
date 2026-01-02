import React from "react";

const GridComponent = ({ columns = 2, gap = "md", children }) => {
  return (
    <div className={`grid-component cols-${columns} gap-${gap}`}>
      {children}
    </div>
  );
};

export default GridComponent;
