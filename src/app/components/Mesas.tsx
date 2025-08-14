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
  Shield,
  ShieldX,
  AlertTriangle,
  X,
} from "lucide-react";
import { databases, client } from "@/lib/appwrite";
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

interface User {
  labels: string[];
  name: string;
  email: string;
}

interface RestaurantFloorPlanProps {
  user: User;
}

const RestaurantFloorPlan: React.FC<RestaurantFloorPlanProps> = ({ user }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [savedTables, setSavedTables] = useState<Table[]>([]); // Store the last saved state
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
  const [isManager, setIsManager] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingLayout, setSavingLayout] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const PIXELS_PER_METER = 40;

  // Check user permissions
  useEffect(() => {
    setIsManager(user.labels.includes("manager"));
    setLoading(false);
  }, [user]);

  // Check for unsaved changes
  useEffect(() => {
    if (editMode && savedTables.length > 0) {
      const hasChanges = JSON.stringify(tables) !== JSON.stringify(savedTables);
      setHasUnsavedChanges(hasChanges);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [tables, savedTables, editMode]);

  // Show notification function
  const showNotification = (
    message: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Realtime subscription for tables (only update when not in edit mode)
  useEffect(() => {
    if (!client || editMode) return;

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${COLLECTION_ID}.documents`,
      (response) => {
        if (
          response.events.includes(
            `databases.${DATABASE_ID}.collections.${COLLECTION_ID}.documents.*.create`
          )
        ) {
          const newTable = response.payload;
          const tableData = {
            id: newTable.$id,
            x: newTable.posX,
            y: newTable.posY,
            width: newTable.width,
            height: newTable.height,
            chairs: newTable.chairs,
            rotation: newTable.rotation,
            tableNumber: newTable.tableNumber,
            shape: newTable.shape,
            chairSides: {
              top: newTable.chairTop ?? true,
              right: newTable.chairRight ?? true,
              bottom: newTable.chairBottom ?? true,
              left: newTable.chairLeft ?? true,
            },
          };
          setTables((prevTables) => [
            ...prevTables.filter((t) => t.id !== newTable.$id),
            tableData,
          ]);
          setSavedTables((prevTables) => [
            ...prevTables.filter((t) => t.id !== newTable.$id),
            tableData,
          ]);
        }

        if (
          response.events.includes(
            `databases.${DATABASE_ID}.collections.${COLLECTION_ID}.documents.*.update`
          )
        ) {
          const updatedTable = response.payload;
          const tableData = {
            id: updatedTable.$id,
            x: updatedTable.posX,
            y: updatedTable.posY,
            width: updatedTable.width,
            height: updatedTable.height,
            chairs: updatedTable.chairs,
            rotation: updatedTable.rotation,
            tableNumber: updatedTable.tableNumber,
            shape: updatedTable.shape,
            chairSides: {
              top: updatedTable.chairTop ?? true,
              right: updatedTable.chairRight ?? true,
              bottom: updatedTable.chairBottom ?? true,
              left: updatedTable.chairLeft ?? true,
            },
          };
          setTables((prevTables) =>
            prevTables.map((table) =>
              table.id === updatedTable.$id ? tableData : table
            )
          );
          setSavedTables((prevTables) =>
            prevTables.map((table) =>
              table.id === updatedTable.$id ? tableData : table
            )
          );
        }

        if (
          response.events.includes(
            `databases.${DATABASE_ID}.collections.${COLLECTION_ID}.documents.*.delete`
          )
        ) {
          const deletedTable = response.payload;
          setTables((prevTables) =>
            prevTables.filter((table) => table.id !== deletedTable.$id)
          );
          setSavedTables((prevTables) =>
            prevTables.filter((table) => table.id !== deletedTable.$id)
          );
        }
      }
    );

    return () => {
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [editMode]);

  // Realtime subscription for settings
  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${SETTINGS_COLLECTION_ID}.documents`,
      (response) => {
        if (
          response.events.includes(
            `databases.${DATABASE_ID}.collections.${SETTINGS_COLLECTION_ID}.documents.*.update`
          )
        ) {
          const updatedSettings = response.payload;
          if (updatedSettings.$id === SETTINGS_DOCUMENT_ID) {
            setRestaurantSize(updatedSettings.size);
          }
        }
      }
    );

    return () => {
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const getMaxDimensions = () => {
    const baseSize = Math.sqrt(restaurantSize) * 60;
    return {
      width: Math.min(1200, Math.max(400, baseSize * 1.2)),
      height: Math.min(900, Math.max(300, baseSize)),
    };
  };

  const handleSetRestaurantSize = async (size: number) => {
    if (!isManager) return;

    setRestaurantSize(size);
    try {
      await databases.updateDocument(
        DATABASE_ID,
        SETTINGS_COLLECTION_ID,
        SETTINGS_DOCUMENT_ID,
        { id: SETTINGS_DOCUMENT_ID, size }
      );
      showNotification("Tamanho do restaurante atualizado!", "success");
    } catch (err) {
      try {
        await databases.createDocument(
          DATABASE_ID,
          SETTINGS_COLLECTION_ID,
          SETTINGS_DOCUMENT_ID,
          { id: SETTINGS_DOCUMENT_ID, size }
        );
        showNotification("Tamanho do restaurante definido!", "success");
      } catch (createErr) {
        console.error(
          "Erro ao criar/atualizar tamanho do restaurante:",
          createErr
        );
        showNotification("Erro ao atualizar tamanho do restaurante", "error");
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
        if (isManager) {
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
      }
    };
    if (!loading) {
      fetchSettings();
    }
  }, [isManager, loading]);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
          Query.limit(100),
        ]);
        const tablesData = res.documents.map((doc: any) => ({
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
        }));
        setTables(tablesData);
        setSavedTables(JSON.parse(JSON.stringify(tablesData))); // Deep copy for saved state
      } catch (err) {
        console.error("Erro ao buscar mesas:", err);
      }
    };
    fetchTables();
  }, []);

  const handleEditModeToggle = () => {
    if (editMode && hasUnsavedChanges) {
      setShowConfirmDialog(true);
    } else {
      toggleEditMode();
    }
  };

  const toggleEditMode = () => {
    if (editMode) {
      // Reset to saved state when exiting edit mode
      setTables(JSON.parse(JSON.stringify(savedTables)));
      setSelectedTable(null);
      setHasUnsavedChanges(false);
    }
    setEditMode(!editMode);
  };

  const confirmDiscardChanges = () => {
    setShowConfirmDialog(false);
    toggleEditMode();
  };

  const cancelDiscardChanges = () => {
    setShowConfirmDialog(false);
  };

  const saveLayout = async () => {
    if (!isManager) return;

    setSavingLayout(true);
    showNotification("A guardar layout...", "info");

    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
        Query.limit(100),
      ]);
      const existingIds = res.documents.map((doc: any) => doc.$id);

      // Handle updates and creates
      for (const table of tables) {
        if (table.id && existingIds.includes(table.id)) {
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
          // Create new table with temporary ID
          const newId = ID.unique();
          await databases.createDocument(DATABASE_ID, COLLECTION_ID, newId, {
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
          // Update the table with the real ID
          setTables((prevTables) =>
            prevTables.map((t) => (t.id === table.id ? { ...t, id: newId } : t))
          );
        }
      }

      // Handle deletions
      for (const id of existingIds) {
        if (!tables.find((t) => t.id === id)) {
          await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, id);
        }
      }

      // Update saved state
      setSavedTables(JSON.parse(JSON.stringify(tables)));
      setHasUnsavedChanges(false);
      showNotification("Layout guardado com sucesso!", "success");

      // Exit edit mode after successful save
      setTimeout(() => {
        setEditMode(false);
        setSelectedTable(null);
      }, 1000);
    } catch (err) {
      console.error("Erro ao salvar layout:", err);
      showNotification("Erro ao guardar layout", "error");
    } finally {
      setSavingLayout(false);
    }
  };

  const addTable = (shape: string = "square") => {
    if (!isManager) return;

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
    const newTable: Table = {
      id: `temp_${Date.now()}`, // Temporary ID
      x: 100,
      y: 100,
      width: preset.width,
      height: shape === "circular" ? preset.width : preset.height,
      chairs: preset.chairs,
      rotation: 0,
      tableNumber: tables.length + 1,
      shape: shape,
      chairSides: {
        top: true,
        right: true,
        bottom: true,
        left: true,
      },
    };

    setTables((prevTables) => [...prevTables, newTable]);
    showNotification("Mesa adicionada (não guardada)", "info");
  };

  const handleMouseDown = (e: React.MouseEvent, table: Table) => {
    if (!editMode || !isManager) return;

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
    if (!draggedTable || !editMode || !isManager || !containerRef.current)
      return;

    const rect = containerRef.current.getBoundingClientRect();
    const maxDim = getMaxDimensions();

    const table = tables.find((t) => t.id === draggedTable);
    if (!table) return;

    const rad = (table.rotation * Math.PI) / 180;
    const rotatedWidth =
      Math.abs(Math.cos(rad)) * table.width +
      Math.abs(Math.sin(rad)) * table.height;
    const rotatedHeight =
      Math.abs(Math.sin(rad)) * table.width +
      Math.abs(Math.cos(rad)) * table.height;

    const centerOffsetX = table.width / 2;
    const centerOffsetY = table.height / 2;

    let centerX = e.clientX - rect.left - dragOffset.x + centerOffsetX;
    let centerY = e.clientY - rect.top - dragOffset.y + centerOffsetY;

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
    setDraggedTable(null);
  };

  const rotateTable = (tableId: string) => {
    if (!isManager) return;

    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.id === tableId) {
          return { ...table, rotation: (table.rotation + 90) % 360 };
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

  const updateTableChairs = (tableId: string, chairs: number) => {
    if (!isManager) return;

    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.id === tableId) {
          const maxChairs = getMaxChairs(
            table.width,
            table.height,
            table.shape
          );
          return {
            ...table,
            chairs: Math.max(1, Math.min(maxChairs, chairs)),
          };
        }
        return table;
      })
    );
  };

  const updateTableSize = (
    tableId: string,
    dimension: "width" | "height",
    value: number
  ) => {
    if (!isManager) return;

    const pixelValue = value * PIXELS_PER_METER;
    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.id === tableId) {
          let updated = {
            ...table,
            [dimension]: Math.max(40, Math.min(600, pixelValue)),
          };

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

  const updateTableShape = (tableId: string, newShape: string) => {
    if (!isManager) return;

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
    tableId: string,
    side: string,
    enabled: boolean
  ) => {
    if (!isManager) return;

    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.id === tableId) {
          const newChairSides = {
            ...table.chairSides,
            [side]: enabled,
          };

          // Check if at least one side is enabled
          const enabledSides = Object.values(newChairSides).filter(Boolean);

          // If trying to disable the last enabled side, prevent it
          if (enabledSides.length === 0) {
            showNotification(
              "Deve manter pelo menos um lado com cadeiras",
              "error"
            );
            return table; // Don't update if it would result in no sides
          }

          return {
            ...table,
            chairSides: newChairSides,
          };
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

  const deleteTable = (tableId: string) => {
    if (!isManager) return;

    setTables((prevTables) =>
      prevTables.filter((table) => table.id !== tableId)
    );
    setSelectedTable(null);
    showNotification("Mesa eliminada (não guardado)", "info");
  };

  const selectedTableData = tables.find((table) => table.id === selectedTable);
  const maxDimensions = getMaxDimensions();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-white/50 p-8 max-w-md w-full mx-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                <AlertTriangle size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Alterações não guardadas
                </h3>
                <p className="text-sm text-slate-600">
                  Tem a certeza que quer sair?
                </p>
              </div>
            </div>
            <p className="text-slate-700 mb-8">
              Tem alterações não guardadas que serão perdidas se sair do modo de
              edição. Quer guardar as alterações primeiro ou descartar?
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDiscardChanges}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-medium hover:from-red-700 hover:to-red-800 transition-all duration-200 rounded-xl shadow-lg"
              >
                Descartar alterações
              </button>
              <button
                onClick={cancelDiscardChanges}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 font-medium hover:from-slate-300 hover:to-slate-400 transition-all duration-200 rounded-xl shadow-lg"
              >
                Continuar a editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-sm transform transition-all duration-300 ${
            notification.type === "success"
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-700"
              : notification.type === "error"
              ? "bg-red-50/90 border-red-200 text-red-700"
              : "bg-blue-50/90 border-blue-200 text-blue-700"
          }`}
          style={{
            animation: "slideInRight 0.3s ease-out",
          }}
        >
          <div className="flex items-center gap-3">
            {notification.type === "success" && (
              <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                >
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
            )}
            {notification.type === "error" && (
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <path d="m21 21-9-9m0 0L3 3m9 9 9-9m-9 9-9 9" />
                </svg>
              </div>
            )}
            {notification.type === "info" && (
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <path d="m12 16 4-4-4-4" />
                  <path d="M8 12h8" />
                </svg>
              </div>
            )}
            <span className="font-medium text-sm">{notification.message}</span>
          </div>
        </div>
      )}

      <div
        className="min-w-[920px] bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 flex flex-col p-8"
        style={{
          maxHeight: "90vh",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.95) 50%, rgba(241,245,249,0.9) 100%)",
        }}
      >
        <div className="flex items-center justify-between px-0 py-1">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Grid size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Layout do Restaurante
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {isManager ? (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Shield size={14} />
                    <span className="text-sm font-medium">Gestor</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600">
                    <ShieldX size={14} />
                    <span className="text-sm font-medium">
                      Modo Visualização
                    </span>
                  </div>
                )}
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-2 text-orange-600 ml-4">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium">
                      Alterações não guardadas
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {editMode && isManager && (
              <div className="relative">
                <button
                  onClick={() => setShowSizeMenu(!showSizeMenu)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium border-0 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 text-sm rounded-xl shadow-lg"
                >
                  <Ruler size={16} />
                  {restaurantSize}m²
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${
                      showSizeMenu ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showSizeMenu && (
                  <div className="absolute top-full mt-3 bg-white/95 backdrop-blur border border-white/50 shadow-xl z-20 min-w-[220px] rounded-xl overflow-hidden">
                    <div className="p-5">
                      <h4 className="text-sm font-semibold text-slate-800 mb-4">
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
                            className={`w-full text-left px-4 py-3 text-sm transition-all duration-200 font-medium rounded-lg ${
                              restaurantSize === size
                                ? "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {size}m²{" "}
                            <span className="text-xs opacity-70">
                              {size <= 75
                                ? "(Pequeno)"
                                : size <= 150
                                ? "(Médio)"
                                : size <= 300
                                ? "(Grande)"
                                : "(Extra Grande)"}
                            </span>
                          </button>
                        ))}
                        <div className="border-t border-slate-200 pt-4 mt-4">
                          <input
                            type="number"
                            placeholder="Tamanho personalizado"
                            className="w-full px-4 py-3 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium rounded-lg transition-all duration-200"
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

            {isManager && (
              <button
                onClick={handleEditModeToggle}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg ${
                  editMode
                    ? "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700"
                    : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700"
                }`}
              >
                <Edit size={16} />
                {editMode ? "Sair do Editor" : "Editar Layout"}
              </button>
            )}

            {editMode && isManager && (
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 text-sm rounded-xl shadow-lg"
                >
                  <Plus size={16} />
                  Adicionar Mesa
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${
                      showAddMenu ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showAddMenu && (
                  <div className="absolute top-full mt-3 bg-white/95 backdrop-blur border border-white/50 shadow-xl z-10 min-w-[240px] rounded-xl overflow-hidden">
                    <div className="p-5">
                      <h4 className="text-sm font-semibold text-slate-800 mb-4">
                        Formas de Mesa
                      </h4>
                      {[
                        {
                          shape: "square",
                          label: "Quadrada",
                          desc: "4 cadeiras • 2×2m",
                          icon: Square,
                          gradient: "from-emerald-50 to-emerald-100",
                          iconColor: "text-emerald-600",
                        },
                        {
                          shape: "rectangular",
                          label: "Retangular",
                          desc: "6 cadeiras • 3×1.5m",
                          icon: RectangleHorizontal,
                          gradient: "from-blue-50 to-blue-100",
                          iconColor: "text-blue-600",
                        },
                        {
                          shape: "circular",
                          label: "Redonda",
                          desc: "6 cadeiras • 2.3×2.3m",
                          icon: Circle,
                          gradient: "from-purple-50 to-purple-100",
                          iconColor: "text-purple-600",
                        },
                        {
                          shape: "bar",
                          label: "Mesa de Bar",
                          desc: "8 cadeiras • 5×1m",
                          icon: Minus,
                          gradient: "from-orange-50 to-orange-100",
                          iconColor: "text-orange-600",
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
                            className="w-full text-left px-4 py-4 hover:bg-slate-50 transition-all duration-200 flex items-center gap-4 rounded-lg group"
                          >
                            <div
                              className={`w-10 h-10 bg-gradient-to-br ${option.gradient} flex items-center justify-center rounded-lg shadow-sm group-hover:shadow-md transition-all duration-200`}
                            >
                              <IconComponent
                                size={18}
                                className={option.iconColor}
                              />
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-slate-800 block">
                                {option.label}
                              </span>
                              <span className="text-xs text-slate-500">
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
            {editMode && isManager && (
              <button
                onClick={saveLayout}
                disabled={savingLayout}
                className={`px-4 py-2 font-medium transition-all duration-200 flex items-center gap-2 text-sm rounded-xl shadow-lg ${
                  savingLayout
                    ? "bg-gradient-to-r from-gray-400 to-gray-500 text-white cursor-not-allowed"
                    : hasUnsavedChanges
                    ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white hover:from-orange-700 hover:to-orange-800 animate-pulse"
                    : "bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800"
                }`}
              >
                {savingLayout ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    A Guardar...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {hasUnsavedChanges
                      ? "Guardar Alterações"
                      : "Guardar Layout"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex items-center justify-center overflow-auto p-4">
            <div
              ref={containerRef}
              className="relative border-2 border-white/60 bg-white/50 shadow-xl backdrop-blur-sm"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                  radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 70%)
                `,
                backgroundSize: "20px 20px, 20px 20px, 100% 100%",
                width: `${maxDimensions.width}px`,
                height: `${maxDimensions.height}px`,
                borderRadius: "16px",
                boxShadow: "inset 0 0 40px rgba(59, 130, 246, 0.1)",
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
                    editMode && isManager ? "cursor-move" : "cursor-default"
                  } ${
                    selectedTable === table.id
                      ? "ring-4 ring-blue-400/50 z-10"
                      : ""
                  } ${
                    draggedTable === table.id
                      ? "scale-105"
                      : "transition-all duration-200"
                  } group ${
                    table.id.startsWith("temp_")
                      ? "ring-2 ring-orange-400/50"
                      : ""
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
                    if (editMode && isManager) setSelectedTable(table.id);
                  }}
                >
                  <div
                    className={`w-full h-full border-2 flex items-center justify-center transition-all duration-200 ${
                      selectedTable === table.id
                        ? "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-400 shadow-xl"
                        : table.id.startsWith("temp_")
                        ? "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-400 shadow-lg hover:shadow-xl group-hover:from-orange-100 group-hover:to-orange-200"
                        : "bg-gradient-to-br from-white to-slate-50 border-slate-300 hover:border-slate-400 shadow-lg hover:shadow-xl group-hover:from-slate-50 group-hover:to-slate-100"
                    }`}
                    style={{
                      ...getTableStyle(table),
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <span
                      className={`text-lg font-bold transition-colors duration-200 ${
                        selectedTable === table.id
                          ? "text-blue-700"
                          : table.id.startsWith("temp_")
                          ? "text-orange-700"
                          : "text-slate-700 group-hover:text-slate-800"
                      } ${!editMode ? "select-none" : ""}`}
                    >
                      {table.tableNumber}
                    </span>
                  </div>

                  {getChairPositions(table).map((chairPos, i) => (
                    <div
                      key={i}
                      className={`absolute w-5 h-5 transition-all duration-200 shadow-sm ${
                        selectedTable === table.id
                          ? "bg-gradient-to-br from-blue-500 to-blue-600 border border-blue-700 shadow-md"
                          : table.id.startsWith("temp_")
                          ? "bg-gradient-to-br from-orange-500 to-orange-600 border border-orange-700 shadow-md"
                          : "bg-gradient-to-br from-slate-600 to-slate-700 border border-slate-800 group-hover:from-slate-500 group-hover:to-slate-600"
                      }`}
                      style={{
                        left: "50%",
                        top: "50%",
                        transform: `translate(-50%, -50%) translate(${
                          chairPos.x
                        }px, ${chairPos.y}px) rotate(${
                          -table.rotation + (chairPos.rotation || 0)
                        }deg)`,
                        borderRadius: "3px",
                      }}
                    />
                  ))}
                </div>
              ))}

              {tables.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-slate-400">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center shadow-lg">
                      <Grid size={32} className="opacity-60" />
                    </div>
                    <p className="text-xl font-semibold mb-3 text-slate-600">
                      Nenhuma mesa no layout
                    </p>
                    <p className="text-sm max-w-md text-slate-500 leading-relaxed">
                      {editMode && isManager
                        ? 'Clique em "Adicionar Mesa" para começar a desenhar a planta'
                        : isManager
                        ? "Entre no modo de edição para adicionar mesas ao layout"
                        : "Este layout está vazio. Contacte um gestor para adicionar mesas."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {editMode && isManager && selectedTableData && (
            <div className="w-80 bg-white/70 backdrop-blur border-l border-white/50 overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className={`w-12 h-12 bg-gradient-to-br ${
                      selectedTableData.id.startsWith("temp_")
                        ? "from-orange-500 to-orange-600"
                        : "from-blue-500 to-blue-600"
                    } flex items-center justify-center rounded-xl shadow-lg`}
                  >
                    <span className="text-white font-bold text-lg">
                      {selectedTableData.tableNumber}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      Mesa {selectedTableData.tableNumber}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {selectedTableData.id.startsWith("temp_")
                        ? "Nova mesa (não guardada)"
                        : "Configurar propriedades"}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white/60 backdrop-blur p-5 rounded-xl border border-white/50">
                    <label className="block text-sm font-semibold text-slate-800 mb-4">
                      Forma da Mesa
                    </label>
                    <select
                      value={selectedTableData.shape || "square"}
                      onChange={(e) =>
                        updateTableShape(selectedTable!, e.target.value)
                      }
                      className="w-full px-4 py-3 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur font-medium text-slate-800 rounded-lg transition-all duration-200"
                    >
                      <option value="square">Quadrada</option>
                      <option value="rectangular">Retangular</option>
                      <option value="circular">Redonda</option>
                      <option value="bar">Mesa de Bar</option>
                    </select>
                  </div>

                  <div className="bg-white/60 backdrop-blur p-5 rounded-xl border border-white/50">
                    <label className="block text-sm font-semibold text-slate-800 mb-4">
                      Posição
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-600 mb-2 font-medium">
                          X (píxeis)
                        </label>
                        <input
                          type="number"
                          value={Math.round(selectedTableData.x)}
                          onChange={(e) => {
                            const newX = Math.max(
                              0,
                              parseInt(e.target.value) || 0
                            );
                            setTables((prevTables) =>
                              prevTables.map((table) => {
                                if (table.id === selectedTable) {
                                  return { ...table, x: newX };
                                }
                                return table;
                              })
                            );
                          }}
                          className="w-full px-3 py-2 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-slate-800 bg-white/80 backdrop-blur rounded-lg transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-2 font-medium">
                          Y (píxeis)
                        </label>
                        <input
                          type="number"
                          value={Math.round(selectedTableData.y)}
                          onChange={(e) => {
                            const newY = Math.max(
                              0,
                              parseInt(e.target.value) || 0
                            );
                            setTables((prevTables) =>
                              prevTables.map((table) => {
                                if (table.id === selectedTable) {
                                  return { ...table, y: newY };
                                }
                                return table;
                              })
                            );
                          }}
                          className="w-full px-3 py-2 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-slate-800 bg-white/80 backdrop-blur rounded-lg transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/60 backdrop-blur p-5 rounded-xl border border-white/50">
                    <label className="block text-sm font-semibold text-slate-800 mb-4">
                      Tamanho
                    </label>
                    <div className="grid grid-cols-2 gap-4">
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
                          className="w-full px-3 py-2 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-slate-800 bg-white/80 backdrop-blur rounded-lg transition-all duration-200"
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
                            className="w-full px-3 py-2 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-slate-800 bg-white/80 backdrop-blur rounded-lg transition-all duration-200"
                            min="1"
                            max="15"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-5">
                      <label className="block text-xs text-slate-600 mb-3 font-medium">
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
                            className="px-3 py-2 text-xs bg-white/80 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-all duration-200 font-semibold text-slate-800 rounded-lg shadow-sm hover:shadow-md backdrop-blur"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedTableData.shape !== "circular" && (
                    <div className="bg-white/60 backdrop-blur p-5 rounded-xl border border-white/50">
                      <label className="block text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Settings size={16} />
                        Posição das Cadeiras
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { key: "top", label: "Topo" },
                          { key: "right", label: "Direita" },
                          { key: "bottom", label: "Base" },
                          { key: "left", label: "Esquerda" },
                        ].map((side) => (
                          <label
                            key={side.key}
                            className="flex items-center gap-3 cursor-pointer"
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
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded transition-all duration-200"
                            />
                            <span className="text-sm font-medium text-slate-700">
                              {side.label}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                        Desmarque os lados onde não quer cadeiras
                      </p>
                    </div>
                  )}

                  <div className="bg-white/60 backdrop-blur p-5 rounded-xl border border-white/50">
                    <label className="block text-sm font-semibold text-slate-800 mb-4">
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
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${
                          (selectedTableData.chairs /
                            getMaxChairs(
                              selectedTableData.width,
                              selectedTableData.height,
                              selectedTableData.shape
                            )) *
                          100
                        }%, rgb(226 232 240) ${
                          (selectedTableData.chairs /
                            getMaxChairs(
                              selectedTableData.width,
                              selectedTableData.height,
                              selectedTableData.shape
                            )) *
                          100
                        }%, rgb(226 232 240) 100%)`,
                      }}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-3 font-medium">
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

                  <div className="bg-white/60 backdrop-blur p-5 rounded-xl border border-white/50">
                    <label className="block text-sm font-semibold text-slate-800 mb-4">
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
                              return {
                                ...table,
                                tableNumber: newNumber,
                              };
                            }
                            return table;
                          })
                        );
                      }}
                      className="w-full px-4 py-3 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-slate-800 bg-white/80 backdrop-blur rounded-lg transition-all duration-200"
                      min="1"
                    />
                  </div>

                  <div className="bg-white/60 backdrop-blur p-5 rounded-xl border border-white/50">
                    <label className="block text-sm font-semibold text-slate-800 mb-4">
                      Rotação ({selectedTableData.rotation}°)
                    </label>
                    <button
                      onClick={() => rotateTable(selectedTable!)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center gap-2 rounded-lg shadow-lg"
                    >
                      <RotateCw size={16} />
                      Rodar 90°
                    </button>
                  </div>

                  <button
                    onClick={() => deleteTable(selectedTable!)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-medium hover:from-red-700 hover:to-red-800 transition-all duration-200 flex items-center justify-center gap-2 rounded-lg shadow-lg"
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
