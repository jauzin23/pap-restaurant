"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
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

// Memoized Table Component for better performance - Simplified for tablets
const TableComponent = React.memo(
  ({
    table,
    tableScale,
    chairPositions,
    tableStyle,
  }: {
    table: Table;
    tableScale: number;
    chairPositions: ChairPosition[];
    tableStyle: { borderRadius: string };
  }) => {
    // Pre-calculate transform to avoid recalculation
    const tableTransform = useMemo(
      () =>
        `translate3d(${table.x * tableScale}px, ${
          table.y * tableScale
        }px, 0) rotate(${table.rotation}deg)`,
      [table.x, table.y, table.rotation, tableScale]
    );

    // Optimized chair rendering - support all chairs but batch DOM updates
    const chairStyles = useMemo(() => {
      // Only render chairs if scale is large enough to see them
      if (tableScale < 0.3) return "";

      return chairPositions
        .map((chairPos, i) => {
          const chairTransform = `translate3d(-50%, -50%, 0) translate3d(${
            chairPos.x
          }px, ${chairPos.y}px, 0) rotate(${
            -table.rotation + (chairPos.rotation || 0)
          }deg)`;

          return `
          .table-${table.id} .chair-${i} {
            position: absolute;
            width: ${Math.max(8, 12 * tableScale)}px;
            height: ${Math.max(8, 12 * tableScale)}px;
            left: 50%;
            top: 50%;
            transform: ${chairTransform};
            border: 2px solid rgba(255, 255, 255, 0.6);
            border-radius: 3px;
            background-color: ${
              table.status === "occupied"
                ? "rgba(248, 113, 113, 0.8)"
                : "rgba(74, 222, 128, 0.8)"
            };
            transition: background-color 0.3s ease;
            will-change: transform;
          }
        `;
        })
        .join("");
    }, [chairPositions, tableScale, table.id, table.rotation, table.status]);

    return (
      <>
        {chairStyles && (
          <style dangerouslySetInnerHTML={{ __html: chairStyles }} />
        )}
        <div
          className={`table-${table.id} absolute transition-opacity duration-200 group cursor-default`}
          style={{
            left: 0,
            top: 0,
            width: `${table.width * tableScale}px`,
            height: `${table.height * tableScale}px`,
            transform: tableTransform,
            transformOrigin: "center center",
            willChange: "transform, opacity",
          }}
        >
          {/* Table - Show status with colors */}
          <div
            className={`w-full h-full border-2 flex items-center justify-center shadow-lg transition-colors duration-300 relative ${
              table.status === "occupied"
                ? "border-red-400/60 bg-red-500/10"
                : "border-green-400/60 bg-green-500/10"
            }`}
            style={tableStyle}
          >
            {/* Status indicator - only show if table is large enough */}
            {tableScale > 0.3 && (
              <div
                className={`absolute rounded-full border-2 border-white shadow-lg ${
                  table.status === "occupied"
                    ? "bg-red-400 shadow-red-400/50"
                    : "bg-green-400 shadow-green-400/50"
                }`}
                style={{
                  width: `${Math.max(8, 12 * tableScale)}px`,
                  height: `${Math.max(8, 12 * tableScale)}px`,
                  top: `${Math.max(4, 6 * tableScale)}px`,
                  right: `${Math.max(4, 6 * tableScale)}px`,
                }}
              />
            )}

            <span
              className={`font-bold select-none ${
                table.status === "occupied" ? "text-red-300" : "text-green-300"
              }`}
              style={{
                fontSize: `${Math.max(10, 16 * tableScale)}px`,
              }}
            >
              {table.tableNumber}
            </span>
          </div>

          {/* Chairs as div elements - render all chairs */}
          {tableScale >= 0.3 &&
            chairPositions.map((chairPos, i) => (
              <div key={i} className={`chair-${i}`} />
            ))}
        </div>
      </>
    );
  }
);

TableComponent.displayName = "TableComponent";

const RestLayout = React.memo(function RestLayout({
  user,
  onEditRedirect = () => console.log("Navigate to edit page"),
}: RestaurantDashboardLayoutProps) {
  // State management
  const [tables, setTables] = useState<Table[]>([]);
  const [restaurantSize, setRestaurantSize] = useState<number>(100);
  const [isManager, setIsManager] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Memoized calculations to prevent re-computation on every render
  const maxDimensions = useMemo(() => {
    const baseSize = Math.sqrt(restaurantSize) * 60;
    let scale = 1;
    if (typeof window !== "undefined") {
      if (windowSize.width < 640) {
        scale = 0.6; // Mobile
      } else if (windowSize.width < 1024) {
        scale = 0.7; // Tablet
      } else {
        scale = 0.8; // Desktop
      }
    }

    const baseWidth = Math.max(320, baseSize * 1.2 * scale);
    const baseHeight = Math.max(240, baseSize * scale);
    const canvasSize = Math.max(baseWidth, baseHeight);

    return {
      width: canvasSize,
      height: canvasSize,
      scale,
    };
  }, [restaurantSize, windowSize.width]);

  // Memoized table scale
  const tableScale = useMemo(
    () => maxDimensions.scale || 0.8,
    [maxDimensions.scale]
  );

  // Optimized chair position calculation function
  const calculateChairPositions = useCallback(
    (table: Table, scale: number = 1): ChairPosition[] => {
      const chairs: ChairPosition[] = [];
      const { width, height, chairs: chairCount, shape, chairSides } = table;
      const chairDistance = 18 * scale;

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
    },
    []
  );

  // Memoized chair positions to avoid recalculating on every render
  const chairPositionsCache = useMemo(() => {
    const cache = new Map<string, ChairPosition[]>();

    tables.forEach((table) => {
      const cacheKey = `${table.id}-${table.width}-${table.height}-${
        table.chairs
      }-${table.shape}-${JSON.stringify(table.chairSides)}-${tableScale}`;

      if (!cache.has(cacheKey)) {
        const positions = calculateChairPositions(table, tableScale);
        cache.set(cacheKey, positions);
      }
    });

    return cache;
  }, [tables, tableScale, calculateChairPositions]);

  // Throttled window resize handler
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 150); // Throttle resize events
    };

    if (typeof window !== "undefined") {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      window.addEventListener("resize", handleResize, { passive: true });
      return () => {
        window.removeEventListener("resize", handleResize);
        clearTimeout(timeoutId);
      };
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

        const containerWidth = scrollContainer.clientWidth;
        const containerHeight = scrollContainer.clientHeight;

        // Only center if canvas is larger than container
        if (maxDimensions.width > containerWidth - 32) {
          // 32px for padding
          const centerX = Math.max(
            0,
            (maxDimensions.width - containerWidth + 32) / 2
          );
          scrollContainer.scrollLeft = centerX;
        }

        if (maxDimensions.height > containerHeight - 32) {
          // 32px for padding
          const centerY = Math.max(
            0,
            (maxDimensions.height - containerHeight + 32) / 2
          );
          scrollContainer.scrollTop = centerY;
        }
      }
    };

    // Small delay to ensure component is fully rendered
    const timeoutId = setTimeout(centerCanvas, 100);
    return () => clearTimeout(timeoutId);
  }, [
    maxDimensions.width,
    maxDimensions.height,
    windowSize.width,
    windowSize.height,
  ]);

  // Realtime subscription for tables - simplified and more reliable
  useEffect(() => {
    if (!client) return;

    let updateTimeoutId: NodeJS.Timeout;

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
            status: appwriteDoc.status || "free",
            chairSides: {
              top: appwriteDoc.chairTop ?? true,
              right: appwriteDoc.chairRight ?? true,
              bottom: appwriteDoc.chairBottom ?? true,
              left: appwriteDoc.chairLeft ?? true,
            },
          };
        });
        setTables(tablesData);
      } catch (err) {
        console.error("Error fetching tables:", err);
      }
    };

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${COLLECTION_ID}.documents`,
      (response) => {
        // Simple approach: just refetch all tables on any change
        clearTimeout(updateTimeoutId);
        updateTimeoutId = setTimeout(() => {
          fetchTables();
        }, 100);
      }
    );

    return () => {
      clearTimeout(updateTimeoutId);
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // Realtime subscription for settings with throttling
  useEffect(() => {
    if (!client) return;

    let settingsUpdateTimeoutId: NodeJS.Timeout;

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${SETTINGS_COLLECTION_ID}.documents`,
      (response) => {
        if (
          response.events.includes(
            `databases.${DATABASE_ID}.collections.${SETTINGS_COLLECTION_ID}.documents.*.update`
          )
        ) {
          clearTimeout(settingsUpdateTimeoutId);
          settingsUpdateTimeoutId = setTimeout(() => {
            const updatedSettings = response.payload as {
              $id: string;
              size: number;
            };
            if (updatedSettings.$id === SETTINGS_DOCUMENT_ID) {
              setRestaurantSize(updatedSettings.size);
            }
          }, 200); // Less frequent updates for settings
        }
      }
    );

    return () => {
      clearTimeout(settingsUpdateTimeoutId);
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
      } catch (err) {
        console.error("Error fetching tables:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTables();
  }, []);

  // Memoized table style function
  const getTableStyle = useCallback((table: Table) => {
    return {
      borderRadius: table.shape === "circular" ? "50%" : "2px",
    };
  }, []);

  // Viewport-based rendering for performance
  const visibleTables = useMemo(() => {
    if (typeof window === "undefined" || !scrollContainerRef.current) {
      return tables; // Server-side or no container, render all
    }

    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const buffer = 200; // Render tables 200px outside viewport

    return tables.filter((table) => {
      const tableX = table.x * tableScale;
      const tableY = table.y * tableScale;
      const tableWidth = table.width * tableScale;
      const tableHeight = table.height * tableScale;

      // Check if table is within expanded viewport
      return (
        tableX + tableWidth + buffer >= 0 &&
        tableX - buffer <= containerRect.width &&
        tableY + tableHeight + buffer >= 0 &&
        tableY - buffer <= containerRect.height
      );
    });
  }, [tables, tableScale, windowSize]);

  // Optimized chair positions getter with caching
  const getChairPositions = useCallback(
    (table: Table): ChairPosition[] => {
      const cacheKey = `${table.id}-${table.width}-${table.height}-${
        table.chairs
      }-${table.shape}-${JSON.stringify(table.chairSides)}-${tableScale}`;

      if (chairPositionsCache.has(cacheKey)) {
        return chairPositionsCache.get(cacheKey)!;
      }

      return calculateChairPositions(table, tableScale);
    },
    [chairPositionsCache, tableScale, calculateChairPositions]
  );

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
    <div className=" rounded-lg bg-black/80 backdrop-blur-lg border border-white/10">
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
        className="flex-1 overflow-auto p-4 min-h-0 transition-opacity duration-300 flex items-center justify-center"
        style={{
          WebkitOverflowScrolling: "touch",
          transform: "translateZ(0)", // Force hardware acceleration
          contain: "layout style paint", // Optimize repaints
        }}
      >
        <div
          className="relative border-2 border-white/20 bg-white/[0.02] shadow-2xl transition-opacity duration-300"
          style={{
            backgroundImage:
              tableScale > 0.7
                ? `
              linear-gradient(rgba(115, 115, 115, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(115, 115, 115, 0.1) 1px, transparent 1px)
            `
                : "none", // Remove grid background on small scale for performance
            backgroundSize: `${20 * tableScale}px ${20 * tableScale}px`,
            width: `${maxDimensions.width}px`,
            height: `${maxDimensions.height}px`,
            borderRadius: "16px",
            contain: "strict", // Strict containment for maximum performance
            willChange: "transform", // Optimize for transforms
            transform: "translateZ(0)", // Force layer
          }}
        >
          {visibleTables.map((table) => (
            <TableComponent
              key={table.id}
              table={table}
              tableScale={tableScale}
              chairPositions={getChairPositions(table)}
              tableStyle={getTableStyle(table)}
            />
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
