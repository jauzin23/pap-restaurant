"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  RotateCw,
  Trash2,
  Save,
  Edit,
  Grid,
  ChevronDown,
  Square,
  RectangleHorizontal,
  Circle,
  Minus,
  Ruler,
  Settings,
} from "lucide-react";
import { databases } from "@/lib/appwrite";
import { ID, Query } from "appwrite";

const DATABASE_ID = "689c9a200025de0e8af2";
const COLLECTION_ID = "689c9a26000b5abf71c8";

const SETTINGS_COLLECTION_ID = "689cab26001a260d5abc";
const SETTINGS_DOCUMENT_ID = "main";

interface Table {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  chairs: number;
  rotation: number;
  tableNumber: number;
  shape: string;
  chairSides: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

interface ChairPosition {
  x: number;
  y: number;
  rotation?: number;
}

const RestaurantFloorPlan: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [draggedTable, setDraggedTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [restaurantSize, setRestaurantSize] = useState<number>(100);
  const [showSizeMenu, setShowSizeMenu] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const PIXELS_PER_METER = 40;

  const getMaxDimensions = () => {
    const baseSize = Math.sqrt(restaurantSize) * 60;
    return {
      width: Math.min(1200, Math.max(400, baseSize * 1.2)),
      height: Math.min(900, Math.max(300, baseSize)),
    };
  };
  const handleSetRestaurantSize = async (size: number) => {
    setRestaurantSize(size);
    try {
      await databases.updateDocument(
        DATABASE_ID,
        SETTINGS_COLLECTION_ID,
        SETTINGS_DOCUMENT_ID,
        { id: SETTINGS_DOCUMENT_ID, size }
      );
    } catch (err) {
      try {
        await databases.createDocument(
          DATABASE_ID,
          SETTINGS_COLLECTION_ID,
          SETTINGS_DOCUMENT_ID,
          { id: SETTINGS_DOCUMENT_ID, size }
        );
      } catch (createErr) {
        console.error(
          "Erro ao criar/atualizar tamanho do restaurante:",
          createErr
        );
      }
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const doc = await databases.getDocument(
          DATABASE_ID,
          SETTINGS_COLLECTION_ID,
          SETTINGS_DOCUMENT_ID
        );
        setRestaurantSize(doc.size);
      } catch (err) {
        try {
          await databases.createDocument(
            DATABASE_ID,
            SETTINGS_COLLECTION_ID,
            SETTINGS_DOCUMENT_ID,
            { id: SETTINGS_DOCUMENT_ID, size: 100 }
          );
          setRestaurantSize(100);
        } catch (createErr) {
          console.error("Erro ao criar documento de settings:", createErr);
        }
      }
    };
    fetchSettings();
  }, []);
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
          Query.limit(100),
        ]);
        setTables(
          res.documents.map((doc: any) => ({
            id: doc.$id,
            x: doc.posX,
            y: doc.posY,
            width: doc.width,
            height: doc.height,
            chairs: doc.chairs,
            rotation: doc.rotation,
            tableNumber: doc.tableNumber,
            shape: doc.shape,
            chairSides: {
              top: doc.chairTop ?? true,
              right: doc.chairRight ?? true,
              bottom: doc.chairBottom ?? true,
              left: doc.chairLeft ?? true,
            },
          }))
        );
      } catch (err) {
        console.error("Erro ao buscar mesas:", err);
      }
    };
    fetchTables();
  }, []);

  const saveLayout = async () => {
    try {
      // 1. Fetch all existing tables from Appwrite
      const res = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
        Query.limit(100),
      ]);
      const existingIds = res.documents.map((doc: any) => doc.$id);

      // 2. Update or create tables
      for (const table of tables) {
        if (table.id && existingIds.includes(table.id)) {
          // Update existing
          await databases.updateDocument(DATABASE_ID, COLLECTION_ID, table.id, {
            posX: Math.round(table.x),
            posY: Math.round(table.y),
            width: Math.round(table.width),
            height: Math.round(table.height),
            chairs: Math.round(table.chairs),
            rotation: Math.round(table.rotation),
            tableNumber: Math.round(table.tableNumber),
            shape: table.shape,
            chairTop: table.chairSides.top,
            chairRight: table.chairSides.right,
            chairBottom: table.chairSides.bottom,
            chairLeft: table.chairSides.left,
            status: "free",
          });
        } else {
          // Create new
          await databases.createDocument(
            DATABASE_ID,
            COLLECTION_ID,
            ID.unique(),
            {
              posX: Math.round(table.x),
              posY: Math.round(table.y),
              width: Math.round(table.width),
              height: Math.round(table.height),
              chairs: Math.round(table.chairs),
              rotation: Math.round(table.rotation),
              tableNumber: Math.round(table.tableNumber),
              shape: table.shape,
              chairTop: table.chairSides.top,
              chairRight: table.chairSides.right,
              chairBottom: table.chairSides.bottom,
              chairLeft: table.chairSides.left,
              status: "free",
            }
          );
        }
      }

      // 3. Delete removed tables
      for (const id of existingIds) {
        if (!tables.find((t) => t.id === id)) {
          await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, id);
        }
      }

      alert("Layout salvo com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar layout:", err);
      alert("Erro ao salvar layout.");
    }
  };

  const addTable = async (shape: string = "square") => {
    const shapePresets: Record<
      string,
      { width: number; height: number; chairs: number }
    > = {
      square: { width: 80, height: 80, chairs: 4 },
      rectangular: { width: 120, height: 60, chairs: 6 },
      circular: { width: 90, height: 90, chairs: 6 },
      bar: { width: 200, height: 40, chairs: 8 },
    };

    const preset = shapePresets[shape] || shapePresets.square;
    const newTable = {
      posX: 100,
      posY: 100,
      width: preset.width,
      height: shape === "circular" ? preset.width : preset.height,
      chairs: preset.chairs,
      rotation: 0,
      tableNumber: tables.length + 1,
      shape: shape,
      chairTop: true,
      chairRight: true,
      chairBottom: true,
      chairLeft: true,
      status: "free",
    };
    try {
      const doc = await databases.createDocument(
        DATABASE_ID,
        COLLECTION_ID,
        ID.unique(),
        newTable
      );
      setTables([
        ...tables,
        {
          ...newTable,
          id: doc.$id,
          x: newTable.posX,
          y: newTable.posY,
          chairSides: {
            top: newTable.chairTop,
            right: newTable.chairRight,
            bottom: newTable.chairBottom,
            left: newTable.chairLeft,
          },
        },
      ]);
    } catch (err) {
      console.error("Erro ao adicionar mesa:", err);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, table: Table) => {
    if (!editMode) return;

    e.preventDefault();
    e.stopPropagation();
    setDraggedTable(table.id);
    setSelectedTable(table.id);

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - table.x,
        y: e.clientY - rect.top - table.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedTable || !editMode || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const maxDim = getMaxDimensions();

    const table = tables.find((t) => t.id === draggedTable);
    if (!table) return;

    // Calculate rotated bounding box
    const rad = (table.rotation * Math.PI) / 180;
    const rotatedWidth =
      Math.abs(Math.cos(rad)) * table.width +
      Math.abs(Math.sin(rad)) * table.height;
    const rotatedHeight =
      Math.abs(Math.sin(rad)) * table.width +
      Math.abs(Math.cos(rad)) * table.height;

    // Calculate the offset from the center
    const centerOffsetX = table.width / 2;
    const centerOffsetY = table.height / 2;

    // Calculate new center position
    let centerX = e.clientX - rect.left - dragOffset.x + centerOffsetX;
    let centerY = e.clientY - rect.top - dragOffset.y + centerOffsetY;

    // Clamp center position so the rotated bounding box stays within bounds
    centerX = Math.max(
      rotatedWidth / 2,
      Math.min(maxDim.width - rotatedWidth / 2, centerX)
    );
    centerY = Math.max(
      rotatedHeight / 2,
      Math.min(maxDim.height - rotatedHeight / 2, centerY)
    );

    const newX = centerX - centerOffsetX;
    const newY = centerY - centerOffsetY;

    setTables((prevTables) =>
      prevTables.map((table) =>
        table.id === draggedTable ? { ...table, x: newX, y: newY } : table
      )
    );
  };

  const handleMouseUp = () => {
    if (draggedTable) {
      const table = tables.find((t) => t.id === draggedTable);
      if (table) {
      }
    }
    setDraggedTable(null);
  };

  const rotateTable = (tableId: string) => {
    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.id === tableId) {
          const updated = { ...table, rotation: (table.rotation + 90) % 360 };
          return updated;
        }
        return table;
      })
    );
  };

  const getMaxChairs = (
    width: number,
    height: number,
    shape: string
  ): number => {
    const perimeter =
      shape === "circular"
        ? Math.PI * Math.max(width, height)
        : 2 * (width + height);
    return Math.floor(perimeter / 30);
  };

  const updateTableChairs = (tableId: number, chairs: number) => {
    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.id === tableId) {
          const maxChairs = getMaxChairs(
            table.width,
            table.height,
            table.shape
          );
          const updated = {
            ...table,
            chairs: Math.max(1, Math.min(maxChairs, chairs)),
          };
          return updated;
        }
        return table;
      })
    );
  };

  const updateTableSize = (
    tableId: number,
    dimension: "width" | "height",
    value: number
  ) => {
    const pixelValue = value * PIXELS_PER_METER;
    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.id === tableId) {
          let updated = {
            ...table,
            [dimension]: Math.max(40, Math.min(600, pixelValue)),
          };

          // For circular tables, keep width = height
          if (table.shape === "circular") {
            const size = Math.max(40, Math.min(600, pixelValue));
            updated = {
              ...updated,
              width: size,
              height: size,
            };
          }

          const maxChairs = getMaxChairs(
            updated.width,
            updated.height,
            updated.shape
          );
          if (updated.chairs > maxChairs) {
            updated.chairs = maxChairs;
          }
          return updated;
        }
        return table;
      })
    );
  };

  const updateTableShape = (tableId: number, newShape: string) => {
    const shapePresets: Record<string, { width: number; height: number }> = {
      square: { width: 80, height: 80 },
      rectangular: { width: 120, height: 60 },
      circular: { width: 90, height: 90 },
      bar: { width: 200, height: 40 },
    };

    const preset = shapePresets[newShape];
    if (preset) {
      setTables((prevTables) =>
        prevTables.map((table) => {
          if (table.id === tableId) {
            const updated = {
              ...table,
              shape: newShape,
              width: preset.width,
              height: newShape === "circular" ? preset.width : preset.height,
            };
            const maxChairs = getMaxChairs(
              updated.width,
              updated.height,
              updated.shape
            );
            updated.chairs = Math.min(updated.chairs, maxChairs);
            return updated;
          }
          return table;
        })
      );
    }
  };

  const updateChairSides = (
    tableId: number,
    side: string,
    enabled: boolean
  ) => {
    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.id === tableId) {
          const updated = {
            ...table,
            chairSides: {
              ...table.chairSides,
              [side]: enabled,
            },
          };
          return updated;
        }
        return table;
      })
    );
  };

  const getTableStyle = (table: Table) => {
    return {
      borderRadius: table.shape === "circular" ? "50%" : "2px",
    };
  };

  const getChairPositions = (table: Table): ChairPosition[] => {
    const chairs: ChairPosition[] = [];
    const { width, height, chairs: chairCount, shape, chairSides } = table;
    const chairDistance = 15;

    if (shape === "circular") {
      const radius = width / 2 + chairDistance;
      for (let i = 0; i < chairCount; i++) {
        const angle = (2 * Math.PI * i) / chairCount - Math.PI / 2;
        chairs.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          rotation: angle * (180 / Math.PI) + 90,
        });
      }
    } else {
      const sides = [
        { key: "top", enabled: chairSides.top },
        { key: "right", enabled: chairSides.right },
        { key: "bottom", enabled: chairSides.bottom },
        { key: "left", enabled: chairSides.left },
      ];

      const enabledSides = sides.filter((side) => side.enabled);
      if (enabledSides.length === 0) return chairs;

      const chairsPerSide = Math.floor(chairCount / enabledSides.length);
      const remainder = chairCount % enabledSides.length;

      let chairsPlaced = 0;

      enabledSides.forEach((side, sideIndex) => {
        const extraChair = sideIndex < remainder ? 1 : 0;
        const chairsOnThisSide = chairsPerSide + extraChair;

        for (let i = 0; i < chairsOnThisSide; i++) {
          let x: number, y: number, rotation: number;

          switch (side.key) {
            case "top":
              x = (width / (chairsOnThisSide + 1)) * (i + 1) - width / 2;
              y = -height / 2 - chairDistance;
              rotation = 0;
              break;
            case "right":
              x = width / 2 + chairDistance;
              y = (height / (chairsOnThisSide + 1)) * (i + 1) - height / 2;
              rotation = 90;
              break;
            case "bottom":
              x = width / 2 - (width / (chairsOnThisSide + 1)) * (i + 1);
              y = height / 2 + chairDistance;
              rotation = 180;
              break;
            case "left":
              x = -width / 2 - chairDistance;
              y = height / 2 - (height / (chairsOnThisSide + 1)) * (i + 1);
              rotation = -90;
              break;
            default:
              x = 0;
              y = 0;
              rotation = 0;
          }

          chairs.push({ x, y, rotation });
          chairsPlaced++;
        }
      });
    }

    return chairs;
  };

  const deleteTable = async (tableId: string) => {
    try {
      await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, tableId);
      setTables((prevTables) =>
        prevTables.filter((table) => table.id !== tableId)
      );
      setSelectedTable(null);
    } catch (err) {
      console.error("Erro ao eliminar mesa:", err);
    }
  };

  const selectedTableData = tables.find((table) => table.id === selectedTable);
  const maxDimensions = getMaxDimensions();

  return (
    <div className="w-full flex items-center justify-center px-4">
      <div
        className="w-full bg-white rounded-2xl shadow-2xl flex flex-col p-8"
        style={{
          maxHeight: "90vh",
          overflow: "hidden",
        }}
      >
        <div className="flex items-center justify-between px-0 py-1 mb-4">
          <span className="text-xl font-semibold text-slate-800 tracking-tight">
            Layout do Restaurante
          </span>
          <div className="flex gap-2">
            {editMode && (
              <div className="relative">
                <button
                  onClick={() => setShowSizeMenu(!showSizeMenu)}
                  className="px-3 py-1.5 bg-blue-600 text-white font-medium border-0 hover:bg-blue-700 transition-colors flex items-center gap-2 text-xs rounded"
                >
                  <Ruler size={14} />
                  {restaurantSize}m²
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${
                      showSizeMenu ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showSizeMenu && (
                  <div className="absolute top-full mt-2 bg-white border shadow-lg z-20 min-w-[200px] rounded">
                    <div className="p-4">
                      <h4 className="text-xs font-semibold text-slate-800 mb-3">
                        Tamanho do Restaurante
                      </h4>
                      <div className="space-y-1">
                        {[50, 75, 100, 150, 200, 300, 500].map((size) => (
                          <button
                            key={size}
                            onClick={() => {
                              handleSetRestaurantSize(size);
                              setShowSizeMenu(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors font-medium rounded ${
                              restaurantSize === size
                                ? "bg-blue-50 text-blue-700"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {size}m²{" "}
                            {size <= 75
                              ? "(Pequeno)"
                              : size <= 150
                              ? "(Médio)"
                              : size <= 300
                              ? "(Grande)"
                              : "(Extra Grande)"}
                          </button>
                        ))}
                        <div className="border-t pt-3 mt-3">
                          <input
                            type="number"
                            placeholder="Tamanho personalizado"
                            className="w-full px-3 py-2 border text-xs focus:outline-none focus:border-blue-500 font-medium rounded"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const target = e.target as HTMLInputElement;
                                const size = parseInt(target.value);
                                if (size > 0) {
                                  handleSetRestaurantSize(size);
                                  setShowSizeMenu(false);
                                  target.value = "";
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setEditMode(!editMode)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-2 ${
                editMode
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-emerald-500 text-white hover:bg-emerald-600"
              }`}
            >
              <Edit size={14} />
              {editMode ? "Sair do Editor" : "Editar Layout"}
            </button>

            {editMode && (
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="px-3 py-1.5 bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 text-xs rounded"
                >
                  <Plus size={14} />
                  Adicionar Mesa
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${
                      showAddMenu ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showAddMenu && (
                  <div className="absolute top-full mt-2 bg-white border shadow-lg z-10 min-w-[220px] rounded">
                    <div className="p-4">
                      <h4 className="text-xs font-semibold text-slate-800 mb-3">
                        Formas de Mesa
                      </h4>
                      {[
                        {
                          shape: "square",
                          label: "Quadrada",
                          desc: "4 cadeiras • 2×2m",
                          icon: Square,
                        },
                        {
                          shape: "rectangular",
                          label: "Retangular",
                          desc: "6 cadeiras • 3×1.5m",
                          icon: RectangleHorizontal,
                        },
                        {
                          shape: "circular",
                          label: "Redonda",
                          desc: "6 cadeiras • 2.3×2.3m",
                          icon: Circle,
                        },
                        {
                          shape: "bar",
                          label: "Mesa de Bar",
                          desc: "8 cadeiras • 5×1m",
                          icon: Minus,
                        },
                      ].map((option) => {
                        const IconComponent = option.icon;
                        return (
                          <button
                            key={option.shape}
                            onClick={() => {
                              addTable(option.shape);
                              setShowAddMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 rounded"
                          >
                            <div className="w-7 h-7 bg-blue-50 flex items-center justify-center rounded">
                              <IconComponent
                                size={14}
                                className="text-blue-600"
                              />
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-800 block">
                                {option.label}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {option.desc}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {editMode && (
              <button
                onClick={saveLayout}
                className="px-3 py-1.5 bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors flex items-center gap-2 text-xs rounded"
              >
                <Save size={14} />
                Guardar Layout
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex items-center justify-center overflow-auto p-4">
            <div
              ref={containerRef}
              className="relative border-2 border-slate-200 bg-white shadow-sm"
              style={{
                backgroundImage: `
                linear-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 0, 0, 0.08) 1px, transparent 1px)
              `,
                backgroundSize: "20px 20px",
                width: `${maxDimensions.width}px`,
                height: `${maxDimensions.height}px`,
                borderRadius: "8px",
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={() => {
                setShowAddMenu(false);
                setShowSizeMenu(false);
              }}
            >
              {tables.map((table) => (
                <div
                  key={table.id}
                  className={`absolute ${
                    editMode ? "cursor-move" : "cursor-default"
                  } ${
                    selectedTable === table.id
                      ? "ring-2 ring-blue-500 z-10"
                      : ""
                  } ${
                    draggedTable === table.id
                      ? ""
                      : "transition-all duration-100"
                  }`}
                  style={{
                    left: `${table.x}px`,
                    top: `${table.y}px`,
                    width: `${table.width}px`,
                    height: `${table.height}px`,
                    transform: `rotate(${table.rotation}deg)`,
                    transformOrigin: "center center",
                  }}
                  onMouseDown={(e) => handleMouseDown(e, table)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editMode) setSelectedTable(table.id);
                  }}
                >
                  <div
                    className={`w-full h-full border-2 flex items-center justify-center transition-colors ${
                      selectedTable === table.id
                        ? "bg-blue-50 border-blue-500 shadow-md"
                        : "bg-white border-slate-300 hover:border-slate-400 shadow-sm"
                    }`}
                    style={getTableStyle(table)}
                  >
                    <span
                      className={`text-base font-bold ${
                        selectedTable === table.id
                          ? "text-blue-700"
                          : "text-slate-700"
                      } ${!editMode ? "select-none" : ""}`}
                    >
                      {table.tableNumber}
                    </span>
                  </div>

                  {getChairPositions(table).map((chairPos, i) => (
                    <div
                      key={i}
                      className={`absolute w-4 h-4 transition-colors ${
                        selectedTable === table.id
                          ? "bg-blue-600 border border-blue-700"
                          : "bg-slate-600 border border-slate-700"
                      }`}
                      style={{
                        left: "50%",
                        top: "50%",
                        transform: `translate(-50%, -50%) translate(${
                          chairPos.x
                        }px, ${chairPos.y}px) rotate(${
                          -table.rotation + (chairPos.rotation || 0)
                        }deg)`,
                        borderRadius: "2px",
                      }}
                    />
                  ))}
                </div>
              ))}

              {tables.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-slate-400">
                    <Grid size={64} className="mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-semibold mb-2 text-slate-600">
                      Nenhuma mesa no layout
                    </p>
                    <p className="text-sm max-w-md text-slate-500">
                      {editMode
                        ? 'Clique em "Adicionar Mesa" para começar a desenhar a planta'
                        : "Entre no modo de edição para adicionar mesas ao layout"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {editMode && selectedTableData && (
            <div className="w-80 bg-white border-l border-slate-200 overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-10 h-10 bg-blue-100 flex items-center justify-center"
                    style={{ borderRadius: "6px" }}
                  >
                    <span className="text-blue-700 font-bold">
                      {selectedTableData.tableNumber}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Mesa {selectedTableData.tableNumber}
                    </h3>
                    <p className="text-sm text-slate-500">
                      Configurar propriedades
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div
                    className="bg-slate-50 p-4"
                    style={{ borderRadius: "6px" }}
                  >
                    <label className="block text-sm font-semibold text-slate-800 mb-3">
                      Forma da Mesa
                    </label>
                    <select
                      value={selectedTableData.shape || "square"}
                      onChange={(e) =>
                        updateTableShape(selectedTable!, e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 focus:outline-none focus:border-blue-500 bg-white font-medium"
                      style={{ borderRadius: "4px" }}
                    >
                      <option value="square">Quadrada</option>
                      <option value="rectangular">Retangular</option>
                      <option value="circular">Redonda</option>
                      <option value="bar">Mesa de Bar</option>
                    </select>
                  </div>

                  <div
                    className="bg-slate-50 p-4"
                    style={{ borderRadius: "6px" }}
                  >
                    <label className="block text-sm font-semibold text-slate-800 mb-3">
                      Posição
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-2 font-medium">
                          X (píxeis)
                        </label>
                        <input
                          type="number"
                          value={selectedTableData.x}
                          onChange={(e) => {
                            const newX = Math.max(
                              0,
                              parseInt(e.target.value) || 0
                            );
                            setTables((prevTables) =>
                              prevTables.map((table) => {
                                if (table.id === selectedTable) {
                                  const updated = { ...table, x: newX };
                                  return updated;
                                }
                                return table;
                              })
                            );
                          }}
                          className="w-full px-3 py-2 border border-slate-300 text-sm focus:outline-none focus:border-blue-500 font-medium"
                          style={{ borderRadius: "4px" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-2 font-medium">
                          Y (píxeis)
                        </label>
                        <input
                          type="number"
                          value={selectedTableData.y}
                          onChange={(e) => {
                            const newY = Math.max(
                              0,
                              parseInt(e.target.value) || 0
                            );
                            setTables((prevTables) =>
                              prevTables.map((table) => {
                                if (table.id === selectedTable) {
                                  const updated = { ...table, y: newY };
                                  return updated;
                                }
                                return table;
                              })
                            );
                          }}
                          className="w-full px-3 py-2 border border-slate-300 text-sm focus:outline-none focus:border-blue-500 font-medium"
                          style={{ borderRadius: "4px" }}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    className="bg-slate-50 p-4"
                    style={{ borderRadius: "6px" }}
                  >
                    <label className="block text-sm font-semibold text-slate-800 mb-3">
                      Tamanho
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-2 font-medium">
                          {selectedTableData.shape === "circular"
                            ? "Diâmetro (m)"
                            : "Largura (m)"}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={(
                            selectedTableData.width / PIXELS_PER_METER
                          ).toFixed(1)}
                          onChange={(e) =>
                            updateTableSize(
                              selectedTable!,
                              "width",
                              parseFloat(e.target.value) || 1
                            )
                          }
                          className="w-full px-3 py-2 border border-slate-300 text-sm focus:outline-none focus:border-blue-500 font-medium"
                          style={{ borderRadius: "4px" }}
                          min="1"
                          max="15"
                        />
                      </div>
                      {selectedTableData.shape !== "circular" && (
                        <div>
                          <label className="block text-xs text-slate-600 mb-2 font-medium">
                            Altura (m)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={(
                              selectedTableData.height / PIXELS_PER_METER
                            ).toFixed(1)}
                            onChange={(e) =>
                              updateTableSize(
                                selectedTable!,
                                "height",
                                parseFloat(e.target.value) || 1
                              )
                            }
                            className="w-full px-3 py-2 border border-slate-300 text-sm focus:outline-none focus:border-blue-500 font-medium"
                            style={{ borderRadius: "4px" }}
                            min="1"
                            max="15"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      <label className="block text-xs text-slate-600 mb-2 font-medium">
                        Predefinições Rápidas
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Pequena", w: 1.5, h: 1.5 },
                          { label: "Média", w: 2.3, h: 2.3 },
                          { label: "Grande", w: 3, h: 3 },
                          { label: "Larga", w: 3.8, h: 2 },
                          { label: "Longa", w: 4.5, h: 1.5 },
                          { label: "Bar", w: 5.5, h: 1.1 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            onClick={() => {
                              updateTableSize(
                                selectedTable!,
                                "width",
                                preset.w
                              );
                              if (selectedTableData.shape !== "circular") {
                                updateTableSize(
                                  selectedTable!,
                                  "height",
                                  preset.h
                                );
                              }
                            }}
                            className="px-2 py-2 text-xs bg-white hover:bg-blue-50 border border-slate-200 transition-colors font-semibold hover:border-blue-300"
                            style={{ borderRadius: "4px" }}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedTableData.shape !== "circular" && (
                    <div
                      className="bg-slate-50 p-4"
                      style={{ borderRadius: "6px" }}
                    >
                      <label className="block text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                        <Settings size={16} />
                        Posição das Cadeiras
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: "top", label: "Topo" },
                          { key: "right", label: "Direita" },
                          { key: "bottom", label: "Base" },
                          { key: "left", label: "Esquerda" },
                        ].map((side) => (
                          <label
                            key={side.key}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={
                                selectedTableData.chairSides[
                                  side.key as keyof typeof selectedTableData.chairSides
                                ]
                              }
                              onChange={(e) =>
                                updateChairSides(
                                  selectedTable!,
                                  side.key,
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                              style={{ borderRadius: "3px" }}
                            />
                            <span className="text-sm font-medium text-slate-700">
                              {side.label}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Desmarque os lados onde não quer cadeiras
                      </p>
                    </div>
                  )}

                  <div
                    className="bg-slate-50 p-4"
                    style={{ borderRadius: "6px" }}
                  >
                    <label className="block text-sm font-semibold text-slate-800 mb-3">
                      Cadeiras ({selectedTableData.chairs} /{" "}
                      {getMaxChairs(
                        selectedTableData.width,
                        selectedTableData.height,
                        selectedTableData.shape
                      )}
                      )
                    </label>
                    <input
                      type="range"
                      min="1"
                      max={getMaxChairs(
                        selectedTableData.width,
                        selectedTableData.height,
                        selectedTableData.shape
                      )}
                      value={selectedTableData.chairs}
                      onChange={(e) =>
                        updateTableChairs(
                          selectedTable!,
                          parseInt(e.target.value)
                        )
                      }
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
                      <span>1</span>
                      <span>
                        {getMaxChairs(
                          selectedTableData.width,
                          selectedTableData.height,
                          selectedTableData.shape
                        )}
                      </span>
                    </div>
                  </div>

                  <div
                    className="bg-slate-50 p-4"
                    style={{ borderRadius: "6px" }}
                  >
                    <label className="block text-sm font-semibold text-slate-800 mb-3">
                      Número da Mesa
                    </label>
                    <input
                      type="number"
                      value={selectedTableData.tableNumber}
                      onChange={(e) => {
                        const newNumber = Math.max(
                          1,
                          parseInt(e.target.value) || 1
                        );
                        setTables((prevTables) =>
                          prevTables.map((table) => {
                            if (table.id === selectedTable) {
                              const updated = {
                                ...table,
                                tableNumber: newNumber,
                              };
                              return updated;
                            }
                            return table;
                          })
                        );
                      }}
                      className="w-full px-3 py-2 border border-slate-300 focus:outline-none focus:border-blue-500 font-medium"
                      style={{ borderRadius: "4px" }}
                      min="1"
                    />
                  </div>

                  <div
                    className="bg-slate-50 p-4"
                    style={{ borderRadius: "6px" }}
                  >
                    <label className="block text-sm font-semibold text-slate-800 mb-3">
                      Rotação ({selectedTableData.rotation}°)
                    </label>
                    <button
                      onClick={() => rotateTable(selectedTable!)}
                      className="w-full px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      style={{ borderRadius: "4px" }}
                    >
                      <RotateCw size={16} />
                      Rodar 90°
                    </button>
                  </div>

                  <button
                    onClick={() => deleteTable(selectedTable!)}
                    className="w-full px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                    style={{ borderRadius: "4px" }}
                  >
                    <Trash2 size={16} />
                    Eliminar Mesa
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestaurantFloorPlan;
