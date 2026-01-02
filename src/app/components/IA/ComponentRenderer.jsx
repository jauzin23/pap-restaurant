import React from "react";
import HeroComponent from "./components/HeroComponent";
import SectionComponent from "./components/SectionComponent";
import GridComponent from "./components/GridComponent";
import CardComponent from "./components/CardComponent";
import MetricCardComponent from "./components/MetricCardComponent";
import AlertComponent from "./components/AlertComponent";
import BadgeComponent from "./components/BadgeComponent";
import TableComponent from "./components/TableComponent";
import ChartComponent from "./components/ChartComponent";
import MatrixComponent from "./components/MatrixComponent";
import TabsComponent from "./components/TabsComponent";
import AccordionComponent from "./components/AccordionComponent";
import ActionCardComponent from "./components/ActionCardComponent";
import DividerComponent from "./components/DividerComponent";
import ProgressBarComponent from "./components/ProgressBarComponent";

const ComponentRenderer = ({ component }) => {
  if (!component || !component.type) {
    return null;
  }

  const { type, props, children } = component;

  switch (type) {
    case "hero":
      return <HeroComponent {...props} />;

    case "section":
      return (
        <SectionComponent {...props}>
          {children?.map((child, index) => (
            <ComponentRenderer key={child.id || index} component={child} />
          ))}
        </SectionComponent>
      );

    case "grid":
      return (
        <GridComponent {...props}>
          {children?.map((child, index) => (
            <ComponentRenderer key={child.id || index} component={child} />
          ))}
        </GridComponent>
      );

    case "card":
      return <CardComponent {...props} />;

    case "metric-card":
      return <MetricCardComponent {...props} />;

    case "alert":
      return <AlertComponent {...props} />;

    case "badge":
      return <BadgeComponent {...props} />;

    case "table":
      return <TableComponent {...props} />;

    case "chart":
      return <ChartComponent {...props} />;

    case "matrix":
      return <MatrixComponent {...props} />;

    case "tabs":
      return <TabsComponent {...props} />;

    case "accordion":
      return <AccordionComponent {...props} />;

    case "action-card":
      return <ActionCardComponent {...props} />;

    case "divider":
      return <DividerComponent {...props} />;

    case "progress-bar":
      return <ProgressBarComponent {...props} />;

    default:
      console.warn(`Unknown component type: ${type}`);
      return <div className="unknown-component">Unknown component: {type}</div>;
  }
};

export default ComponentRenderer;
