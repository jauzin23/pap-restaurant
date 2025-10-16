import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  Save,
  Plus,
  Edit2,
  Trash2,
  RotateCw,
  Move,
  X,
  Check,
  AlertCircle,
} from "lucide-react";

// This component is designed to be used with the databases import from @/lib/appwrite
// Pass the databases object and collection IDs as props
const TableEditor = ({ databases, DATABASE_ID, COLLECTION_ID }) => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [draggedTable, setDraggedTable] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const pendingChangesRef = useRef(new Map());
  const canvasRef = useRef(null);

  // Calculate dynamic canvas size based on tables
  const canvasSize = useMemo(() => {
    if (tables.length === 0) {
      return { width: 1200, height: 800 };
    }

    let maxX = 1200;
    let maxY = 800;

    tables.forEach((table) => {
      const tableMaxX = table.x + table.width + 100; // Add padding
      const tableMaxY = table.y + table.height + 100; // Add padding
      maxX = Math.max(maxX, tableMaxX);
      maxY = Math.max(maxY, tableMaxY);
    });

    return { width: maxX, height: maxY };
  }, [tables]);

  // Form state for editing - real-time preview
  const [formData, setFormData] = useState({
    tableNumber: 1,
    width: 80,
    height: 80,
    chairs: 4,
    shape: "rectangular",
    rotation: 0,
    chairTop: true,
    chairRight: true,
    chairBottom: true,
    chairLeft: true,
  });

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, []);
      const tablesData = res.documents.map((doc) => ({
        id: doc.$id,
        x: doc.posX,
        y: doc.posY,
        width: doc.width,
        height: doc.height,
        chairs: doc.chairs,
        rotation: doc.rotation,
        tableNumber: doc.tableNumber,
        shape: doc.shape,
        chairTop: doc.chairTop ?? true,
        chairRight: doc.chairRight ?? true,
        chairBottom: doc.chairBottom ?? true,
        chairLeft: doc.chairLeft ?? true,
      }));
      setTables(tablesData);
    } catch (error) {
      console.error("Error loading tables:", error);
    }
  };

  const handleAddTable = () => {
    const newTable = {
      ...formData,
      x: canvasSize.width / 2 - formData.width / 2,
      y: canvasSize.height / 2 - formData.height / 2,
      id: `temp-${Date.now()}`,
    };
    setTables((prev) => [...prev, newTable]);
    setSelectedTable(newTable);
    setEditMode(true);
    setHasUnsavedChanges(true);
    pendingChangesRef.current.set(newTable.id, { ...newTable, isNew: true });
  };

  const handleSaveAllChanges = async () => {
    setIsSaving(true);
    try {
      for (const [id, changes] of pendingChangesRef.current.entries()) {
        if (changes.isNew) {
          // Create new table
          const { isNew, id: tempId, ...tableData } = changes;
          await databases.createDocument(
            DATABASE_ID,
            COLLECTION_ID,
            "unique()",
            {
              posX: tableData.x,
              posY: tableData.y,
              width: tableData.width,
              height: tableData.height,
              chairs: tableData.chairs,
              rotation: tableData.rotation,
              tableNumber: tableData.tableNumber,
              shape: tableData.shape,
              chairTop: tableData.chairTop,
              chairRight: tableData.chairRight,
              chairBottom: tableData.chairBottom,
              chairLeft: tableData.chairLeft,
              status: "free",
            }
          );
        } else {
          // Update existing table
          const { id: tableId, ...updateData } = changes;
          await databases.updateDocument(DATABASE_ID, COLLECTION_ID, tableId, {
            posX: updateData.x,
            posY: updateData.y,
            width: updateData.width,
            height: updateData.height,
            chairs: updateData.chairs,
            rotation: updateData.rotation,
            tableNumber: updateData.tableNumber,
            shape: updateData.shape,
            chairTop: updateData.chairTop,
            chairRight: updateData.chairRight,
            chairBottom: updateData.chairBottom,
            chairLeft: updateData.chairLeft,
          });
        }
      }

      pendingChangesRef.current.clear();
      setHasUnsavedChanges(false);
      await loadTables();
      setSelectedTable(null);
      setEditMode(false);
    } catch (error) {
      console.error("Error saving changes:", error);
      alert("Erro ao guardar alterações. Por favor, tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = async () => {
    if (
      window.confirm("Tem certeza que deseja descartar todas as alterações?")
    ) {
      pendingChangesRef.current.clear();
      setHasUnsavedChanges(false);
      await loadTables();
      setSelectedTable(null);
      setEditMode(false);
    }
  };

  const handleDeleteTable = async (table) => {
    if (
      window.confirm(
        `Tem certeza que deseja eliminar a Mesa ${table.tableNumber}?`
      )
    ) {
      if (table.id.startsWith("temp-")) {
        // Remove from pending changes if it's a new table
        pendingChangesRef.current.delete(table.id);
        setTables((prev) => prev.filter((t) => t.id !== table.id));
        if (pendingChangesRef.current.size === 0) {
          setHasUnsavedChanges(false);
        }
      } else {
        // Mark for deletion
        try {
          await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, table.id);
          await loadTables();
        } catch (error) {
          console.error("Error deleting table:", error);
        }
      }
      setSelectedTable(null);
    }
  };

  const handleTableClick = (table) => {
    setSelectedTable(table);
    setFormData({
      tableNumber: table.tableNumber,
      width: table.width,
      height: table.height,
      chairs: table.chairs,
      shape: table.shape,
      rotation: table.rotation,
      chairTop: table.chairTop ?? true,
      chairRight: table.chairRight ?? true,
      chairBottom: table.chairBottom ?? true,
      chairLeft: table.chairLeft ?? true,
    });
    setEditMode(true);
  };

  const handleDragStart = (e, table) => {
    setDraggedTable(table);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!draggedTable) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(
        canvasSize.width - draggedTable.width,
        e.clientX - rect.left - draggedTable.width / 2
      )
    );
    const y = Math.max(
      0,
      Math.min(
        canvasSize.height - draggedTable.height,
        e.clientY - rect.top - draggedTable.height / 2
      )
    );

    const updatedTable = { ...draggedTable, x, y };

    // Update table immediately in state
    setTables((prev) =>
      prev.map((t) => (t.id === draggedTable.id ? updatedTable : t))
    );

    // Track change for later save
    pendingChangesRef.current.set(draggedTable.id, updatedTable);
    setHasUnsavedChanges(true);

    if (selectedTable?.id === draggedTable.id) {
      setSelectedTable(updatedTable);
    }

    setDraggedTable(null);
  };

  const updateSelectedTable = (field, value) => {
    if (!selectedTable) return;

    const updatedTable = { ...selectedTable, [field]: value };

    // Update immediately in state for instant visual feedback
    setTables((prev) =>
      prev.map((t) => (t.id === selectedTable.id ? updatedTable : t))
    );
    setSelectedTable(updatedTable);
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Track change for later save
    pendingChangesRef.current.set(selectedTable.id, updatedTable);
    setHasUnsavedChanges(true);
  };

  const calculateChairPositions = (table) => {
    const chairs = [];
    const {
      width,
      height,
      chairs: chairCount,
      shape,
      chairTop,
      chairRight,
      chairBottom,
      chairLeft,
    } = table;
    const chairDistance = 18;

    if (shape === "circular") {
      const radius = width / 2 + chairDistance;
      for (let i = 0; i < chairCount; i++) {
        const angle = (2 * Math.PI * i) / chairCount - Math.PI / 2;
        chairs.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
      }
    } else {
      const sides = [
        { key: "top", enabled: chairTop },
        { key: "right", enabled: chairRight },
        { key: "bottom", enabled: chairBottom },
        { key: "left", enabled: chairLeft },
      ];

      const enabledSides = sides.filter((side) => side.enabled);
      if (enabledSides.length === 0) return chairs;

      const chairsPerSide = Math.floor(chairCount / enabledSides.length);
      const remainder = chairCount % enabledSides.length;

      enabledSides.forEach((side, sideIndex) => {
        const extraChair = sideIndex < remainder ? 1 : 0;
        const chairsOnThisSide = chairsPerSide + extraChair;

        for (let i = 0; i < chairsOnThisSide; i++) {
          let x, y;

          switch (side.key) {
            case "top":
              x = (width / (chairsOnThisSide + 1)) * (i + 1) - width / 2;
              y = -height / 2 - chairDistance;
              break;
            case "right":
              x = width / 2 + chairDistance;
              y = (height / (chairsOnThisSide + 1)) * (i + 1) - height / 2;
              break;
            case "bottom":
              x = width / 2 - (width / (chairsOnThisSide + 1)) * (i + 1);
              y = height / 2 + chairDistance;
              break;
            case "left":
              x = -width / 2 - chairDistance;
              y = height / 2 - (height / (chairsOnThisSide + 1)) * (i + 1);
              break;
            default:
              x = 0;
              y = 0;
          }

          chairs.push({ x, y });
        }
      });
    }

    return chairs;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Editor de Mesas
          </h2>
          <button
            onClick={handleAddTable}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus size={20} />
            Adicionar Mesa
          </button>

          {hasUnsavedChanges && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle
                  size={18}
                  className="text-amber-600 flex-shrink-0 mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">
                    Alterações não guardadas
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    {pendingChangesRef.current.size} mesa(s) com alterações
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSaveAllChanges}
                  disabled={isSaving}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded text-sm font-medium transition-colors"
                >
                  <Save size={14} />
                  {isSaving ? "A guardar..." : "Guardar Tudo"}
                </button>
                <button
                  onClick={handleDiscardChanges}
                  disabled={isSaving}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 rounded text-sm font-medium transition-colors"
                >
                  <X size={14} />
                  Descartar
                </button>
              </div>
            </div>
          )}
        </div>

        {editMode && selectedTable && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-4 pb-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                A Editar
              </h3>
              <p className="text-lg font-bold text-blue-600">
                Mesa {selectedTable.tableNumber}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número da Mesa
                </label>
                <input
                  type="number"
                  value={formData.tableNumber}
                  onChange={(e) =>
                    updateSelectedTable(
                      "tableNumber",
                      parseInt(e.target.value) || 1
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forma
                </label>
                <select
                  value={formData.shape}
                  onChange={(e) => updateSelectedTable("shape", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="rectangular">Retangular</option>
                  <option value="circular">Circular</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Largura
                  </label>
                  <input
                    type="number"
                    value={formData.width}
                    onChange={(e) =>
                      updateSelectedTable(
                        "width",
                        parseInt(e.target.value) || 40
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="40"
                    max="200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Altura
                  </label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={(e) =>
                      updateSelectedTable(
                        "height",
                        parseInt(e.target.value) || 40
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="40"
                    max="200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Cadeiras
                </label>
                <input
                  type="number"
                  value={formData.chairs}
                  onChange={(e) =>
                    updateSelectedTable("chairs", parseInt(e.target.value) || 1)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  max="12"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rotação: {formData.rotation}°
                </label>
                <input
                  type="range"
                  value={formData.rotation}
                  onChange={(e) =>
                    updateSelectedTable("rotation", parseInt(e.target.value))
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  min="0"
                  max="360"
                  step="15"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0°</span>
                  <span>90°</span>
                  <span>180°</span>
                  <span>270°</span>
                  <span>360°</span>
                </div>
              </div>

              {formData.shape === "rectangular" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Posição das Cadeiras
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.chairTop}
                        onChange={(e) =>
                          updateSelectedTable("chairTop", e.target.checked)
                        }
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">
                        ⬆️ Cima
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.chairRight}
                        onChange={(e) =>
                          updateSelectedTable("chairRight", e.target.checked)
                        }
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">
                        ➡️ Direita
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.chairBottom}
                        onChange={(e) =>
                          updateSelectedTable("chairBottom", e.target.checked)
                        }
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">
                        ⬇️ Baixo
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.chairLeft}
                        onChange={(e) =>
                          updateSelectedTable("chairLeft", e.target.checked)
                        }
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">
                        ⬅️ Esquerda
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setSelectedTable(null);
                    setEditMode(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  <X size={18} />
                  Fechar Editor
                </button>
              </div>

              {selectedTable?.id && (
                <button
                  onClick={() => handleDeleteTable(selectedTable)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Trash2 size={18} />
                  Eliminar Mesa
                </button>
              )}
            </div>
          </div>
        )}

        {!editMode && (
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Mesas ({tables.length})
            </h3>
            {tables.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">Nenhuma mesa criada</p>
                <p className="text-xs mt-1">Clique em "Adicionar Mesa"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tables.map((table) => (
                  <div
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    className={`p-3 rounded-lg cursor-pointer transition-all border-2 ${
                      pendingChangesRef.current.has(table.id)
                        ? "bg-amber-50 hover:bg-amber-100 border-amber-300"
                        : "bg-gray-50 hover:bg-gray-100 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        Mesa {table.tableNumber}
                      </span>
                      <span className="text-sm text-gray-500">
                        {table.chairs} cadeiras
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {table.shape === "circular" ? "Circular" : "Retangular"} •{" "}
                      {table.width}x{table.height}px
                    </div>
                    {pendingChangesRef.current.has(table.id) && (
                      <div className="text-xs text-amber-700 font-medium mt-1">
                        ● Alterado
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
        <div
          className="relative bg-white rounded-xl shadow-2xl border-2 border-gray-300"
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            backgroundImage: `
              linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: "20px 20px",
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {tables.map((table) => {
            const chairPositions = calculateChairPositions(table);
            const isModified = pendingChangesRef.current.has(table.id);
            const isNew = table.id.startsWith("temp-");

            return (
              <div
                key={table.id}
                draggable
                onDragStart={(e) => handleDragStart(e, table)}
                onClick={() => handleTableClick(table)}
                className={`absolute cursor-move group transition-all ${
                  selectedTable?.id === table.id
                    ? "ring-4 ring-blue-500 shadow-2xl z-10"
                    : isModified || isNew
                    ? "ring-2 ring-amber-400 shadow-lg"
                    : "shadow-md hover:shadow-xl"
                }`}
                style={{
                  left: table.x,
                  top: table.y,
                  width: table.width,
                  height: table.height,
                  transform: `rotate(${table.rotation}deg)`,
                  transformOrigin: "center",
                }}
              >
                {/* Table */}
                <div
                  className={`w-full h-full border-3 flex items-center justify-center transition-all ${
                    isNew
                      ? "border-blue-400 bg-blue-100"
                      : isModified
                      ? "border-amber-400 bg-amber-100"
                      : "border-green-400 bg-green-100"
                  }`}
                  style={{
                    borderRadius: table.shape === "circular" ? "50%" : "8px",
                    borderWidth: "3px",
                  }}
                >
                  <div className="text-center">
                    <span
                      className={`font-bold text-xl ${
                        isNew
                          ? "text-blue-700"
                          : isModified
                          ? "text-amber-700"
                          : "text-green-700"
                      }`}
                    >
                      {table.tableNumber}
                    </span>
                    {(isNew || isModified) && (
                      <div
                        className={`text-[8px] font-semibold mt-0.5 ${
                          isNew ? "text-blue-600" : "text-amber-600"
                        }`}
                      >
                        {isNew ? "NOVA" : "EDITADA"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Chairs */}
                {chairPositions.map((pos, idx) => (
                  <div
                    key={idx}
                    className={`absolute w-3 h-3 border-2 border-white rounded-sm shadow-sm ${
                      isNew
                        ? "bg-blue-600"
                        : isModified
                        ? "bg-amber-600"
                        : "bg-green-600"
                    }`}
                    style={{
                      left: "50%",
                      top: "50%",
                      transform: `translate(-50%, -50%) translate(${pos.x}px, ${
                        pos.y
                      }px) rotate(${-table.rotation}deg)`,
                    }}
                  />
                ))}

                {/* Edit icon on hover */}
                <div className="absolute -top-8 -right-8 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-blue-600 text-white p-2 rounded-full shadow-lg">
                    <Edit2 size={16} />
                  </div>
                </div>
              </div>
            );
          })}

          {tables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Move size={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  Clique em "Adicionar Mesa" para começar
                </p>
                <p className="text-xs mt-1">
                  Arraste as mesas para reposicionar
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableEditor;
