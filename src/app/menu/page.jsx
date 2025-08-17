"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowLeft, Edit, Trash2, X, RotateCcw } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import {
  DBRESTAURANTE,
  COL_MENU,
  COL_TAGS,
  COL_CATEGORY,
} from "@/lib/appwrite";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  // Collections data
  const [availableTags, setAvailableTags] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  // Form fields
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [descricao, setDescricao] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [ingredienteInput, setIngredienteInput] = useState("");
  const [ingredientes, setIngredientes] = useState([]);

  // Error state for form
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (isMobile) router.push("/unsupported");
  }, [isMobile, router]);

  // Fetch tags and categories
  const fetchCollections = useCallback(async () => {
    setLoadingCollections(true);
    try {
      const [tagsRes, categoriesRes] = await Promise.all([
        databases.listDocuments(DB_ID, COL_TAGS),
        databases.listDocuments(DB_ID, COL_CATEGORY),
      ]);
      setAvailableTags(tagsRes.documents);
      setAvailableCategories(categoriesRes.documents);
    } catch (err) {
      console.error("Error fetching collections:", err);
    }
    setLoadingCollections(false);
  }, [databases]);

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
            fetchMenu();
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
    fetchCollections();

    // Setup real-time subscription for menu updates
    const unsubscribe = subscribeToMenu();

    // Remove polling
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchMenu, subscribeToMenu, fetchCollections]);

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
    setDescricao("");
    setSelectedCategory("none");
    setSelectedTags([]);
    setIngredientes([]);
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setNome(item.nome);
    setPreco(item.preco);
    setDescricao(item.descricao || "");
    setSelectedCategory(item.category || "none");
    setSelectedTags(item.tags || []);
    setIngredientes(item.ingredientes || []);
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave() {
    // Validate form
    if (!nome.trim()) {
      setFormError("O nome é obrigatório.");
      return;
    }
    if (!preco || isNaN(Number(preco)) || Number(preco) < 0) {
      setFormError("Preço inválido.");
      return;
    }
    if (!selectedCategory || selectedCategory === "none") {
      setFormError("Seleciona uma categoria.");
      return;
    }
    setFormError("");
    try {
      const itemData = {
        nome,
        preco: parseFloat(preco),
        description: descricao.trim() || null,
        category: selectedCategory === "none" ? null : selectedCategory,
        tags: selectedTags.length > 0 ? selectedTags : null,
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
      setFormError("Erro ao guardar. Tenta novamente.");
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

  function toggleTag(tagName) {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((tag) => tag !== tagName)
        : [...prev, tagName]
    );
  }

  function removeTag(tagName) {
    setSelectedTags((prev) => prev.filter((tag) => tag !== tagName));
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
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Grid background (consistent with stock page) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f0f_1px,transparent_1px),linear-gradient(to_bottom,#0f0f0f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none z-0" />
      <Header user={user} logo="/logo-icon.svg" />

      <main className="flex-1 px-4 py-8 relative z-10">
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
              <div className="flex gap-2">
                <Button
                  onClick={fetchMenu}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-2 px-2 py-2 rounded-xl border border-neutral-600 hover:border-neutral-500 shadow-lg"
                  title="Atualizar menu"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
                <Button
                  onClick={openAddModal}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-600 hover:border-neutral-500 shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar Item
                </Button>
              </div>
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
                        <th className="text-left py-3 px-4 text-sm font-medium text-white/60 min-w-[180px] w-[1%]">
                          Categoria
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-white/60">
                          Tags
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
                          <td className="py-4 px-4">
                            <div>
                              <div className="text-white font-medium">
                                {item.nome}
                              </div>
                              {item.descricao && (
                                <div className="text-sm text-white/60 mt-1">
                                  {item.descricao}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-white">
                            €{item.preco?.toFixed(2)}
                          </td>
                          <td className="py-4 px-4 min-w-[180px] w-[1%]">
                            {item.category && (
                              <span className="px-2 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                {item.category}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1">
                              {item.tags?.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 text-xs rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
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
            {formError && (
              <div className="bg-red-900/80 border border-red-700 text-red-200 px-4 py-2 rounded-lg text-sm font-medium">
                {formError}
              </div>
            )}
            <Input
              placeholder="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="bg-black/80 border border-neutral-800 text-white placeholder-white/40 focus:border-neutral-600 focus:ring-2 focus:ring-neutral-800/60 transition-all shadow-md rounded-lg"
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Preço"
                type="number"
                step="0.01"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                className="bg-black/80 border border-neutral-800 text-white placeholder-white/40 focus:border-neutral-600 focus:ring-2 focus:ring-neutral-800/60 transition-all shadow-md rounded-lg"
              />

              {/* Category Select */}
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="bg-black/80 border border-neutral-800 text-white focus:border-neutral-600 focus:ring-2 focus:ring-neutral-800/60 transition-all shadow-md rounded-lg">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent className="bg-black border border-neutral-800 text-white">
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category.$id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <Textarea
              placeholder="Descrição (opcional)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="bg-black/80 border border-neutral-800 text-white placeholder-white/40 focus:border-neutral-600 focus:ring-2 focus:ring-neutral-800/60 min-h-[80px] transition-all shadow-md rounded-lg"
            />

            {/* Tags */}
            <div>
              <label className="text-sm font-medium text-white/70 mb-2 block">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag.$id}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                      selectedTags.includes(tag.name)
                        ? "bg-purple-500/30 text-purple-200 border-purple-500/50"
                        : "bg-neutral-800/60 text-white/70 border-neutral-600 hover:border-purple-500/50"
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-white/60">Selecionadas:</span>
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1"
                    >
                      {tag}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-400"
                        onClick={() => removeTag(tag)}
                      />
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Ingredientes */}
            <div>
              <label className="text-sm font-medium text-white/70 mb-2 block">
                Ingredientes
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar ingrediente"
                  value={ingredienteInput}
                  onChange={(e) => setIngredienteInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addIngrediente()}
                  className="bg-black/80 border border-neutral-800 text-white placeholder-white/40 focus:border-neutral-600 focus:ring-2 focus:ring-neutral-800/60 transition-all shadow-md rounded-lg"
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
                disabled={loadingCollections}
              >
                {loadingCollections ? "A carregar..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
