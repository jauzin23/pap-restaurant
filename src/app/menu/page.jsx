"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowLeft, Edit, Trash2, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { DBRESTAURANTE, COL_MENU } from "@/lib/appwrite";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useMediaQuery } from "react-responsive";

const DB_ID = DBRESTAURANTE;
const COLLECTION_ID = COL_MENU;

export default function MenuPage() {
  const [user, setUser] = useState(null);
  const router = useRouter();
  // const { subscribe } = useSubscription();
  const { databases, account, client } = useApp();
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const isMobile = useMediaQuery({ maxWidth: 767 });

  useEffect(() => {
    if (isMobile) router.push("/unsupported");
  }, [isMobile, router]);

  // Form fields
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [ingredienteInput, setIngredienteInput] = useState("");
  const [ingredientes, setIngredientes] = useState([]);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const res = await databases.listDocuments(DB_ID, COLLECTION_ID);
      setMenuItems(res.documents);
    } catch (err) {
      console.error("Error fetching menu:", err);
    }
    setLoading(false);
  }, [databases]);

  const subscribeToMenu = useCallback(() => {
    try {
      const unsubscribe = client.subscribe(
        `databases.${DB_ID}.collections.${COLLECTION_ID}.documents`,
        (response) => {
          if (
            response.events.some(
              (event) =>
                event.includes(
                  "databases.*.collections.*.documents.*.create"
                ) ||
                event.includes(
                  "databases.*.collections.*.documents.*.update"
                ) ||
                event.includes("databases.*.collections.*.documents.*.delete")
            )
          ) {
            // Quick update after small delay
            setTimeout(() => {
              fetchMenu();
            }, 100);
          }
        }
      );

      return unsubscribe;
    } catch (err) {
      console.error("Error setting up menu subscription:", err);
      return null;
    }
  }, [client, fetchMenu]);

  useEffect(() => {
    fetchMenu();

    // Setup real-time subscription for menu updates
    const unsubscribe = subscribeToMenu();

    // Simple polling as backup every 30 seconds
    const interval = setInterval(fetchMenu, 30000);

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, [fetchMenu, subscribeToMenu]);

  useEffect(() => {
    account
      .get()
      .then(setUser)
      .catch(() => router.push("/login"));
  }, [router, account]);

  function openAddModal() {
    setEditingItem(null);
    setNome("");
    setPreco("");
    setIngredientes([]);
    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setNome(item.nome);
    setPreco(item.preco);
    setIngredientes(item.ingredientes || []);
    setModalOpen(true);
  }

  async function handleSave() {
    try {
      const itemData = {
        nome,
        preco: parseFloat(preco),
        ingredientes,
      };

      if (editingItem) {
        // Optimistic update for editing
        setMenuItems((prev) =>
          prev.map((item) =>
            item.$id === editingItem.$id
              ? {
                  ...itemData,
                  $id: editingItem.$id,
                  $createdAt: editingItem.$createdAt,
                }
              : item
          )
        );

        await databases.updateDocument(
          DB_ID,
          COLLECTION_ID,
          editingItem.$id,
          itemData
        );
      } else {
        // Create temporary item for immediate feedback
        const tempItem = {
          ...itemData,
          $id: `temp-${Date.now()}`,
          $createdAt: new Date().toISOString(),
        };

        setMenuItems((prev) => [tempItem, ...prev]);

        const response = await databases.createDocument(
          DB_ID,
          COLLECTION_ID,
          "unique()",
          itemData
        );

        // Replace temp item with real one
        setMenuItems((prev) =>
          prev.map((item) => (item.$id === tempItem.$id ? response : item))
        );
      }

      setModalOpen(false);
    } catch (err) {
      console.error("Error saving:", err);
      // Revert on error
      fetchMenu();
    }
  }

  async function handleDelete(id) {
    if (!confirm("Tens a certeza que queres apagar este item?")) return;
    try {
      // Optimistic update - immediately remove from UI
      setMenuItems((prev) => prev.filter((item) => item.$id !== id));

      await databases.deleteDocument(DB_ID, COLLECTION_ID, id);
    } catch (err) {
      console.error("Error deleting:", err);
      // Revert on error
      fetchMenu();
    }
  }

  function addIngrediente() {
    if (
      ingredienteInput.trim() &&
      !ingredientes.includes(ingredienteInput.trim())
    ) {
      setIngredientes([...ingredientes, ingredienteInput.trim()]);
      setIngredienteInput("");
    }
  }

  function removeIngrediente(ing) {
    setIngredientes(ingredientes.filter((i) => i !== ing));
  }

  if (!user)
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f0f_1px,transparent_1px),linear-gradient(to_bottom,#0f0f0f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Loading spinner */}
          <div className="relative">
            <div className="w-16 h-16 border-4 border-white/10 rounded-full"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-t-purple-500 border-r-pink-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          </div>

          {/* Logo and text */}
          <div className="mt-8 text-center">
            <div className="mb-4 flex justify-center"></div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
              Mesa+
            </h2>
            <p className="text-white/50 text-sm">A carregar o dashboard...</p>
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} logo="/logo-icon.svg" />

      <main className="flex-1 px-4 py-8 bg-black">
        <div className="max-w-6xl mx-auto">
          {/* Back button */}
          <div className="mb-6">
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-4 py-2 text-white hover:text-white bg-neutral-900/60 hover:bg-neutral-800 rounded-xl border border-neutral-700 hover:border-neutral-600"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </Button>
          </div>

          {/* Main content card */}
          <div className="bg-neutral-900/80 backdrop-blur-sm shadow-2xl rounded-xl border border-neutral-700 overflow-hidden">
            {/* Card header */}
            <div className="flex justify-between items-center p-6 border-b border-neutral-700 bg-neutral-900/60">
              <h1 className="text-2xl font-semibold text-white">
                Gestão de Menu
              </h1>
              <Button
                onClick={openAddModal}
                className="bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-600 hover:border-neutral-500 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Adicionar Item
              </Button>
            </div>

            {/* Card content */}
            <div className="p-6 bg-neutral-900/40">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white/30 border-r-2 border-r-white/10"></div>
                  <span className="ml-3 text-white/60">A carregar...</span>
                </div>
              ) : menuItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/70 text-lg">Nenhum item no menu</p>
                  <p className="text-white/50 text-sm mt-2">
                    Clique em &quot;Adicionar Item&quot; para começar
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-white/60">
                          Nome
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-white/60">
                          Preço (€)
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-white/60">
                          Ingredientes
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-white/60">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuItems.map((item) => (
                        <tr
                          key={item.$id}
                          className="border-b border-neutral-700/50 hover:bg-neutral-800/30"
                        >
                          <td className="py-4 px-4 text-white font-medium">
                            {item.nome}
                          </td>
                          <td className="py-4 px-4 text-white">
                            €{item.preco?.toFixed(2)}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1">
                              {item.ingredientes?.map((ing) => (
                                <span
                                  key={ing}
                                  className="px-2 py-1 text-xs rounded-lg bg-neutral-800/60 text-white/80 border border-neutral-700"
                                >
                                  {ing}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-neutral-800/60 hover:bg-neutral-700 hover:text-white border-neutral-600 text-white/80"
                                onClick={() => openEditModal(item)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50"
                                onClick={() => handleDelete(item.$id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold">
              {editingItem ? "Editar Item" : "Adicionar Item"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="bg-neutral-800/60 border-neutral-600 text-white placeholder-white/50 focus:border-neutral-500 focus:ring-neutral-500"
            />
            <Input
              placeholder="Preço"
              type="number"
              step="0.01"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="bg-neutral-800/60 border-neutral-600 text-white placeholder-white/50 focus:border-neutral-500 focus:ring-neutral-500"
            />

            {/* Ingredientes */}
            <div>
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar ingrediente"
                  value={ingredienteInput}
                  onChange={(e) => setIngredienteInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addIngrediente()}
                  className="bg-neutral-800/60 border-neutral-600 text-white placeholder-white/50 focus:border-neutral-500 focus:ring-neutral-500"
                />
                <Button
                  type="button"
                  onClick={addIngrediente}
                  className="bg-neutral-700 hover:bg-neutral-600 text-white px-3 border border-neutral-600"
                >
                  +
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {ingredientes.map((ing) => (
                  <span
                    key={ing}
                    className="px-2 py-1 text-xs rounded-lg bg-neutral-800/60 text-white/80 border border-neutral-700 flex items-center gap-1"
                  >
                    {ing}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-red-400"
                      onClick={() => removeIngrediente(ing)}
                    />
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="ghost"
                onClick={() => setModalOpen(false)}
                className="text-white/70 hover:text-white hover:bg-neutral-800"
              >
                Cancelar
              </Button>
              <Button
                className="bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-600"
                onClick={handleSave}
              >
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
