"use client";

import React, { useState, useEffect, memo } from "react";
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

  // Check user permissions
  useEffect(() => {
    setIsManager(user.labels.includes("manager"));
  }, [user]);

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
          chairSides: {
            top: doc.chairTop ?? true,
            right: doc.chairRight ?? true,
            bottom: doc.chairBottom ?? true,
            left: doc.chairLeft ?? true,
          },
        }));
        setTables(tablesData);
      } catch (err) {
        console.error("Error fetching tables:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTables();
  }, []);

  // Same sizing logic as original
  const getMaxDimensions = () => {
    const baseSize = Math.sqrt(restaurantSize) * 60;
    return {
      width: Math.min(800, Math.max(400, baseSize * 1.2)), // Same as original
      height: Math.min(600, Math.max(300, baseSize)), // Same as original
    };
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
        }
      });
    }

    return chairs;
  };

  const maxDimensions = getMaxDimensions();

  if (loading) {
    return (
      <div className="bg-neutral-950 rounded-xl border border-neutral-800 shadow-2xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-400">Carregando layout...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 rounded-xl border border-neutral-800 shadow-2xl m-6">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-neutral-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-900 rounded-lg flex items-center justify-center border border-neutral-700">
            <Grid size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Layout do Restaurante
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {isManager ? (
                <div className="flex items-center gap-2 text-green-400">
                  <Shield size={14} />
                  <span className="text-sm font-medium">Gestor</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-neutral-400">
                  <ShieldX size={14} />
                  <span className="text-sm font-medium">Modo Visualização</span>
                </div>
              )}
              <span className="text-xs text-neutral-500 ml-2">
                {tables.length} {tables.length === 1 ? "mesa" : "mesas"}
              </span>
            </div>
          </div>
        </div>

        {/* Edit Button - Only show for managers */}
        {isManager && (
          <button
            onClick={onEditRedirect}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 border border-green-600"
          >
            <Edit size={16} />
            Editar Layout
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      {/* Restaurant Layout */}
      <div className="p-8">
        <div className="flex justify-center">
          <div
            className="relative border-2 border-neutral-700 bg-neutral-900 shadow-xl"
            style={{
              backgroundImage: `
                linear-gradient(rgba(115, 115, 115, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(115, 115, 115, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: "20px 20px",
              width: `${maxDimensions.width}px`,
              height: `${maxDimensions.height}px`,
              borderRadius: "12px",
            }}
          >
            {tables.map((table) => (
              <div
                key={table.id}
                className="absolute transition-all duration-200 group cursor-default"
                style={{
                  left: `${table.x}px`,
                  top: `${table.y}px`,
                  width: `${table.width}px`,
                  height: `${table.height}px`,
                  transform: `rotate(${table.rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                {/* Table - Made brighter */}
                <div
                  className="w-full h-full border-2 border-neutral-500 bg-neutral-200 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 group-hover:bg-neutral-100 group-hover:border-neutral-400"
                  style={{
                    ...getTableStyle(table),
                  }}
                >
                  <span className="text-lg font-bold text-neutral-800 select-none">
                    {table.tableNumber}
                  </span>
                </div>

                {/* Chairs */}
                {getChairPositions(table).map((chairPos, i) => (
                  <div
                    key={i}
                    className="absolute w-5 h-5 bg-neutral-600 border border-neutral-700 shadow-sm transition-all duration-200 group-hover:bg-neutral-500"
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

            {/* Empty State */}
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
                    {isManager
                      ? "Clique em 'Editar Layout' para adicionar mesas ao layout"
                      : "Este layout está vazio. Contacte um gestor para adicionar mesas."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-6 py-4 bg-neutral-900 border-t border-neutral-800 rounded-b-xl">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Tamanho: {restaurantSize}m²</span>
          <span>Visualização em tempo real</span>
        </div>
      </div>
    </div>
  );
});

export default RestLayout;
