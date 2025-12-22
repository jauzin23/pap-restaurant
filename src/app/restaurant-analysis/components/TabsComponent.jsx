import React, { useState } from "react";
import ComponentRenderer from "../ComponentRenderer";

const TabsComponent = ({ tabs = [] }) => {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || null);

  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  return (
    <div className="tabs-component">
      <div className="tabs-header">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.badge && <span className="tab-badge">{tab.badge}</span>}
          </button>
        ))}
      </div>

      <div className="tabs-content">
        {activeTabData?.content && (
          <div className="tab-panel">
            {activeTabData.content.map((component, index) => (
              <ComponentRenderer key={index} component={component} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TabsComponent;
