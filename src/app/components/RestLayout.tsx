"use client";

import React, { useState, useEffect, useRef, memo } from "react";
// Direct icon imports for bundle size
import { Grid, Edit, Shield, ShieldX, ExternalLink } from "lucide-react";
import { databases, client } from "@/lib/appwrite";
import { Query } from "appwrite";

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
  status?: string; // Add status field
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

interface RestaurantDashboardLayoutProps {
  user: User;
  onEditRedirect?: () => void;
}

const RestLayout = React.memo(function RestLayout({
  user,
  onEditRedirect = () => console.log("Navigate to edit page"),
}: RestaurantDashboardLayoutProps) {
  // ...existing code...
  const [tables, setTables] = useState<Table[]>([]);
  const [restaurantSize, setRestaurantSize] = useState<number>(100);
  const [isManager, setIsManager] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Handle window resize for responsive layout
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

  // Check user permissions
  useEffect(() => {
    setIsManager(user.labels.includes("manager"));
  }, [user]);

  // Center the canvas on load and when dimensions change
  useEffect(() => {
    const centerCanvas = () => {
      if (scrollContainerRef.current) {
        const scrollContainer = scrollContainerRef.current;
        const dimensions = getMaxDimensions();

        const containerWidth = scrollContainer.clientWidth;
        const containerHeight = scrollContainer.clientHeight;

        // Only center if canvas is larger than container
        if (dimensions.width > containerWidth - 32) { // 32px for padding
          const centerX = Math.max(0, (dimensions.width - containerWidth + 32) / 2);
          scrollContainer.scrollLeft = centerX;
        }

        if (dimensions.height > containerHeight - 32) { // 32px for padding
          const centerY = Math.max(0, (dimensions.height - containerHeight + 32) / 2);
          scrollContainer.scrollTop = centerY;
        }
      }
    };

    // Small delay to ensure component is fully rendered
    const timeoutId = setTimeout(centerCanvas, 100);
    return () => clearTimeout(timeoutId);
  }, [restaurantSize, windowSize.width, windowSize.height]);

  // Realtime subscription for tables
  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${COLLECTION_ID}.documents`,
      (response) => {
        if (
          response.events.includes(
            `databases.${DATABASE_ID}.collections.${COLLECTION_ID}.documents.*.create`
          )
        ) {
          const newTable: any = response.payload;
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
        }

        if (
          response.events.includes(
            `databases.${DATABASE_ID}.collections.${COLLECTION_ID}.documents.*.update`
          )
        ) {
          const updatedTable: any = response.payload;
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
        }

        if (
          response.events.includes(
            `databases.${DATABASE_ID}.collections.${COLLECTION_ID}.documents.*.delete`
          )
        ) {
          const deletedTable: any = response.payload;
          setTables((prevTables) =>
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
  }, []);

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
          const updatedSettings: any = response.payload;
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

  // Fetch restaurant settings
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
        console.error("Error fetching settings:", err);
        // Try to create default settings if document doesn't exist
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
            setRestaurantSize(100);
          }
        } else {
          setRestaurantSize(100);
        }
      }
    };
    fetchSettings();
  }, [isManager]);

  // Fetch tables
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
          status: doc.status || "free", // Include status field
          chairSides: {
            top: doc.chairTop ?? true,
            right: doc.chairRight ?? true,
            bottom: doc.chairBottom ?? true,
            left: doc.chairLeft ?? true,
          },
        }));
        console.log("Fetched tables:", tablesData);
        console.log("Restaurant size:", restaurantSize);
        setTables(tablesData);
      } catch (err) {
        console.error("Error fetching tables:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTables();
  }, []);

  // Responsive sizing logic - based on Mesas.tsx with square proportions
  const getMaxDimensions = () => {
    const baseSize = Math.sqrt(restaurantSize) * 60;
    // Use same scaling as Mesas.tsx
    let scale = 1;
    if (typeof window !== "undefined") {
      if (window.innerWidth < 640) {
        scale = 0.6; // Mobile
      } else if (window.innerWidth < 1024) {
        scale = 0.7; // Tablet
      } else {
        scale = 0.8; // Desktop - same as Mesas.tsx
      }
    }

    // Calculate square canvas based on Mesas.tsx logic but with square proportions
    const baseWidth = Math.max(320, baseSize * 1.2 * scale);
    const baseHeight = Math.max(240, baseSize * scale);

    // Use the larger dimension to make it square (same as Mesas.tsx)
    const canvasSize = Math.max(baseWidth, baseHeight);

    return {
      width: canvasSize,
      height: canvasSize, // Always square
      scale, // Return scale for table scaling
    };
  };

  // Calculate scaling factor for tables based on canvas size
  const getTableScale = () => {
    const dimensions = getMaxDimensions();
    return dimensions.scale || 0.8;
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
        }
      });
    }

    return chairs;
  };

  const maxDimensions = getMaxDimensions();
  const tableScale = getTableScale();

  if (loading) {
    return (
      <div className="bg-white/[0.02] backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl m-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-6"></div>
            <p className="text-white/70 text-lg">Carregando layout...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl mx-1 lg:mx-6 hover:bg-white/[0.03] hover:border-white/20 transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between p-3 lg:p-8 border-b border-white/10 gap-3">
        <div className="flex items-center gap-2 lg:gap-5 min-w-0">
          <div className="w-10 h-10 lg:w-14 lg:h-14 bg-white/[0.05] backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10 shadow-lg flex-shrink-0">
            <Grid size={16} className="lg:hidden text-white" />
            <Grid size={22} className="hidden lg:block text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base lg:text-2xl font-bold text-white tracking-tight truncate">
              Layout do Restaurante
            </h2>
            <div className="flex flex-wrap items-center gap-1 lg:gap-3 mt-1 lg:mt-2">
              {isManager ? (
                <div className="flex items-center gap-1 lg:gap-2 text-green-400 bg-green-500/10 px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg border border-green-500/20">
                  <Shield size={12} className="lg:hidden" />
                  <Shield size={16} className="hidden lg:block" />
                  <span className="text-xs lg:text-sm font-semibold">
                    Gestor
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1 lg:gap-2 text-white/70 bg-white/[0.05] px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg border border-white/10">
                  <ShieldX size={12} className="lg:hidden" />
                  <ShieldX size={16} className="hidden lg:block" />
                  <span className="text-xs lg:text-sm font-medium">
                    Modo Visualização
                  </span>
                </div>
              )}
              <span className="text-xs lg:text-sm text-white/60 bg-white/[0.03] px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg border border-white/10">
                {tables.length} {tables.length === 1 ? "mesa" : "mesas"}
              </span>
            </div>
          </div>
        </div>

        {/* Edit Button - Only show for managers */}
        {isManager && (
          <button
            onClick={onEditRedirect}
            className="px-4 lg:px-6 py-2 lg:py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-xs lg:text-sm font-semibold rounded-xl transition-all duration-300 flex items-center gap-2 lg:gap-3 border border-green-500/20 shadow-lg hover:shadow-xl hover:scale-105 backdrop-blur-sm flex-shrink-0"
          >
            <Edit size={14} className="lg:hidden" />
            <Edit size={18} className="hidden lg:block" />
            <span className="hidden lg:inline">Editar Layout</span>
            <span className="lg:hidden">Editar</span>
            <ExternalLink size={12} className="lg:hidden" />
            <ExternalLink size={14} className="hidden lg:block" />
          </button>
        )}
      </div>

      {/* Restaurant Layout */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-4 min-h-0 transition-all duration-300 flex items-center justify-center"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          className="relative border-2 border-white/20 bg-white/[0.02] backdrop-blur-sm shadow-2xl hover:border-white/30 transition-all duration-300"
          style={{
            backgroundImage: `
              linear-gradient(rgba(115, 115, 115, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(115, 115, 115, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: `${20 * tableScale}px ${20 * tableScale}px`,
            width: `${maxDimensions.width}px`,
            height: `${maxDimensions.height}px`,
            borderRadius: "16px",
          }}
        >
            {tables.map((table) => (
              <div
                key={table.id}
                className="absolute transition-all duration-200 group cursor-default"
                style={{
                  left: `${table.x * tableScale}px`,
                  top: `${table.y * tableScale}px`,
                  width: `${table.width * tableScale}px`,
                  height: `${table.height * tableScale}px`,
                  transform: `rotate(${table.rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                {/* Table - Show status with colors */}
                <div
                  className={`w-full h-full border-2 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 relative backdrop-blur-sm ${
                    table.status === "occupied"
                      ? "border-red-400/60 bg-red-500/10 hover:bg-red-500/15 hover:border-red-400/80"
                      : "border-green-400/60 bg-green-500/10 hover:bg-green-500/15 hover:border-green-400/80"
                  }`}
                  style={{
                    ...getTableStyle(table),
                  }}
                >
                  {/* Status indicator */}
                  <div
                    className={`absolute rounded-full border-2 border-white shadow-lg ${
                      table.status === "occupied"
                        ? "bg-red-400 shadow-red-400/50"
                        : "bg-green-400 shadow-green-400/50"
                    }`}
                    style={{
                      width: `${12 * tableScale}px`,
                      height: `${12 * tableScale}px`,
                      top: `${6 * tableScale}px`,
                      right: `${6 * tableScale}px`,
                    }}
                    title={
                      table.status === "occupied"
                        ? "Mesa Ocupada"
                        : "Mesa Livre"
                    }
                  />

                  <span
                    className={`font-bold select-none ${
                      table.status === "occupied"
                        ? "text-red-300"
                        : "text-green-300"
                    }`}
                    style={{
                      fontSize: `${16 * tableScale}px`,
                    }}
                  >
                    {table.tableNumber}
                  </span>
                </div>

                {/* Chairs */}
                {getChairPositions(table, tableScale).map((chairPos, i) => (
                  <div
                    key={i}
                    className={`absolute border-2 border-white/60 shadow-lg transition-all duration-300 backdrop-blur-sm ${
                      table.status === "occupied"
                        ? "bg-red-400/80 group-hover:bg-red-400/90 shadow-red-400/30"
                        : "bg-green-400/80 group-hover:bg-green-400/90 shadow-green-400/30"
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

            {/* Empty State */}
            {tables.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white/70">
                  <div className="w-24 h-24 mx-auto mb-8 bg-white/[0.05] rounded-2xl flex items-center justify-center border border-white/10 shadow-lg backdrop-blur-sm">
                    <Grid size={40} className="text-white/40" />
                  </div>
                  <p className="text-2xl font-bold mb-4 text-white">
                    Nenhuma mesa no layout
                  </p>
                  <p className="text-sm max-w-md text-white/60 leading-relaxed">
                    {isManager
                      ? "Clique em 'Editar Layout' para adicionar mesas ao layout"
                      : "Este layout está vazio. Contacte um gestor para adicionar mesas."}
                  </p>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-8 py-6 bg-white/[0.02] border-t border-white/10 rounded-b-2xl backdrop-blur-sm">
        <div className="flex items-center justify-between text-sm text-white/70">
          <div className="flex items-center gap-6">
            <span className="font-medium">Tamanho: {restaurantSize}m²</span>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-green-400 rounded-full border-2 border-white/60 shadow-lg shadow-green-400/30"></div>
                <span className="font-medium">Livre</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-red-400 rounded-full border-2 border-white/60 shadow-lg shadow-red-400/30"></div>
                <span className="font-medium">Ocupada</span>
              </div>
            </div>
          </div>
          <span className="text-white/60 font-medium">
            Visualização em tempo real
          </span>
        </div>
      </div>
    </div>
  );
});

export default RestLayout;
