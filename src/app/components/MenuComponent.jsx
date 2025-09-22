"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Plus,
  Edit,
  Trash2,
  X,
  RefreshCw,
  Upload,
  ClipboardList,
} from "lucide-react";
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
import { Input, Button, Select } from "antd";
import { Cropper } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";

const { TextArea } = Input;
import "./MenuComponent.scss";

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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currentImageId, setCurrentImageId] = useState(null);
  const imageCache = useRef(new Map());

  // Image cropper states - simplified for react-advanced-cropper
  const [showCropper, setShowCropper] = useState(false);
  const [cropImage, setCropImage] = useState(null);
  const [croppedImageBlob, setCroppedImageBlob] = useState(null);

  const fileInputRef = useRef(null);
  const cropperRef = useRef(null);

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

    const cacheKey = imageId;

    // Check cache first
    if (imageCache.current.has(cacheKey)) {
      return imageCache.current.get(cacheKey);
    }

    try {
      const imageUrl = storage.getFilePreview(
        BUCKET_MENU_IMG,
        imageId,
        0, // width - 0 means original width
        0, // height - 0 means original height
        "center", // gravity
        85 // quality - balanced for performance and clarity
      );

      // Cache the URL
      imageCache.current.set(cacheKey, imageUrl);
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
        setCropImage(e.target.result);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setCroppedImageBlob(null);
    setCurrentImageId(null);
    setShowCropper(false);
    setCropImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Cropper functions
  const handleCropperClose = () => {
    setShowCropper(false);
    setCropImage(null);
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const applyCrop = () => {
    if (cropperRef.current) {
      const canvas = cropperRef.current.getCanvas();
      if (canvas) {
        canvas.toBlob((blob) => {
          if (blob) {
            setCroppedImageBlob(blob);
            const url = URL.createObjectURL(blob);
            setImagePreview(url);
            setShowCropper(false);
          }
        }, "image/png");
      }
    }
  };

  const uploadImage = async (fileOrBlob) => {
    try {
      setUploadingImage(true);
      const fileId = `file_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Handle both File objects and Blob objects
      let fileToUpload = fileOrBlob;
      if (fileOrBlob instanceof Blob && !(fileOrBlob instanceof File)) {
        // Convert blob to file
        fileToUpload = new File([fileOrBlob], `cropped-image-${fileId}.png`, {
          type: "image/png",
        });
      }

      console.log("Generated fileId:", fileId);
      console.log("File:", fileToUpload);
      console.log("File type:", typeof fileToUpload);
      console.log("File name:", fileToUpload?.name);
      console.log("File size:", fileToUpload?.size);

      // Verify file is valid
      if (
        !fileToUpload ||
        !(fileToUpload instanceof File || fileToUpload instanceof Blob)
      ) {
        throw new Error("Invalid file object");
      }

      const response = await storage.createFile(
        BUCKET_MENU_IMG,
        fileId,
        fileToUpload
      );
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
    setDescricao(item.description || "");
    setSelectedCategory(item.category || "none");
    setSelectedTags(item.tags || []);
    setIngredientes(item.ingredientes || []);

    if (item.image_id) {
      setCurrentImageId(item.image_id);
      const previewUrl = storage.getFilePreview(
        "68c9da420007c345042f",
        item.image_id,
        0, // Use original width
        0 // Use original height
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

      if (croppedImageBlob) {
        if (editingItem && currentImageId) {
          await deleteImage(currentImageId);
        }

        imageId = await uploadImage(croppedImageBlob);
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
    <div className="menu-component">
      {/* Header */}
      <div className="menu-header">
        <h1>
          <ClipboardList className="header-icon" />
          Gestão de Menu
        </h1>
        <div className="header-actions">
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="refresh-button"
            icon={
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
            }
          >
            Atualizar
          </Button>
          <Button
            onClick={openAddModal}
            type="primary"
            className="add-button"
            icon={<Plus size={16} />}
          >
            Adicionar Item
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="menu-content">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>A carregar...
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
              Clique em &quot;Adicionar Item&quot; para começar
            </p>
          </div>
        ) : (
          <div className="menu-items-grid">
            {menuItems.map((item) => {
              const imageUrl = imageUrls[item.$id] || null;

              return (
                <div key={item.$id} className="menu-item-card">
                  {/* Image Container */}
                  <div className="image-container">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.nome}
                        className="menu-item-image"
                        style={{
                          width: "100%",
                          height: "200px",
                          borderRadius: "8px 8px 0 0",
                        }}
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="no-image-placeholder"
                      style={{
                        display: imageUrl ? "none" : "flex",
                        width: "100%",
                        height: "200px",
                        backgroundColor: "#f8f9fa",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "8px 8px 0 0",
                        border: "1px solid #e9ecef",
                        color: "#6c757d",
                      }}
                    >
                      <Upload size={32} />
                      <span style={{ marginTop: "8px", fontSize: "14px" }}>
                        Sem imagem
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="card-content">
                    <div className="card-info">
                      {/* Title and Price */}
                      <div className="title-price-row">
                        <h3>{item.nome}</h3>
                        <span className="price">€{item.preco?.toFixed(2)}</span>
                      </div>

                      {/* Description */}
                      {item.description && (
                        <p className="description">{item.description}</p>
                      )}

                      {/* Category */}
                      {item.category && (
                        <div style={{ marginBottom: "8px" }}>
                          <span className="category-tag">{item.category}</span>
                        </div>
                      )}

                      {/* Tags */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="tags-container">
                          {item.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="tag">
                              {tag}
                            </span>
                          ))}
                          {item.tags.length > 3 && (
                            <span className="more-tags">
                              +{item.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="action-buttons">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(item);
                        }}
                        className="edit-btn"
                      >
                        <Edit size={14} />
                        Editar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.$id);
                        }}
                        className="delete-btn"
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
        <div className="modal-overlay">
          <div className="modal-container">
            {/* Modal Header */}
            <div className="modal-header">
              <div className="header-text">
                <h2>
                  {editingItem
                    ? "Editar item do menu"
                    : "Adicionar item ao menu"}
                </h2>
                <p>
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
                className="close-button"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="modal-content">
              {/* Basic Information */}
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Nome do item *</label>
                  <Input
                    placeholder="Introduza o nome do item"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Preço (€) *</label>
                  <Input
                    placeholder="0,00"
                    type="number"
                    step="0.01"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Categoria</label>
                  <Select
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    placeholder="Selecionar categoria"
                    style={{ width: "100%" }}
                  >
                    <Select.Option value="none">Sem categoria</Select.Option>
                    {availableCategories.map((category) => (
                      <Select.Option key={category.$id} value={category.name}>
                        {category.name}
                      </Select.Option>
                    ))}
                  </Select>
                </div>

                <div className="form-group full-width">
                  <label>Descrição</label>
                  <TextArea
                    placeholder="Introduza a descrição do item (opcional)"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={4}
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
                {editingItem && editingItem.image_id && !imagePreview && (
                  <div style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "16px",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "200px",
                          backgroundColor: "#ffffff",
                          backgroundImage:
                            editingItem.image_id &&
                            getImageUrl(editingItem.image_id)
                              ? `url(${getImageUrl(editingItem.image_id)})`
                              : "none",
                          backgroundSize: "contain",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "center",
                          borderRadius: "6px",
                          marginBottom: "12px",
                          border: "1px solid #e5e7eb",
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
                          }}
                        >
                          <Upload size={16} />
                          Substituir Imagem
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentImageId(null);
                            setImagePreview(null);
                          }}
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
                          }}
                        >
                          <Trash2 size={16} />
                          Remover Imagem
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Image Upload Area */}
                {!imagePreview && (!editingItem || !editingItem.image_id) && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: "2px dashed #d1d5db",
                      borderRadius: "8px",
                      padding: "32px",
                      textAlign: "center",
                      cursor: "pointer",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <Upload
                      size={48}
                      style={{
                        color: "#9ca3af",
                        margin: "0 auto 16px",
                        display: "block",
                      }}
                    />
                    <h4
                      style={{
                        fontSize: "16px",
                        fontWeight: "500",
                        color: "#374151",
                        margin: "0 0 8px 0",
                      }}
                    >
                      Selecionar Imagem
                    </h4>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#6b7280",
                        margin: 0,
                      }}
                    >
                      PNG, JPG ou WEBP até 5MB
                    </p>
                  </div>
                )}

                {/* Image Preview */}
                {imagePreview && (
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "8px",
                      padding: "16px",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        display: "inline-block",
                        marginBottom: "16px",
                        width: "100%",
                        textAlign: "center",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <img
                        src={imagePreview}
                        alt="Preview"
                        style={{
                          maxWidth: "300px",
                          maxHeight: "300px",
                          objectFit: "contain",
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                        }}
                      />
                      <button
                        type="button"
                        onClick={resetImage}
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          width: "32px",
                          height: "32px",
                          backgroundColor: "#dc2626",
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
                    {selectedImage && (
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#6b7280",
                          textAlign: "center",
                          marginBottom: "16px",
                        }}
                      >
                        <div>
                          Tamanho: {(selectedImage.size / 1024).toFixed(1)} KB
                        </div>
                        <div>Nome: {selectedImage.name}</div>
                      </div>
                    )}
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
                          backgroundColor: "#f3f4f6",
                          color: "#374151",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          fontSize: "14px",
                          cursor: "pointer",
                        }}
                      >
                        <Upload size={16} />
                        Trocar Imagem
                      </button>
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

      {/* Image Cropper Modal */}
      {showCropper && (
        <div className="image-cropper-overlay">
          <div className="image-cropper-modal">
            {/* Cropper Header */}
            <div className="cropper-header">
              <div className="header-content">
                <h2>Recortar Imagem</h2>
                <p>
                  Use a área de corte para recortar a imagem. O cropper é
                  responsivo e funciona em dispositivos móveis.
                </p>
              </div>
              <button onClick={handleCropperClose} className="close-button">
                <X size={20} />
              </button>
            </div>

            {/* Crop Container */}
            <div className="crop-container">
              <div
                style={{
                  width: "100%",
                  height: "400px",
                  maxHeight: "50vh",
                  minHeight: "300px",
                }}
              >
                <Cropper
                  ref={cropperRef}
                  src={cropImage}
                  className="cropper"
                  stencilProps={{
                    handlers: true,
                    lines: true,
                    movable: true,
                    resizable: true,
                  }}
                  backgroundWrapperProps={{
                    scaleImage: true,
                    moveImage: true,
                  }}
                />
              </div>
            </div>

            {/* Cropper Actions */}
            <div className="cropper-actions">
              <button
                onClick={handleCropperClose}
                className="action-btn cancel-btn"
              >
                Cancelar
              </button>
              <button onClick={applyCrop} className="action-btn apply-btn">
                Aplicar Corte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
