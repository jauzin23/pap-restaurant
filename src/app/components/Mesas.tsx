"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
// Importação direta de ícones para bundle menor
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
  Copy,
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
  status?: string;
  chairSides: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

interface AppwriteDocument {
  $id: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  chairs: number;
  rotation: number;
  tableNumber: number;
  shape: string;
  status?: string;
  chairTop?: boolean;
  chairRight?: boolean;
  chairBottom?: boolean;
  chairLeft?: boolean;
}

interface AppwriteResponse {
  payload: AppwriteDocument;
  events: string[];
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

const RestaurantFloorPlan = React.memo(function RestaurantFloorPlan({
  // ...existing state and hooks...
  user,
}: RestaurantFloorPlanProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [savedTables, setSavedTables] = useState<Table[]>([]);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [draggedTable, setDraggedTable] = useState<string | null>(null);
  const dragJustStartedRef = useRef(false);
  const clickIntentRef = useRef(false);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tapTableIdRef = useRef<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [restaurantSize, setRestaurantSize] = useState<number>(100);
  const [pendingRestaurantSize, setPendingRestaurantSize] =
    useState<number>(100);
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
  const [tableNumberError, setTableNumberError] = useState<string>("");
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  // Estado local para inputs de tamanho (edição sem atualização imediata)
  const [sizeInputs, setSizeInputs] = useState<{
    width: string;
    height: string;
  }>({ width: "", height: "" });

  // Guardar posição de arrasto sem re-render
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);

  const PIXELS_PER_METER = 40;

  // Função auxiliar para obter o próximo número de mesa disponível
  const getNextAvailableTableNumber = (): number => {
    const existingNumbers = tables.map((table) => table.tableNumber);
    let nextNumber = 1;
    while (existingNumbers.includes(nextNumber)) {
      nextNumber++;
    }
    return nextNumber;
  };

  // Função auxiliar para duplicar uma mesa
  const duplicateTable = (tableId: string) => {
    if (!isManager) return;

    const originalTable = tables.find((table) => table.id === tableId);
    if (!originalTable) return;

    const newTable: Table = {
      ...originalTable,
      id: `temp_${Date.now()}`,
      x: originalTable.x + 50,
      y: originalTable.y + 50,
      tableNumber: getNextAvailableTableNumber(),
    };

    setTables((prevTables) => [...prevTables, newTable]);
    setSelectedTable(newTable.id);
    showNotification(
      `Mesa ${originalTable.tableNumber} duplicada como mesa ${newTable.tableNumber}`,
      "success"
    );
  };

  // Função auxiliar para verificar se o número da mesa está disponível (excluindo a mesa atual)
  const isTableNumberAvailable = (
    number: number,
    excludeTableId?: string
  ): boolean => {
    return !tables.some(
      (table) => table.tableNumber === number && table.id !== excludeTableId
    );
  };

  // Função auxiliar para validar números de mesa antes de guardar
  const validateTableNumbers = (): {
    isValid: boolean;
    duplicates: number[];
  } => {
    const numberCounts = new Map<number, number>();

    tables.forEach((table) => {
      const count = numberCounts.get(table.tableNumber) || 0;
      numberCounts.set(table.tableNumber, count + 1);
    });

    const duplicates = Array.from(numberCounts.entries())
      .filter(([number, count]) => count > 1)
      .map(([number]) => number);

    return {
      isValid: duplicates.length === 0,
      duplicates,
    };
  };

  // Handler de resize da janela para layout responsivo
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    if (typeof window !== "undefined") {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Verificar permissões do utilizador
  useEffect(() => {
    setIsManager(user.labels.includes("manager"));
    setLoading(false);
  }, [user]);

  // Lógica de dimensionamento responsivo baseada em RestLayout.tsx
  const getMaxDimensions = () => {
    const baseSize = Math.sqrt(pendingRestaurantSize) * 60;
    // Use RestLayout.tsx scaling as base
    let scale = 1;
    if (typeof window !== "undefined") {
      if (window.innerWidth < 640) {
        scale = 0.6; // Mobile
      } else if (window.innerWidth < 1024) {
        scale = 0.7; // Tablet
      } else {
        scale = 0.8; // Desktop - same as RestLayout
      }
    }

    // Calculate square canvas based on RestLayout logic but with square proportions
    const baseWidth = Math.max(320, baseSize * 1.2 * scale);
    const baseHeight = Math.max(240, baseSize * scale);

    // Use the larger dimension to make it square
    const canvasSize = Math.max(baseWidth, baseHeight);

    return {
      width: canvasSize,
      height: canvasSize, // Always square
      scale, // Return scale for table scaling
    };
  };

  // Recalculate dimensions when dependencies change
  const maxDimensions = useMemo(
    () => getMaxDimensions(),
    [pendingRestaurantSize, windowSize.width, windowSize.height]
  );

  // Sync pendingRestaurantSize with restaurantSize when restaurantSize changes
  useEffect(() => {
    setPendingRestaurantSize(restaurantSize);
  }, [restaurantSize]);

  // Check for unsaved changes (including restaurant size changes)
  useEffect(() => {
    if (editMode && savedTables.length > 0) {
      const hasTableChanges =
        JSON.stringify(tables) !== JSON.stringify(savedTables);
      const hasSizeChanges = pendingRestaurantSize !== restaurantSize;
      setHasUnsavedChanges(hasTableChanges || hasSizeChanges);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [tables, savedTables, editMode, pendingRestaurantSize, restaurantSize]);

  // Center the canvas on load and when dimensions change
  useEffect(() => {
    const centerCanvas = () => {
      if (scrollContainerRef.current) {
        const scrollContainer = scrollContainerRef.current;

        // Calculate the scrollable area dimensions
        const scrollWidth = Math.max(
          maxDimensions.width + 800,
          windowSize.width
        );
        const scrollHeight = Math.max(
          maxDimensions.height + 600,
          windowSize.height
        );
        const containerWidth = scrollContainer.clientWidth;
        const containerHeight = scrollContainer.clientHeight;

        // Center the scroll position
        const centerX = Math.max(0, (scrollWidth - containerWidth) / 2);
        const centerY = Math.max(0, (scrollHeight - containerHeight) / 2);

        // Scroll to center position
        scrollContainer.scrollTo({
          left: centerX,
          top: centerY,
          behavior: "smooth",
        });
      }
    };

    // Small delay to ensure component is fully rendered
    const timeoutId = setTimeout(centerCanvas, 100);
    return () => clearTimeout(timeoutId);
  }, [maxDimensions, windowSize.width, windowSize.height]);

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
          const newTable = response.payload as AppwriteDocument;
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
            status: newTable.status || "free", // Include status field
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
          const updatedTable = response.payload as AppwriteDocument;
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
            status: updatedTable.status || "free", // Include status field
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
          const deletedTable = response.payload as { $id: string };
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
          const updatedSettings = response.payload as {
            $id: string;
            size: number;
          };
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

  // Calculate scaling factor for tables based on canvas size
  const tableScale = useMemo(() => {
    return maxDimensions.scale || 0.8;
  }, [maxDimensions]);

  const handleSetRestaurantSize = (size: number) => {
    if (!isManager) return;

    // Only update pending size, don't save to database yet
    setPendingRestaurantSize(size);
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
        const tablesData = res.documents.map((doc) => {
          const appwriteDoc = doc as unknown as AppwriteDocument;
          return {
            id: appwriteDoc.$id,
            x: appwriteDoc.posX,
            y: appwriteDoc.posY,
            width: appwriteDoc.width,
            height: appwriteDoc.height,
            chairs: appwriteDoc.chairs,
            rotation: appwriteDoc.rotation,
            tableNumber: appwriteDoc.tableNumber,
            shape: appwriteDoc.shape,
            status: appwriteDoc.status || "free", // Include status field
            chairSides: {
              top: appwriteDoc.chairTop ?? true,
              right: appwriteDoc.chairRight ?? true,
              bottom: appwriteDoc.chairBottom ?? true,
              left: appwriteDoc.chairLeft ?? true,
            },
          };
        });
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
      setPendingRestaurantSize(restaurantSize); // Reset pending size to current saved size
      setSelectedTable(null);
      setHasUnsavedChanges(false);
      setTableNumberError("");
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

    // Validate table numbers before saving
    const validation = validateTableNumbers();
    if (!validation.isValid) {
      showNotification(
        `Erro: Números de mesa duplicados: ${validation.duplicates.join(", ")}`,
        "error"
      );
      return;
    }

    setSavingLayout(true);
    showNotification("A guardar layout...", "info");

    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
        Query.limit(100),
      ]);
      const existingIds = res.documents.map((doc) => doc.$id);

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

      // Save restaurant size if it has changed
      if (pendingRestaurantSize !== restaurantSize) {
        try {
          await databases.updateDocument(
            DATABASE_ID,
            SETTINGS_COLLECTION_ID,
            SETTINGS_DOCUMENT_ID,
            { id: SETTINGS_DOCUMENT_ID, size: pendingRestaurantSize }
          );
          setRestaurantSize(pendingRestaurantSize);
        } catch (err) {
          try {
            await databases.createDocument(
              DATABASE_ID,
              SETTINGS_COLLECTION_ID,
              SETTINGS_DOCUMENT_ID,
              { id: SETTINGS_DOCUMENT_ID, size: pendingRestaurantSize }
            );
            setRestaurantSize(pendingRestaurantSize);
          } catch (createErr) {
            console.error(
              "Erro ao criar/atualizar tamanho do restaurante:",
              createErr
            );
            throw createErr; // Re-throw to be caught by outer catch
          }
        }
      }

      // Update saved state
      setSavedTables(JSON.parse(JSON.stringify(tables)));
      setHasUnsavedChanges(false);
      showNotification("Layout guardado com sucesso!", "success");

      // Redirect to home page after successful save
      setTimeout(() => {
        router.push("/");
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
      tableNumber: getNextAvailableTableNumber(),
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
    if (!editMode || !isManager) {
      // In non-edit mode, allow click
      clickIntentRef.current = true;
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setDraggedTable(table.id);
    dragJustStartedRef.current = true;
    clickIntentRef.current = true;

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const scale = tableScale;
      setDragOffset({
        x: e.clientX - rect.left - table.x * scale,
        y: e.clientY - rect.top - table.y * scale,
      });
    }
  };

  const handleTouchStart = (e: React.TouchEvent, table: Table) => {
    if (!editMode || !isManager) {
      // In non-edit mode, allow tap
      clickIntentRef.current = true;
      return;
    }

    e.stopPropagation();
    setDraggedTable(table.id);
    dragJustStartedRef.current = true;
    clickIntentRef.current = true;

    const rect = containerRef.current?.getBoundingClientRect();
    const touch = e.touches[0];
    if (rect && touch) {
      const scale = tableScale;
      setDragOffset({
        x: touch.clientX - rect.left - table.x * scale,
        y: touch.clientY - rect.top - table.y * scale,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedTable || !editMode || !isManager || !containerRef.current)
      return;

    e.stopPropagation();
    clickIntentRef.current = false; // Moved, so not a click

    const rect = containerRef.current.getBoundingClientRect();
    const scale = tableScale; // Use the same scale as rendering

    const table = tables.find((t) => t.id === draggedTable);
    if (!table) return;

    const rad = (table.rotation * Math.PI) / 180;
    const scaledWidth = table.width * scale;
    const scaledHeight = table.height * scale;

    const rotatedWidth =
      Math.abs(Math.cos(rad)) * scaledWidth +
      Math.abs(Math.sin(rad)) * scaledHeight;
    const rotatedHeight =
      Math.abs(Math.sin(rad)) * scaledWidth +
      Math.abs(Math.cos(rad)) * scaledHeight;

    const centerOffsetX = scaledWidth / 2;
    const centerOffsetY = scaledHeight / 2;

    let centerX = e.clientX - rect.left - dragOffset.x + centerOffsetX;
    let centerY = e.clientY - rect.top - dragOffset.y + centerOffsetY;

    centerX = Math.max(
      rotatedWidth / 2,
      Math.min(maxDimensions.width - rotatedWidth / 2, centerX)
    );
    centerY = Math.max(
      rotatedHeight / 2,
      Math.min(maxDimensions.height - rotatedHeight / 2, centerY)
    );

    const newX = (centerX - centerOffsetX) / scale; // Convert back to unscaled coordinates
    const newY = (centerY - centerOffsetY) / scale; // Convert back to unscaled coordinates

    // Store position in ref instead of updating state immediately
    dragPositionRef.current = { x: newX, y: newY };

    // Update visual position without triggering re-render
    const tableElement = containerRef.current?.querySelector(
      `[data-table-id="${draggedTable}"]`
    ) as HTMLElement;
    if (tableElement) {
      tableElement.style.left = `${newX * scale}px`;
      tableElement.style.top = `${newY * scale}px`;
    }
  };

  const handleMouseUp = () => {
    // Update state only when dragging ends
    if (draggedTable && dragPositionRef.current) {
      const finalPosition = dragPositionRef.current;
      setTables((prevTables) =>
        prevTables.map((table) =>
          table.id === draggedTable
            ? { ...table, x: finalPosition.x, y: finalPosition.y }
            : table
        )
      );
    }

    dragPositionRef.current = null;
    setDraggedTable(null);
    clickIntentRef.current = false;
    // Reset drag flag after drag ends
    setTimeout(() => {
      dragJustStartedRef.current = false;
    }, 0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggedTable || !editMode || !isManager || !containerRef.current)
      return;

    e.stopPropagation();
    clickIntentRef.current = false; // Moved, so not a tap
    const touch = e.touches[0];
    if (!touch) return;

    const rect = containerRef.current.getBoundingClientRect();
    const scale = tableScale; // Use the same scale as rendering

    const table = tables.find((t) => t.id === draggedTable);
    if (!table) return;

    const rad = (table.rotation * Math.PI) / 180;
    const scaledWidth = table.width * scale;
    const scaledHeight = table.height * scale;

    const rotatedWidth =
      Math.abs(Math.cos(rad)) * scaledWidth +
      Math.abs(Math.sin(rad)) * scaledHeight;
    const rotatedHeight =
      Math.abs(Math.sin(rad)) * scaledWidth +
      Math.abs(Math.cos(rad)) * scaledHeight;

    const centerOffsetX = scaledWidth / 2;
    const centerOffsetY = scaledHeight / 2;

    let centerX = touch.clientX - rect.left - dragOffset.x + centerOffsetX;
    let centerY = touch.clientY - rect.top - dragOffset.y + centerOffsetY;

    centerX = Math.max(
      rotatedWidth / 2,
      Math.min(maxDimensions.width - rotatedWidth / 2, centerX)
    );
    centerY = Math.max(
      rotatedHeight / 2,
      Math.min(maxDimensions.height - rotatedHeight / 2, centerY)
    );

    const newX = (centerX - centerOffsetX) / scale; // Convert back to unscaled coordinates
    const newY = (centerY - centerOffsetY) / scale; // Convert back to unscaled coordinates

    // Store position in ref instead of updating state immediately
    dragPositionRef.current = { x: newX, y: newY };

    // Update visual position without triggering re-render
    const tableElement = containerRef.current?.querySelector(
      `[data-table-id="${draggedTable}"]`
    ) as HTMLElement;
    if (tableElement) {
      tableElement.style.left = `${newX * scale}px`;
      tableElement.style.top = `${newY * scale}px`;
    }
  };

  const handleTouchEnd = () => {
    // Update state only when dragging ends
    if (draggedTable && dragPositionRef.current) {
      const finalPosition = dragPositionRef.current;
      setTables((prevTables) =>
        prevTables.map((table) =>
          table.id === draggedTable
            ? { ...table, x: finalPosition.x, y: finalPosition.y }
            : table
        )
      );
    }

    dragPositionRef.current = null;
    setDraggedTable(null);
    clickIntentRef.current = false;
    // Reset drag flag after drag ends
    setTimeout(() => {
      dragJustStartedRef.current = false;
    }, 0);
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

  const updateTableNumber = (tableId: string, newNumber: number) => {
    if (!isManager) return;

    // Clear previous error
    setTableNumberError("");

    // Validate the new number
    if (newNumber < 1) {
      setTableNumberError("O número da mesa deve ser maior que 0");
      return;
    }

    if (!isTableNumberAvailable(newNumber, tableId)) {
      setTableNumberError(`Número ${newNumber} já está em uso`);
      return;
    }

    setTables((prevTables) =>
      prevTables.map((table) => {
        if (table.id === tableId) {
          return {
            ...table,
            tableNumber: newNumber,
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

  const getChairPositions = (
    table: Table,
    scale: number = 1
  ): ChairPosition[] => {
    const chairs: ChairPosition[] = [];
    const { width, height, chairs: chairCount, shape, chairSides } = table;
    const chairDistance = 18 * scale; // Scale chair distance

    if (shape === "circular") {
      const radius = (width * scale) / 2 + chairDistance;
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
              x =
                ((width * scale) / (chairsOnThisSide + 1)) * (i + 1) -
                (width * scale) / 2;
              y = -(height * scale) / 2 - chairDistance;
              rotation = 0;
              break;
            case "right":
              x = (width * scale) / 2 + chairDistance;
              y =
                ((height * scale) / (chairsOnThisSide + 1)) * (i + 1) -
                (height * scale) / 2;
              rotation = 90;
              break;
            case "bottom":
              x =
                (width * scale) / 2 -
                ((width * scale) / (chairsOnThisSide + 1)) * (i + 1);
              y = (height * scale) / 2 + chairDistance;
              rotation = 180;
              break;
            case "left":
              x = -(width * scale) / 2 - chairDistance;
              y =
                (height * scale) / 2 -
                ((height * scale) / (chairsOnThisSide + 1)) * (i + 1);
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

  // Update size inputs when selected table changes
  useEffect(() => {
    if (selectedTableData) {
      setSizeInputs({
        width: (selectedTableData.width / PIXELS_PER_METER).toFixed(1),
        height: (selectedTableData.height / PIXELS_PER_METER).toFixed(1),
      });
    }
  }, [selectedTableData?.id, selectedTableData?.width, selectedTableData?.height]);

  // Handle size input changes and validation
  const handleSizeInputChange = (
    dimension: "width" | "height",
    value: string
  ) => {
    setSizeInputs((prev) => ({ ...prev, [dimension]: value }));
  };

  const handleSizeInputCommit = (
    dimension: "width" | "height",
    value: string
  ) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      updateTableSize(selectedTable!, dimension, numValue);
    } else if (selectedTableData) {
      // Reset to current value if invalid
      setSizeInputs((prev) => ({
        ...prev,
        [dimension]: (selectedTableData[dimension] / PIXELS_PER_METER).toFixed(
          1
        ),
      }));
    }
  };

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

  // Debug: check selectedTableData before render
  console.log('selectedTable:', selectedTable, 'selectedTableData:', selectedTableData);

  return (
    <div className="bg-black flex flex-col p-6 overflow-auto h-full flex-1">
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-neutral-900 rounded-xl shadow-2xl border border-neutral-700 p-8 max-w-md w-full mx-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center">
                <AlertTriangle size={24} className="text-black" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  Alterações não guardadas
                </h3>
                <p className="text-sm text-neutral-400">
                  Tem a certeza que quer sair?
                </p>
              </div>
            </div>
            <p className="text-neutral-300 mb-8 leading-relaxed">
              Tem alterações não guardadas (mesas e/ou tamanho do restaurante)
              que serão perdidas se sair do modo de edição. Quer guardar as
              alterações primeiro ou descartar?
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDiscardChanges}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium transition-all duration-200 rounded-lg"
              >
                Descartar alterações
              </button>
              <button
                onClick={cancelDiscardChanges}
                className="flex-1 px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-white font-medium transition-all duration-200 rounded-lg"
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
          className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-lg border backdrop-blur-sm transform transition-all duration-300 ${
            notification.type === "success"
              ? "bg-neutral-900/95 border-green-500/50 text-green-400"
              : notification.type === "error"
              ? "bg-neutral-900/95 border-red-500/50 text-red-400"
              : "bg-neutral-900/95 border-yellow-500/50 text-yellow-400"
          }`}
          style={{
            animation: "slideInRight 0.3s ease-out",
          }}
        >
          <div className="flex items-center gap-3">
            {notification.type === "success" && (
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
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
              <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="black"
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

      <div className="bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col p-8 shadow-2xl flex-1 h-full overflow-hidden">
        <div className="flex items-center justify-between px-0 py-1">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-neutral-900 rounded-lg flex items-center justify-center border border-neutral-700">
              <Grid size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Layout do Restaurante
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {isManager ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <Shield size={14} />
                    <span className="text-sm font-medium">Gestor</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-neutral-400">
                    <ShieldX size={14} />
                    <span className="text-sm font-medium">
                      Modo Visualização
                    </span>
                  </div>
                )}
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-2 text-yellow-400 ml-4">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium">
                      Alterações não guardadas
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 h-max">
            {editMode && isManager && (
              <div className="relative">
                <button
                  onClick={() => setShowSizeMenu(!showSizeMenu)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium border border-neutral-700 hover:border-neutral-600 transition-all duration-200 flex items-center gap-2 text-sm rounded-lg"
                >
                  <Ruler size={16} />
                  {pendingRestaurantSize}m²
                  {pendingRestaurantSize !== restaurantSize && (
                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                  )}
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${
                      showSizeMenu ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showSizeMenu && (
                  <div className="absolute top-full mt-3 bg-neutral-900 border border-neutral-700 shadow-xl z-20 min-w-[220px] rounded-lg overflow-hidden">
                    <div className="p-5">
                      <h4 className="text-sm font-semibold text-white mb-4">
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
                                ? "bg-neutral-800 text-white"
                                : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
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
                        <div className="border-t border-neutral-700 pt-4 mt-4">
                          <input
                            type="number"
                            placeholder="Tamanho personalizado"
                            className="w-full px-4 py-3 border border-neutral-700 bg-neutral-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-medium rounded-lg transition-all duration-200 placeholder-neutral-400"
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
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 border ${
                  editMode
                    ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                    : "bg-green-600 hover:bg-green-700 text-white border-green-600"
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
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium border border-neutral-700 hover:border-neutral-600 transition-all duration-200 flex items-center gap-2 text-sm rounded-lg"
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
                  <div className="absolute top-full mt-3 bg-neutral-900 border border-neutral-700 shadow-xl z-10 min-w-[240px] rounded-lg overflow-hidden">
                    <div className="p-5">
                      <h4 className="text-sm font-semibold text-white mb-4">
                        Formas de Mesa
                      </h4>
                      {[
                        {
                          shape: "square",
                          label: "Quadrada",
                          desc: "4 cadeiras • 2×2m",
                          icon: Square,
                          gradient: "from-neutral-800 to-neutral-700",
                          iconColor: "text-white",
                        },
                        {
                          shape: "rectangular",
                          label: "Retangular",
                          desc: "6 cadeiras • 3×1.5m",
                          icon: RectangleHorizontal,
                          gradient: "from-neutral-800 to-neutral-700",
                          iconColor: "text-white",
                        },
                        {
                          shape: "circular",
                          label: "Redonda",
                          desc: "6 cadeiras • 2.3×2.3m",
                          icon: Circle,
                          gradient: "from-neutral-800 to-neutral-700",
                          iconColor: "text-white",
                        },
                        {
                          shape: "bar",
                          label: "Mesa de Bar",
                          desc: "8 cadeiras • 5×1m",
                          icon: Minus,
                          gradient: "from-neutral-800 to-neutral-700",
                          iconColor: "text-white",
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
                            className="w-full text-left px-4 py-4 hover:bg-neutral-800 transition-all duration-200 flex items-center gap-4 rounded-lg group"
                          >
                            <div
                              className={`w-10 h-10 bg-gradient-to-br ${option.gradient} flex items-center justify-center rounded-lg border border-neutral-600 group-hover:border-neutral-500 transition-all duration-200`}
                            >
                              <IconComponent
                                size={18}
                                className={option.iconColor}
                              />
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-white block">
                                {option.label}
                              </span>
                              <span className="text-xs text-neutral-400">
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
                className={`px-4 py-2 font-medium transition-all duration-200 flex items-center gap-2 text-sm rounded-lg border ${
                  savingLayout
                    ? "bg-neutral-700 text-neutral-400 cursor-not-allowed border-neutral-600"
                    : hasUnsavedChanges
                    ? "bg-yellow-600 hover:bg-yellow-700 text-black border-yellow-600 animate-pulse"
                    : "bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700"
                }`}
              >
                {savingLayout ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-transparent"></div>
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

        <div className="flex flex-1 overflow-hidden mt-6 min-h-0 relative">
          <div
            ref={scrollContainerRef}
            className={`flex-1 p-4 min-h-0 transition-all duration-300 canvas-scroll ${
              draggedTable ? "overflow-hidden" : "overflow-auto"
            }`}
            style={{
              touchAction: draggedTable ? "none" : "auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: draggedTable ? "none" : "auto",
            }}
          >
            {/* Large scrollable area with canvas centered */}
            <div
              style={{
                width: `${Math.max(
                  maxDimensions.width + 800,
                  windowSize.width
                )}px`,
                height: `${Math.max(
                  maxDimensions.height + 600,
                  windowSize.height
                )}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                touchAction: draggedTable ? "none" : "auto",
              }}
            >
              <div
                ref={containerRef}
                className={`relative border-2 border-neutral-700 bg-neutral-900 shadow-xl ${
                  draggedTable ? "select-none touch-none" : ""
                }`}
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(115, 115, 115, 0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(115, 115, 115, 0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: `${20 * tableScale}px ${20 * tableScale}px`,
                  width: `${maxDimensions.width}px`,
                  height: `${maxDimensions.height}px`,
                  borderRadius: "12px",
                  touchAction: draggedTable ? "none" : "auto",
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onClick={() => {
                  setShowAddMenu(false);
                  setShowSizeMenu(false);
                }}
              >
                {tables.map((table) => (
                  <div
                    key={table.id}
                    data-table-id={table.id}
                    className={`absolute ${
                      editMode && isManager ? "cursor-move" : "cursor-default"
                    } ${
                      selectedTable === table.id
                        ? "ring-2 ring-yellow-400 z-10"
                        : ""
                    } ${
                      draggedTable === table.id
                        ? "scale-105"
                        : "transition-all duration-200"
                    } group ${
                      table.id.startsWith("temp_")
                        ? "ring-2 ring-yellow-400/50"
                        : ""
                    }`}
                    style={{
                      left: `${table.x * tableScale}px`,
                      top: `${table.y * tableScale}px`,
                      width: `${table.width * tableScale}px`,
                      height: `${table.height * tableScale}px`,
                      transform: `rotate(${table.rotation}deg)`,
                      transformOrigin: "center center",
                      touchAction: "none",
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      WebkitTouchCallout: "none",
                    }}
                    onMouseDown={(e) => handleMouseDown(e, table)}
                    onTouchStart={(e) => handleTouchStart(e, table)}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Debug: log click event and drag state
                      console.log(
                        "Table clicked:",
                        table.id,
                        "draggedTable:",
                        draggedTable,
                        "clickIntent:",
                        clickIntentRef.current
                      );
                      if (draggedTable || !clickIntentRef.current) {
                        setSelectedTable(null);
                        return;
                      }
                      // Otherwise, open menu for this table (for all users)
                      setSelectedTable(table.id);
                      console.log("Set selectedTable:", table.id);
                    }}
                  >
                    <div
                      className={`w-full h-full border-2 flex items-center justify-center transition-all duration-200 ${
                        selectedTable === table.id
                          ? "bg-neutral-800 border-yellow-400 shadow-xl"
                          : table.id.startsWith("temp_")
                          ? "bg-neutral-800 border-yellow-400/50 shadow-lg hover:shadow-xl group-hover:bg-neutral-700"
                          : "bg-neutral-800 border-neutral-600 hover:border-neutral-500 shadow-lg hover:shadow-xl group-hover:bg-neutral-700"
                      }`}
                      style={{
                        ...getTableStyle(table),
                      }}
                    >
                      <span
                        className={`font-bold transition-colors duration-200 ${
                          selectedTable === table.id
                            ? "text-yellow-400"
                            : table.id.startsWith("temp_")
                            ? "text-yellow-400"
                            : "text-white group-hover:text-neutral-200"
                        } ${!editMode ? "select-none" : ""}`}
                        style={{
                          fontSize: `${16 * tableScale}px`,
                        }}
                      >
                        {table.tableNumber}
                      </span>
                    </div>

                    {getChairPositions(table, tableScale).map((chairPos, i) => (
                      <div
                        key={i}
                        className={`absolute transition-all duration-200 shadow-sm ${
                          selectedTable === table.id
                            ? "bg-yellow-400 border border-yellow-500 shadow-md"
                            : table.id.startsWith("temp_")
                            ? "bg-yellow-400/70 border border-yellow-500/70 shadow-md"
                            : "bg-neutral-600 border border-neutral-700 group-hover:bg-neutral-500"
                        }`}
                        style={{
                          width: `${12 * tableScale}px`,
                          height: `${12 * tableScale}px`,
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
                    <div className="text-center text-neutral-400">
                      <div className="w-20 h-20 mx-auto mb-6 bg-neutral-800 rounded-xl flex items-center justify-center border border-neutral-700">
                        <Grid size={32} className="opacity-60" />
                      </div>
                      <p className="text-xl font-semibold mb-3 text-neutral-300">
                        Nenhuma mesa no layout
                      </p>
                      <p className="text-sm max-w-md text-neutral-500 leading-relaxed">
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
          </div>

          {selectedTableData && (
            <div className="fixed top-0 right-0 w-80 h-full bg-neutral-900 border-l border-neutral-700 shadow-2xl z-[9999] flex flex-col overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 ${
                        selectedTableData.id.startsWith("temp_")
                          ? "bg-yellow-500"
                          : "bg-neutral-700"
                      } flex items-center justify-center rounded-lg border border-neutral-600`}
                    >
                      <span
                        className={`font-bold text-lg ${
                          selectedTableData.id.startsWith("temp_")
                            ? "text-black"
                            : "text-white"
                        }`}
                      >
                        {selectedTableData.tableNumber}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        Mesa {selectedTableData.tableNumber}
                      </h3>
                      <p className="text-sm text-neutral-400">
                        {selectedTableData.id.startsWith("temp_")
                          ? "Nova mesa (não guardada)"
                          : "Configurar propriedades"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTable(null)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-red-600 border border-neutral-600 hover:border-red-500 transition-all duration-200 group"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-neutral-400 group-hover:text-white transition-colors duration-200"
                    >
                      <path d="m18 6-12 12" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-neutral-800 p-5 rounded-lg border border-neutral-700">
                    <label className="block text-sm font-semibold text-white mb-4">
                      Forma da Mesa
                    </label>
                    <select
                      value={selectedTableData.shape || "square"}
                      onChange={(e) =>
                        updateTableShape(selectedTable!, e.target.value)
                      }
                      className="w-full px-4 py-3 border border-neutral-600 bg-neutral-900 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-medium rounded-lg transition-all duration-200"
                    >
                      <option value="square">Quadrada</option>
                      <option value="rectangular">Retangular</option>
                      <option value="circular">Redonda</option>
                      <option value="bar">Mesa de Bar</option>
                    </select>
                  </div>

                  <div className="bg-neutral-800 p-5 rounded-lg border border-neutral-700">
                    <label className="block text-sm font-semibold text-white mb-4">
                      Posição
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-2 font-medium">
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
                          className="w-full px-3 py-2 border border-neutral-600 bg-neutral-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-medium rounded-lg transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-2 font-medium">
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
                          className="w-full px-3 py-2 border border-neutral-600 bg-neutral-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-medium rounded-lg transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-neutral-800 p-5 rounded-lg border border-neutral-700">
                    <label className="block text-sm font-semibold text-white mb-4">
                      Tamanho
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-2 font-medium">
                          {selectedTableData.shape === "circular"
                            ? "Diâmetro (m)"
                            : "Largura (m)"}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={sizeInputs.width}
                          onChange={(e) =>
                            handleSizeInputChange("width", e.target.value)
                          }
                          onBlur={(e) =>
                            handleSizeInputCommit("width", e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSizeInputCommit("width", sizeInputs.width);
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-full px-3 py-2 border border-neutral-600 bg-neutral-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-medium rounded-lg transition-all duration-200"
                          min="1"
                          max="50"
                        />
                      </div>
                      {selectedTableData.shape !== "circular" && (
                        <div>
                          <label className="block text-xs text-neutral-400 mb-2 font-medium">
                            Altura (m)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={sizeInputs.height}
                            onChange={(e) =>
                              handleSizeInputChange("height", e.target.value)
                            }
                            onBlur={(e) =>
                              handleSizeInputCommit("height", e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSizeInputCommit(
                                  "height",
                                  sizeInputs.height
                                );
                                e.currentTarget.blur();
                              }
                            }}
                            className="w-full px-3 py-2 border border-neutral-600 bg-neutral-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-medium rounded-lg transition-all duration-200"
                            min="1"
                            max="15"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-5">
                      <label className="block text-xs text-neutral-400 mb-3 font-medium">
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
                              // Update local size inputs to reflect the preset values
                              setSizeInputs({
                                width: preset.w.toFixed(1),
                                height: (selectedTableData.shape === "circular"
                                  ? preset.w
                                  : preset.h
                                ).toFixed(1),
                              });
                            }}
                            className="px-3 py-2 text-xs bg-neutral-700 hover:bg-neutral-600 border border-neutral-600 hover:border-neutral-500 transition-all duration-200 font-semibold text-white rounded-lg"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedTableData.shape !== "circular" && (
                    <div className="bg-neutral-800 p-5 rounded-lg border border-neutral-700">
                      <label className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
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
                              className="w-4 h-4 text-yellow-500 focus:ring-yellow-500 bg-neutral-700 border-neutral-600 rounded transition-all duration-200"
                            />
                            <span className="text-sm font-medium text-neutral-300">
                              {side.label}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-neutral-500 mt-3 leading-relaxed">
                        Desmarque os lados onde não quer cadeiras
                      </p>
                    </div>
                  )}

                  <div className="bg-neutral-800 p-5 rounded-lg border border-neutral-700">
                    <label className="block text-sm font-semibold text-white mb-4">
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
                      className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, rgb(234 179 8) 0%, rgb(234 179 8) ${
                          (selectedTableData.chairs /
                            getMaxChairs(
                              selectedTableData.width,
                              selectedTableData.height,
                              selectedTableData.shape
                            )) *
                          100
                        }%, rgb(64 64 64) ${
                          (selectedTableData.chairs /
                            getMaxChairs(
                              selectedTableData.width,
                              selectedTableData.height,
                              selectedTableData.shape
                            )) *
                          100
                        }%, rgb(64 64 64) 100%)`,
                      }}
                    />
                    <div className="flex justify-between text-xs text-neutral-500 mt-3 font-medium">
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

                  <div className="bg-neutral-800 p-5 rounded-lg border border-neutral-700">
                    <label className="block text-sm font-semibold text-white mb-4">
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
                        updateTableNumber(selectedTable!, newNumber);
                      }}
                      className={`w-full px-4 py-3 border focus:outline-none focus:ring-2 focus:border-transparent font-medium text-white bg-neutral-900 rounded-lg transition-all duration-200 ${
                        tableNumberError
                          ? "border-red-500 focus:ring-red-500"
                          : "border-neutral-600 focus:ring-yellow-500"
                      }`}
                      min="1"
                    />
                    {tableNumberError && (
                      <p className="text-red-400 text-xs mt-2 font-medium">
                        {tableNumberError}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                      Cada mesa deve ter um número único
                    </p>
                  </div>

                  <div className="bg-neutral-800 p-5 rounded-lg border border-neutral-700">
                    <label className="block text-sm font-semibold text-white mb-4">
                      Rotação ({selectedTableData.rotation}°)
                    </label>
                    <button
                      onClick={() => rotateTable(selectedTable!)}
                      className="w-full px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 rounded-lg border border-neutral-600"
                    >
                      <RotateCw size={16} />
                      Rodar 90°
                    </button>
                  </div>

                  <div className="bg-neutral-800 p-5 rounded-lg border border-neutral-700">
                    <label className="block text-sm font-semibold text-white mb-4">
                      Ações da Mesa
                    </label>
                    <button
                      onClick={() => duplicateTable(selectedTable!)}
                      className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 rounded-lg border border-blue-600 mb-3"
                    >
                      <Copy size={16} />
                      Duplicar Mesa
                    </button>
                  </div>

                  <button
                    onClick={() => deleteTable(selectedTable!)}
                    className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 rounded-lg border border-red-600"
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
});

export default RestaurantFloorPlan;
