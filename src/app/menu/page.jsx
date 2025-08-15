"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, ArrowLeft, Edit, Trash2, X } from "lucide-react";
import {
  client,
  account,
  databases,
  DBRESTAURANTE,
  COL_MENU,
} from "@/lib/appwrite";
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
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const isMobile = useMediaQuery({ maxWidth: 767 });

  useEffect(() => {
    if (isMobile) router.push("/unsupported");
  }, [router]);

  // Form fields
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [ingredienteInput, setIngredienteInput] = useState("");
  const [ingredientes, setIngredientes] = useState([]);

  useEffect(() => {
    fetchMenu();

    // Setup realtime subscription with proper event patterns
    const unsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.${COLLECTION_ID}.documents`,
      (response) => {
        const { events, payload } = response;

        // Check for create events
        if (events.some((event) => event.includes("create"))) {
          setMenuItems((prev) => {
            // Check if item already exists to prevent duplicates
            if (prev.find((item) => item.$id === payload.$id)) {
              return prev;
            }
            return [...prev, payload];
          });
        }
        // Check for update events
        else if (events.some((event) => event.includes("update"))) {
          setMenuItems((prev) =>
            prev.map((item) => (item.$id === payload.$id ? payload : item))
          );
        }
        // Check for delete events
        else if (events.some((event) => event.includes("delete"))) {
          setMenuItems((prev) =>
            prev.filter((item) => item.$id !== payload.$id)
          );
        }
      }
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    account
      .get()
      .then(setUser)
      .catch(() => router.push("/login"));
  }, [router]);

  async function fetchMenu() {
    setLoading(true);
    try {
      const res = await databases.listDocuments(DB_ID, COLLECTION_ID);
      setMenuItems(res.documents);
    } catch (err) {
      console.error("Error fetching menu:", err);
    }
    setLoading(false);
  }

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
      if (editingItem) {
        await databases.updateDocument(DB_ID, COLLECTION_ID, editingItem.$id, {
          nome,
          preco: parseFloat(preco),
          ingredientes,
        });
      } else {
        await databases.createDocument(DB_ID, COLLECTION_ID, "unique()", {
          nome,
          preco: parseFloat(preco),
          ingredientes,
        });
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Error saving:", err);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Tens a certeza que queres apagar este item?")) return;
    try {
      await databases.deleteDocument(DB_ID, COLLECTION_ID, id);
    } catch (err) {
      console.error("Error deleting:", err);
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
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-b-4 mb-4"></div>
        <p className="text-gray-700 text-lg">A Carregar...</p>
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} logo="/logo.png" />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Back button */}
          <div className="mb-6">
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-4 py-2 text-neutral-200 hover:text-blue-400 hover:bg-neutral-900 rounded-lg border border-neutral-800 hover:border-blue-500 transition-all duration-200 cursor-pointer"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </Button>
          </div>

          {/* Main content card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-neutral-900 shadow-xl rounded-xl border border-neutral-800 overflow-hidden"
          >
            {/* Card header */}
            <div className="flex justify-between items-center p-6 border-b border-neutral-800">
              <h1 className="text-2xl font-semibold text-neutral-100">
                Gestão de Menu
              </h1>
              <Button
                onClick={openAddModal}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 shadow-sm cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                Adicionar Item
              </Button>
            </div>

            {/* Card content */}
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
                  <span className="ml-3 text-neutral-400">A carregar...</span>
                </div>
              ) : menuItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-neutral-400 text-lg">
                    Nenhum item no menu
                  </p>
                  <p className="text-neutral-500 text-sm mt-2">
                    Clique em "Adicionar Item" para começar
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-800">
                        <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">
                          Nome
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">
                          Preço (€)
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">
                          Ingredientes
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-neutral-400">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuItems.map((item) => (
                        <tr
                          key={item.$id}
                          className="border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors"
                        >
                          <td className="py-4 px-4 text-neutral-100 font-medium">
                            {item.nome}
                          </td>
                          <td className="py-4 px-4 text-neutral-100">
                            €{item.preco?.toFixed(2)}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1">
                              {item.ingredientes?.map((ing) => (
                                <span
                                  key={ing}
                                  className="px-2 py-1 text-xs rounded-full bg-emerald-900/30 text-emerald-300 border border-emerald-700/50 cursor-default"
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
                                className="bg-slate-700 hover:bg-blue-600 hover:text-white border-slate-600 text-slate-200 transition-all duration-200 cursor-pointer"
                                onClick={() => openEditModal(item)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="hover:bg-red-600 transition-all duration-200 cursor-pointer"
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
          </motion.div>
        </div>
      </main>

      <Footer />

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Item" : "Adicionar Item"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="focus:border-blue-500 focus:ring-blue-500"
            />
            <Input
              placeholder="Preço"
              type="number"
              step="0.01"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="focus:border-blue-500 focus:ring-blue-500"
            />

            {/* Ingredientes */}
            <div>
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar ingrediente"
                  value={ingredienteInput}
                  onChange={(e) => setIngredienteInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addIngrediente()}
                  className="focus:border-blue-500 focus:ring-blue-500"
                />
                <Button
                  type="button"
                  onClick={addIngrediente}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 cursor-pointer"
                >
                  +
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {ingredientes.map((ing) => (
                  <span
                    key={ing}
                    className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1"
                  >
                    {ing}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-emerald-900"
                      onClick={() => removeIngrediente(ing)}
                    />
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setModalOpen(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
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
