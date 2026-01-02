import React, { useState } from "react";
import BadgeComponent from "./BadgeComponent";

const TableComponent = ({
  title,
  columns = [],
  rows = [],
  sortable = false,
  filterable = false,
  highlightRows = [],
}) => {
  const [sortConfig, setSortConfig] = useState(null);
  const [filter, setFilter] = useState("");

  const handleSort = (key) => {
    if (!sortable) return;

    let direction = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedRows = React.useMemo(() => {
    let sorted = [...rows];

    if (sortConfig) {
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return sorted;
  }, [rows, sortConfig]);

  const filteredRows = React.useMemo(() => {
    if (!filter) return sortedRows;

    return sortedRows.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(filter.toLowerCase())
      )
    );
  }, [sortedRows, filter]);

  const getCellContent = (row, column) => {
    const value = row[column.key];

    if (column.type === "badge" && typeof value === "object") {
      return <BadgeComponent {...value} />;
    }

    if (column.type === "currency") {
      return `€${Number(value).toFixed(2)}`;
    }

    return value;
  };

  const getRowStyle = (row) => {
    for (const highlight of highlightRows) {
      try {
        // Simple condition evaluation (you might want to make this more sophisticated)
        if (
          highlight.condition &&
          eval(
            highlight.condition
              .replace(/risco\.variant/g, `"${row.risco?.variant || ''}"`)
              .replace(/acao/g, `"${row.acao || ''}"`)
              .replace(/row\./g, 'row.')
          )
        ) {
          return { backgroundColor: highlight.color };
        }
      } catch (error) {
        console.warn('Error evaluating highlight condition:', highlight.condition, error);
        // Continue to next highlight rule
      }
    }
    return {};
  };

  return (
    <div className="table-component">
      {title && <h4 className="table-title">{title}</h4>}

      {filterable && (
        <div className="table-filter">
          <input
            type="text"
            placeholder="Filtrar..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-input"
          />
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  style={{
                    width: column.width,
                    textAlign: column.align || "left",
                  }}
                  onClick={() => handleSort(column.key)}
                  className={sortable ? "sortable" : ""}
                >
                  {column.label}
                  {sortConfig?.key === column.key && (
                    <span className="sort-indicator">
                      {sortConfig.direction === "asc" ? " ↑" : " ↓"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIndex) => (
              <tr key={rowIndex} style={getRowStyle(row)}>
                {columns.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    style={{ textAlign: column.align || "left" }}
                  >
                    {getCellContent(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filterable && filteredRows.length === 0 && (
        <div className="no-results">Nenhum resultado encontrado</div>
      )}
    </div>
  );
};

export default TableComponent;
