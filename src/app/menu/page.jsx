"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowLeft, Edit, Trash2, X, RefreshCw } from "lucide-react";
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
  const [refreshing, setRefreshing] = useState(false);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchMenu(), fetchCollections()]);
    } catch (err) {
      console.error("Error refreshing data:", err);
    }
    setRefreshing(false);
  };

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
    fetchCollections();

    // Setup real-time subscription for menu updates
    const unsubscribe = subscribeToMenu();

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
    setModalOpen(true);
  }

  async function handleSave() {
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
      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
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
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Grid background (consistent with other pages) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f0f_1px,transparent_1px),linear-gradient(to_bottom,#0f0f0f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none z-0" />

      <div className="relative z-10 min-h-screen flex flex-col">
        <Header user={user} logo="/logo-icon.svg" />

        <main className="flex-1 px-4 py-8">
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
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-600 hover:border-neutral-500 shadow-lg disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
                    />
                    Atualizar
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
                          <th className="text-left py-3 px-4 text-sm font-medium text-white/60 w-1/4">
                            Nome
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-white/60 w-20">
                            Preço (€)
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-white/60 w-32">
                            Categoria
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-white/60">
                            Tags
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-white/60">
                            Ingredientes
                          </th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-white/60 w-24">
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
                            <td className="py-4 px-4 w-1/4">
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
                            <td className="py-4 px-4 text-white w-20">
                              €{item.preco?.toFixed(2)}
                            </td>
                            <td className="py-4 px-4 w-32">
                              {item.category && (
                                <span className="px-2 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 inline-block">
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
                            <td className="py-4 px-4 w-24">
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

        {/* Professional SaaS Modal - Dark Theme */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            {/* Modal Container */}
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700 bg-neutral-800/50">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {editingItem
                      ? "Editar item do menu"
                      : "Adicionar item ao menu"}
                  </h2>
                  <p className="text-sm text-neutral-400 mt-1">
                    {editingItem
                      ? "Atualize os detalhes abaixo"
                      : "Preencha as informações abaixo"}
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="p-6 space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-neutral-200 mb-2">
                        Nome do item *
                      </label>
                      <Input
                        placeholder="Introduza o nome do item"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="w-full h-10 px-3 bg-neutral-800 border border-neutral-600 rounded-md text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-200 mb-2">
                        Preço (€) *
                      </label>
                      <Input
                        placeholder="0,00"
                        type="number"
                        step="0.01"
                        value={preco}
                        onChange={(e) => setPreco(e.target.value)}
                        className="w-full h-10 px-3 bg-neutral-800 border border-neutral-600 rounded-md text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-200 mb-2">
                        Categoria
                      </label>
                      <Select
                        value={selectedCategory}
                        onValueChange={setSelectedCategory}
                      >
                        <SelectTrigger className="w-full h-10 px-3 bg-neutral-800 border border-neutral-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white [&>span]:text-white">
                          <SelectValue
                            placeholder="Selecionar categoria"
                            className="text-white placeholder:text-neutral-400"
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-800 border border-neutral-600 shadow-lg rounded-md">
                          <SelectItem
                            value="none"
                            className="text-white hover:bg-neutral-700 hover:text-white focus:bg-neutral-700 focus:text-white"
                          >
                            Sem categoria
                          </SelectItem>
                          {availableCategories.map((category) => (
                            <SelectItem
                              key={category.$id}
                              value={category.name}
                              className="text-white hover:bg-neutral-700 hover:text-white focus:bg-neutral-700 focus:text-white"
                            >
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-neutral-200 mb-2">
                        Descrição
                      </label>
                      <Textarea
                        placeholder="Introduza a descrição do item (opcional)"
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-md text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-neutral-200">
                      Tags
                    </label>

                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {availableTags.map((tag) => {
                          const isSelected = selectedTags.includes(tag.name);
                          return (
                            <button
                              key={tag.$id}
                              type="button"
                              onClick={() => toggleTag(tag.name)}
                              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                isSelected
                                  ? "bg-blue-900/50 border-blue-600 text-blue-300"
                                  : "bg-neutral-800 border-neutral-600 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-700"
                              }`}
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>

                      {selectedTags.length > 0 && (
                        <div className="pt-2 border-t border-neutral-700">
                          <div className="text-xs text-neutral-400 mb-2">
                            Selecionadas ({selectedTags.length})
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedTags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2.5 py-1 text-sm bg-blue-900/30 text-blue-200 rounded-md border border-blue-700"
                              >
                                {tag}
                                <button
                                  onClick={() => removeTag(tag)}
                                  className="ml-1.5 p-0.5 text-blue-300 hover:text-blue-100 rounded"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-neutral-200">
                      Ingredientes
                    </label>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Adicionar ingrediente"
                        value={ingredienteInput}
                        onChange={(e) => setIngredienteInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addIngrediente()}
                        className="flex-1 h-10 px-3 bg-neutral-800 border border-neutral-600 rounded-md text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={addIngrediente}
                        className="h-10 px-4 bg-white hover:bg-neutral-100 text-black rounded-md font-medium transition-colors"
                      >
                        Adicionar
                      </button>
                    </div>

                    {ingredientes.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs text-neutral-400">
                          Adicionados ({ingredientes.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ingredientes.map((ing) => (
                            <span
                              key={ing}
                              className="inline-flex items-center px-2.5 py-1 text-sm bg-neutral-800 text-neutral-200 rounded-md border border-neutral-600"
                            >
                              {ing}
                              <button
                                onClick={() => removeIngrediente(ing)}
                                className="ml-1.5 p-0.5 text-neutral-400 hover:text-neutral-200 rounded"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-700 bg-neutral-800/50">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-300 bg-neutral-800 border border-neutral-600 rounded-md hover:bg-neutral-700 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={loadingCollections || !nome.trim() || !preco}
                  className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:bg-neutral-700 disabled:text-neutral-400 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor:
                      loadingCollections || !nome.trim() || !preco
                        ? "#404040"
                        : "#2563eb",
                  }}
                >
                  {loadingCollections
                    ? "A guardar..."
                    : editingItem
                    ? "Atualizar item"
                    : "Criar item"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
