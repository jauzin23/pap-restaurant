"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Plus,
  Edit,
  Trash2,
  X,
  RefreshCw,
  Upload,
  Crop,
  RotateCcw,
} from "lucide-react";
import ImageCropper from "./ImageCropper";
import { useApp } from "@/contexts/AppContext";
import {
  DBRESTAURANTE,
  COL_MENU,
  COL_TAGS,
  COL_CATEGORY,
  databases,
  storage,
  BUCKET_MENU_IMG,
} from "@/lib/appwrite";
import { ID } from "appwrite";

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

const DB_ID = DBRESTAURANTE;
const COLLECTION_ID = COL_MENU;

export default function MenuComponent() {
  const { databases, client } = useApp();
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

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

  // Image handling
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [croppedImage, setCroppedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currentImageId, setCurrentImageId] = useState(null);

  const fileInputRef = useRef(null);

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

  // Function to get image URL for menu item
  const getImageUrl = useCallback((imageId) => {
    if (!imageId || imageId === "undefined" || imageId === "null") return null;
    try {
      // Use the storage.getFilePreview method with positional parameters
      const imageUrl = storage.getFilePreview(
        BUCKET_MENU_IMG,
        imageId,
        300, // width
        300, // height
        "center", // gravity
        90 // quality
      );
      return imageUrl;
    } catch (error) {
      console.error("Error getting image URL for", imageId, ":", error);
      return null;
    }
  }, []);

  // Memoize image URLs for all menu items to prevent excessive re-computation
  const imageUrls = useMemo(() => {
    const urls = {};
    menuItems.forEach((item) => {
      if (item.image_id) {
        urls[item.$id] = getImageUrl(item.image_id);
      }
    });
    return urls;
  }, [menuItems, getImageUrl]);

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

  // Image handling functions
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle crop completion
  const handleCropApply = useCallback((croppedFile) => {
    setCroppedImage(croppedFile);
    setShowCropper(false);
  }, []);

  // Handle crop cancellation
  const handleCropCancel = useCallback(() => {
    resetImage();
  }, []);

  const resetImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setShowCropper(false);
    setCroppedImage(null);
    setCurrentImageId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadImage = async (file) => {
    try {
      setUploadingImage(true);
      const fileId = `file_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      console.log("Generated fileId:", fileId); // Debug log
      console.log("File:", file); // Debug log
      console.log("File type:", typeof file); // Debug log
      console.log("File name:", file?.name); // Debug log
      console.log("File size:", file?.size); // Debug log

      // Verify file is valid
      if (!file || !(file instanceof File || file instanceof Blob)) {
        throw new Error("Invalid file object");
      }

      const response = await storage.createFile(BUCKET_MENU_IMG, fileId, file);
      return response.$id;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteImage = async (fileId) => {
    if (!fileId) return;
    try {
      await storage.deleteFile(BUCKET_MENU_IMG, fileId);
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchCollections();

    const unsubscribe = subscribeToMenu();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchMenu, subscribeToMenu, fetchCollections]);

  function openAddModal() {
    setEditingItem(null);
    setNome("");
    setPreco("");
    setDescricao("");
    setSelectedCategory("none");
    setSelectedTags([]);
    setIngredientes([]);
    resetImage();
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

    // Load existing image if available
    if (item.image_id) {
      setCurrentImageId(item.image_id);
      // Generate preview URL from Appwrite
      const previewUrl = storage.getFilePreview(
        "68c9da420007c345042f",
        item.image_id,
        400,
        400
      );
      setImagePreview(previewUrl.href);
    } else {
      resetImage();
    }

    setModalOpen(true);
  }

  async function handleSave() {
    try {
      let imageId = currentImageId;

      // Handle image upload if there's a new cropped image
      if (croppedImage) {
        // Delete old image if editing and had an image
        if (editingItem && currentImageId) {
          await deleteImage(currentImageId);
        }

        // Upload new image
        imageId = await uploadImage(croppedImage);
      }

      const itemData = {
        nome,
        preco: parseFloat(preco),
        description: descricao.trim() || null,
        category: selectedCategory === "none" ? null : selectedCategory,
        tags: selectedTags.length > 0 ? selectedTags : null,
        ingredientes,
        image_id: imageId || null,
      };

      if (editingItem) {
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

        setMenuItems((prev) =>
          prev.map((item) => (item.$id === tempItem.$id ? response : item))
        );
      }

      setModalOpen(false);
    } catch (err) {
      console.error("Error saving:", err);
      fetchMenu();
    }
  }

  async function handleDelete(id) {
    if (!confirm("Tens a certeza que queres apagar este item?")) return;
    try {
      const item = menuItems.find((item) => item.$id === id);

      // Delete associated image if exists
      if (item?.image_id) {
        await deleteImage(item.image_id);
      }

      setMenuItems((prev) => prev.filter((item) => item.$id !== id));
      await databases.deleteDocument(DB_ID, COLLECTION_ID, id);
    } catch (err) {
      console.error("Error deleting:", err);
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

  return (
    <div
      className="menu-component"
      style={{ backgroundColor: "white", minHeight: "100%", padding: "24px" }}
    >
      {/* Header */}
      <div
        className="menu-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          paddingBottom: "16px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <h1
          style={{
            fontSize: "24px",
            fontWeight: "600",
            color: "#1e293b",
            margin: 0,
          }}
        >
          Gestão de Menu
        </h1>
        <div style={{ display: "flex", gap: "12px" }}>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="refresh-button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              backgroundColor: "#f1f5f9",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Atualizar
          </Button>
          <Button
            onClick={openAddModal}
            className="add-button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <Plus size={16} />
            Adicionar Item
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="menu-content">
        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "48px",
              color: "#64748b",
            }}
          >
            <div style={{ marginRight: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  border: "3px solid #f1f5f9",
                  borderTop: "3px solid #3b82f6",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              ></div>
            </div>
            A carregar...
          </div>
        ) : menuItems.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px",
              color: "#64748b",
            }}
          >
            <p style={{ fontSize: "18px", marginBottom: "8px" }}>
              Nenhum item no menu
            </p>
            <p style={{ fontSize: "14px" }}>
              Clique em "Adicionar Item" para começar
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "20px",
              padding: "20px",
            }}
          >
            {menuItems.map((item) => {
              // Get the pre-computed image URL from memoized object
              const imageUrl = imageUrls[item.$id] || null;

              return (
                <div
                  key={item.$id}
                  style={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 16px rgba(0,0,0,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 2px 8px rgba(0,0,0,0.1)";
                  }}
                >
                  {/* Image Container */}
                  <div
                    style={{
                      width: "100%",
                      height: "200px",
                      backgroundColor: "#ffffff", // Always white background for transparency support
                      backgroundImage:
                        imageUrl &&
                        imageUrl !== "null" &&
                        imageUrl !== "undefined"
                          ? `url(${imageUrl})`
                          : "none",
                      backgroundSize: "contain", // Show full image without zooming
                      backgroundRepeat: "no-repeat", // Prevent image repetition
                      backgroundPosition: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      border: imageUrl ? "none" : "2px dashed #e5e7eb", // Add border only when no image
                    }}
                  >
                    {!imageUrl && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          color: "#94a3b8",
                        }}
                      >
                        <Upload size={32} />
                        <span style={{ fontSize: "12px", marginTop: "8px" }}>
                          Sem imagem
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: "16px" }}>
                    {/* Title and Price */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "8px",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "#1e293b",
                          margin: 0,
                          lineHeight: "1.3",
                        }}
                      >
                        {item.nome}
                      </h3>
                      <span
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#dc2626",
                          marginLeft: "12px",
                          flexShrink: 0,
                        }}
                      >
                        €{item.preco?.toFixed(2)}
                      </span>
                    </div>

                    {/* Description */}
                    {item.descricao && (
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#64748b",
                          margin: "0 0 12px 0",
                          lineHeight: "1.4",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.descricao}
                      </p>
                    )}

                    {/* Category */}
                    {item.category && (
                      <div style={{ marginBottom: "8px" }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            borderRadius: "6px",
                            backgroundColor: "#dbeafe",
                            color: "#1d4ed8",
                            border: "1px solid #bfdbfe",
                          }}
                        >
                          {item.category}
                        </span>
                      </div>
                    )}

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "4px",
                          marginBottom: "12px",
                        }}
                      >
                        {item.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            style={{
                              padding: "2px 6px",
                              fontSize: "11px",
                              borderRadius: "4px",
                              backgroundColor: "#faf5ff",
                              color: "#7c3aed",
                              border: "1px solid #e9d5ff",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {item.tags.length > 3 && (
                          <span
                            style={{
                              padding: "2px 6px",
                              fontSize: "11px",
                              borderRadius: "4px",
                              backgroundColor: "#f1f5f9",
                              color: "#64748b",
                            }}
                          >
                            +{item.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(item);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "6px 12px",
                          backgroundColor: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          cursor: "pointer",
                          transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) =>
                          (e.target.style.backgroundColor = "#2563eb")
                        }
                        onMouseLeave={(e) =>
                          (e.target.style.backgroundColor = "#3b82f6")
                        }
                      >
                        <Edit size={14} />
                        Editar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.$id);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "6px 12px",
                          backgroundColor: "#dc2626",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          cursor: "pointer",
                          transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) =>
                          (e.target.style.backgroundColor = "#b91c1c")
                        }
                        onMouseLeave={(e) =>
                          (e.target.style.backgroundColor = "#dc2626")
                        }
                      >
                        <Trash2 size={14} />
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "95vh",
              overflow: "hidden",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "24px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#1e293b",
                    margin: 0,
                  }}
                >
                  {editingItem
                    ? "Editar item do menu"
                    : "Adicionar item ao menu"}
                </h2>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#64748b",
                    margin: "4px 0 0 0",
                  }}
                >
                  {editingItem
                    ? "Atualize os detalhes abaixo"
                    : "Preencha as informações abaixo"}
                </p>
              </div>
              <button
                onClick={() => {
                  setModalOpen(false);
                  resetImage();
                }}
                style={{
                  padding: "8px",
                  color: "#64748b",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div
              style={{
                overflowY: "auto",
                flex: 1,
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
              }}
            >
              {/* Basic Information */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                }}
              >
                <div style={{ gridColumn: "1 / -1" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#374151",
                      marginBottom: "8px",
                    }}
                  >
                    Nome do item *
                  </label>
                  <Input
                    placeholder="Introduza o nome do item"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "0 12px",
                      backgroundColor: "white",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#374151",
                      marginBottom: "8px",
                    }}
                  >
                    Preço (€) *
                  </label>
                  <Input
                    placeholder="0,00"
                    type="number"
                    step="0.01"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "0 12px",
                      backgroundColor: "white",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#374151",
                      marginBottom: "8px",
                    }}
                  >
                    Categoria
                  </label>
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "0 12px",
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        fontSize: "14px",
                      }}
                    >
                      <SelectValue placeholder="Selecionar categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {availableCategories.map((category) => (
                        <SelectItem key={category.$id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#374151",
                      marginBottom: "8px",
                    }}
                  >
                    Descrição
                  </label>
                  <Textarea
                    placeholder="Introduza a descrição do item (opcional)"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      backgroundColor: "white",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "14px",
                      minHeight: "80px",
                      resize: "none",
                    }}
                  />
                </div>
              </div>

              {/* Image Upload Section */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "12px",
                  }}
                >
                  Imagem do Item
                </label>

                {/* Existing Image Display (when editing) */}
                {editingItem &&
                  editingItem.image_id &&
                  !imagePreview &&
                  !showCropper && (
                    <div style={{ marginBottom: "16px" }}>
                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          padding: "16px",
                          backgroundColor: "#f9fafb",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: "200px",
                            backgroundImage:
                              editingItem.image_id &&
                              getImageUrl(editingItem.image_id)
                                ? `url(${getImageUrl(editingItem.image_id)})`
                                : "none",
                            backgroundColor: "#ffffff", // Always white background for transparency support
                            backgroundSize: "contain", // Show full image without zooming
                            backgroundRepeat: "no-repeat", // Prevent image repetition
                            backgroundPosition: "center",
                            borderRadius: "6px",
                            marginBottom: "12px",
                            border: "1px solid #e5e7eb", // Add border to define the image area
                          }}
                        ></div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "center",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "8px 16px",
                              backgroundColor: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "14px",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                            }}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#2563eb")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "#3b82f6")
                            }
                          >
                            <Upload size={16} />
                            Substituir Imagem
                          </button>
                          <button
                            type="button"
                            onClick={deleteImage}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "8px 16px",
                              backgroundColor: "#dc2626",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "14px",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                            }}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#b91c1c")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "#dc2626")
                            }
                          >
                            <Trash2 size={16} />
                            Remover Imagem
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                {!imagePreview &&
                  !showCropper &&
                  (!editingItem || !editingItem.image_id) && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: "2px dashed #d1d5db",
                        borderRadius: "8px",
                        padding: "32px",
                        textAlign: "center",
                        cursor: "pointer",
                        backgroundColor: "#f9fafb",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.borderColor = "#3b82f6";
                        e.target.style.backgroundColor = "#f0f9ff";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.borderColor = "#d1d5db";
                        e.target.style.backgroundColor = "#f9fafb";
                      }}
                    >
                      <Upload
                        size={48}
                        style={{ color: "#9ca3af", margin: "0 auto 12px" }}
                      />
                      <p
                        style={{
                          fontSize: "16px",
                          color: "#374151",
                          margin: "0 0 8px 0",
                        }}
                      >
                        Clique para selecionar uma imagem
                      </p>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#9ca3af",
                          margin: 0,
                        }}
                      >
                        PNG, JPG ou WEBP até 5MB
                      </p>
                    </div>
                  )}

                {showCropper && imagePreview && (
                  <ImageCropper
                    imagePreview={imagePreview}
                    onCropApply={handleCropApply}
                    onCancel={handleCropCancel}
                  />
                )}

                {imagePreview && !showCropper && (
                  <div>
                    <div
                      style={{
                        position: "relative",
                        display: "inline-block",
                        marginBottom: "12px",
                      }}
                    >
                      <img
                        src={
                          croppedImage
                            ? URL.createObjectURL(croppedImage)
                            : imagePreview
                        }
                        alt="Preview"
                        style={{
                          width: "200px",
                          height: "200px",
                          objectFit: "cover",
                          borderRadius: "8px",
                          border: "2px solid #e5e7eb",
                        }}
                      />
                      <button
                        type="button"
                        onClick={resetImage}
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          width: "28px",
                          height: "28px",
                          backgroundColor: "rgba(239, 68, 68, 0.9)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 16px",
                          backgroundColor: "#f3f4f6",
                          color: "#374151",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          fontWeight: "500",
                          cursor: "pointer",
                        }}
                      >
                        <RotateCcw size={16} />
                        Trocar Imagem
                      </button>

                      {croppedImage && (
                        <button
                          type="button"
                          onClick={() => setShowCropper(true)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 16px",
                            backgroundColor: "#3b82f6",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: "500",
                            cursor: "pointer",
                          }}
                        >
                          <Crop size={16} />
                          Re-crop
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleImageSelect}
                  style={{ display: "none" }}
                />
              </div>

              {/* Tags */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "12px",
                  }}
                >
                  Tags
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {availableTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.name);
                    return (
                      <button
                        key={tag.$id}
                        type="button"
                        onClick={() => toggleTag(tag.name)}
                        style={{
                          padding: "6px 12px",
                          fontSize: "14px",
                          borderRadius: "6px",
                          border: isSelected
                            ? "1px solid #3b82f6"
                            : "1px solid #d1d5db",
                          backgroundColor: isSelected ? "#dbeafe" : "white",
                          color: isSelected ? "#1d4ed8" : "#374151",
                          cursor: "pointer",
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
                {selectedTags.length > 0 && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      backgroundColor: "#f8fafc",
                      borderRadius: "6px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginBottom: "8px",
                      }}
                    >
                      Selecionadas ({selectedTags.length})
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                      }}
                    >
                      {selectedTags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 8px",
                            fontSize: "14px",
                            backgroundColor: "#dbeafe",
                            color: "#1d4ed8",
                            borderRadius: "6px",
                            border: "1px solid #bfdbfe",
                          }}
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(tag)}
                            style={{
                              marginLeft: "6px",
                              padding: "2px",
                              backgroundColor: "transparent",
                              border: "none",
                              color: "#1d4ed8",
                              cursor: "pointer",
                            }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Ingredients */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "12px",
                  }}
                >
                  Ingredientes
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <Input
                    placeholder="Adicionar ingrediente"
                    value={ingredienteInput}
                    onChange={(e) => setIngredienteInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addIngrediente()}
                    style={{
                      flex: 1,
                      height: "40px",
                      padding: "0 12px",
                      backgroundColor: "white",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "14px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={addIngrediente}
                    style={{
                      height: "40px",
                      padding: "0 16px",
                      backgroundColor: "#3b82f6",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: "500",
                      cursor: "pointer",
                    }}
                  >
                    Adicionar
                  </button>
                </div>
                {ingredientes.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginBottom: "8px",
                      }}
                    >
                      Adicionados ({ingredientes.length})
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                      }}
                    >
                      {ingredientes.map((ing) => (
                        <span
                          key={ing}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 8px",
                            fontSize: "14px",
                            backgroundColor: "#f1f5f9",
                            color: "#475569",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                          }}
                        >
                          {ing}
                          <button
                            onClick={() => removeIngrediente(ing)}
                            style={{
                              marginLeft: "6px",
                              padding: "2px",
                              backgroundColor: "transparent",
                              border: "none",
                              color: "#475569",
                              cursor: "pointer",
                            }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "12px",
                padding: "24px",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                onClick={() => {
                  setModalOpen(false);
                  resetImage();
                }}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  backgroundColor: "white",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={
                  loadingCollections || !nome.trim() || !preco || uploadingImage
                }
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: "500",
                  borderRadius: "6px",
                  border: "none",
                  cursor:
                    loadingCollections ||
                    !nome.trim() ||
                    !preco ||
                    uploadingImage
                      ? "not-allowed"
                      : "pointer",
                  backgroundColor:
                    loadingCollections ||
                    !nome.trim() ||
                    !preco ||
                    uploadingImage
                      ? "#9ca3af"
                      : "#3b82f6",
                  color: "white",
                }}
              >
                {uploadingImage
                  ? "A carregar imagem..."
                  : loadingCollections
                  ? "A guardar..."
                  : editingItem
                  ? "Atualizar item"
                  : "Criar item"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
