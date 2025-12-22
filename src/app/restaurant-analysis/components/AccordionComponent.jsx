import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import ComponentRenderer from "../ComponentRenderer";
import BadgeComponent from "./BadgeComponent";

const AccordionComponent = ({ items = [] }) => {
  const [openItems, setOpenItems] = useState([]);

  const toggleItem = (id) => {
    setOpenItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="accordion-component">
      {items.map((item) => (
        <div key={item.id} className="accordion-item">
          <button
            className={`accordion-header ${
              openItems.includes(item.id) ? "open" : ""
            }`}
            onClick={() => toggleItem(item.id)}
          >
            <span className="accordion-title">
              {item.title}
              {item.badge && <BadgeComponent {...item.badge} />}
            </span>
            <span className="accordion-icon">
              {openItems.includes(item.id) ? (
                <ChevronDown size={20} strokeWidth={2} />
              ) : (
                <ChevronRight size={20} strokeWidth={2} />
              )}
            </span>
          </button>

          {openItems.includes(item.id) && (
            <div className="accordion-content">
              {item.content.map((component, index) => (
                <ComponentRenderer key={index} component={component} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AccordionComponent;
