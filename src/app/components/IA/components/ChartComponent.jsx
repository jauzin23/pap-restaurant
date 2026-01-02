import React from "react";

const ChartComponent = ({
  chartType = "bar",
  title,
  data = [],
  centerText,
  centerSubtext,
}) => {
  const renderBarChart = () => (
    <div className="bar-chart">
      {data.map((item, index) => (
        <div key={index} className="bar-item">
          <div
            className="bar-fill"
            style={{
              height: `${item.value}%`,
              backgroundColor: item.color || "#3b82f6",
            }}
          />
          <div className="bar-label">{item.label}</div>
          <div className="bar-value">{item.value}%</div>
        </div>
      ))}
    </div>
  );

  const renderLineChart = () => (
    <div className="line-chart">
      <svg viewBox="0 0 400 200" className="line-svg">
        {data.map((item, index) => {
          if (index === 0) return null;
          const prevItem = data[index - 1];
          const x1 = (index - 1) * (400 / (data.length - 1));
          const x2 = index * (400 / (data.length - 1));
          const y1 = 200 - prevItem.value * 2;
          const y2 = 200 - item.value * 2;

          return (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={item.color || "#3b82f6"}
              strokeWidth="2"
            />
          );
        })}
      </svg>
      <div className="line-labels">
        {data.map((item, index) => (
          <div key={index} className="line-label">
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );

  const renderPieChart = () => {
    let currentAngle = 0;
    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
      <div className="pie-chart">
        <svg viewBox="0 0 200 200" className="pie-svg">
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (percentage / 100) * 360;
            const startAngle = currentAngle;
            currentAngle += angle;

            const x1 = 100 + 80 * Math.cos(((startAngle - 90) * Math.PI) / 180);
            const y1 = 100 + 80 * Math.sin(((startAngle - 90) * Math.PI) / 180);
            const x2 =
              100 + 80 * Math.cos(((currentAngle - 90) * Math.PI) / 180);
            const y2 =
              100 + 80 * Math.sin(((currentAngle - 90) * Math.PI) / 180);

            const largeArc = angle > 180 ? 1 : 0;

            return (
              <path
                key={index}
                d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={item.color || `hsl(${index * 60}, 70%, 60%)`}
              />
            );
          })}
        </svg>
        <div className="pie-legend">
          {data.map((item, index) => (
            <div key={index} className="legend-item">
              <span
                className="legend-color"
                style={{ backgroundColor: item.color }}
              />
              <span className="legend-label">{item.label}</span>
              <span className="legend-value">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDonutChart = () => {
    let currentAngle = 0;
    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
      <div className="donut-chart">
        <svg viewBox="0 0 200 200" className="donut-svg">
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (percentage / 100) * 360;
            const startAngle = currentAngle;
            currentAngle += angle;

            const x1 = 100 + 80 * Math.cos(((startAngle - 90) * Math.PI) / 180);
            const y1 = 100 + 80 * Math.sin(((startAngle - 90) * Math.PI) / 180);
            const x2 =
              100 + 80 * Math.cos(((currentAngle - 90) * Math.PI) / 180);
            const y2 =
              100 + 80 * Math.sin(((currentAngle - 90) * Math.PI) / 180);

            const x3 =
              100 + 50 * Math.cos(((currentAngle - 90) * Math.PI) / 180);
            const y3 =
              100 + 50 * Math.sin(((currentAngle - 90) * Math.PI) / 180);
            const x4 = 100 + 50 * Math.cos(((startAngle - 90) * Math.PI) / 180);
            const y4 = 100 + 50 * Math.sin(((startAngle - 90) * Math.PI) / 180);

            const largeArc = angle > 180 ? 1 : 0;

            return (
              <path
                key={index}
                d={`M ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A 50 50 0 ${largeArc} 0 ${x4} ${y4} Z`}
                fill={item.color || `hsl(${index * 60}, 70%, 60%)`}
              />
            );
          })}
          {centerText && (
            <>
              <text
                x="100"
                y="95"
                textAnchor="middle"
                className="donut-center-text"
              >
                {centerText}
              </text>
              {centerSubtext && (
                <text
                  x="100"
                  y="110"
                  textAnchor="middle"
                  className="donut-center-subtext"
                >
                  {centerSubtext}
                </text>
              )}
            </>
          )}
        </svg>
        <div className="donut-legend">
          {data.map((item, index) => (
            <div key={index} className="legend-item">
              <span
                className="legend-color"
                style={{ backgroundColor: item.color }}
              />
              <span className="legend-label">{item.label}</span>
              <span className="legend-value">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="chart-component">
      {title && <h4 className="chart-title">{title}</h4>}
      <div className="chart-content">
        {chartType === "bar" && renderBarChart()}
        {chartType === "line" && renderLineChart()}
        {chartType === "pie" && renderPieChart()}
        {chartType === "donut" && renderDonutChart()}
      </div>
    </div>
  );
};

export default ChartComponent;
