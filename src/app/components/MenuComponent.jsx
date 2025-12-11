"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Edit,
  Trash2,
  X,
  RefreshCw,
  Upload,
  ClipboardList,
  Wand2,
  Check,
} from "lucide-react";
import {
  Input,
  Button,
  Select,
  Table,
  Tag,
  Image as AntdImage,
  notification,
} from "antd";
import { Cropper } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";
import NumberFlow from "@number-flow/react";

const { TextArea } = Input;
import "./MenuComponent.scss";

// Import auth from your API module
import { getAuthToken, apiRequest as baseApiRequest } from "@/lib/api";
import { useWebSocketContext } from "@/contexts/WebSocketContext";

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// API helper function that uses your existing auth system
const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();

  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      // Handle authentication errors
      alert("Sessão expirada. Por favor, faça login novamente.");
      return null;
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export default function MenuComponent() {
  const { socket, connected } = useWebSocketContext();
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [expandedTags, setExpandedTags] = useState(new Set());
  const [searchText, setSearchText] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterIngredient, setFilterIngredient] = useState("");

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

  // Background removal states
  const [removingBackground, setRemovingBackground] = useState(false);
  const [backgroundRemovalPreview, setBackgroundRemovalPreview] =
    useState(null);
  const [originalImageBeforeRemoval, setOriginalImageBeforeRemoval] =
    useState(null);

  const fileInputRef = useRef(null);
  const cropperRef = useRef(null);

  // Toast notification function using Ant Design
  const showToast = (message, type = "success") => {
    notification[type]({
      message:
        type === "success"
          ? "Sucesso"
          : type === "error"
          ? "Erro"
          : "Informação",
      description: message,
      placement: "topRight",
      duration: 3,
    });
  };

  // Fetch tags and categories
  const fetchCollections = useCallback(async () => {
    setLoadingCollections(true);
    try {
      const data = await apiRequest("/menu");
      if (data) {
        setAvailableTags(data.tags || []);
        setAvailableCategories(data.category || []);
        setAuthError(false);
      } else {
        // Handle authentication error case
        setAvailableTags([]);
        setAvailableCategories([]);
        setAuthError(true);
      }
    } catch (err) {
      setAvailableTags([]);
      setAvailableCategories([]);
    }
    setLoadingCollections(false);
  }, []);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/menu");
      if (data) {
        setMenuItems(data.documents || []);
        setAuthError(false);
      } else {
        // Handle authentication error case
        setMenuItems([]);
        setAuthError(true);
      }
    } catch (err) {
      setMenuItems([]);
    }
    setLoading(false);
  }, []);

  // Function to get image URL for menu item
  const getImageUrl = useCallback((imageId) => {
    if (!imageId || imageId === "undefined" || imageId === "null") return null;

    const cacheKey = imageId;

    // Check cache first
    if (imageCache.current.has(cacheKey)) {
      return imageCache.current.get(cacheKey);
    }

    try {
      // Get S3 bucket URL from environment (fallback to API redirect if not set)
      const S3_BUCKET_URL = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_URL;

      let imageUrl;
      if (S3_BUCKET_URL) {
        // Direct S3 URL
        imageUrl = `${S3_BUCKET_URL}/imagens-menu/${imageId}`;
      } else {
        // Fallback to API redirect
        imageUrl = `${API_BASE_URL}/upload/files/imagens-menu/${imageId}`;
      }

      // Cache the URL
      imageCache.current.set(cacheKey, imageUrl);
      return imageUrl;
    } catch (error) {
      return null;
    }
  }, []);

  // Memoize image URLs for all menu items to prevent excessive re-computation
  const imageUrls = useMemo(() => {
    const urls = {};
    menuItems.forEach((item) => {
      // Add null check for item and item.image_id
      if (item && item.image_id) {
        urls[item.$id] = getImageUrl(item.image_id);
      }
    });
    return urls;
  }, [menuItems, getImageUrl]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setAuthError(false); // Reset auth error on refresh
    try {
      await Promise.all([fetchMenu(), fetchCollections()]);
    } catch (err) {
      console.error("Error refreshing data:", err);
    }
    setRefreshing(false);
  };

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
    setBackgroundRemovalPreview(null);
    setOriginalImageBeforeRemoval(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Background removal function
  const removeBackground = async () => {
    if (!imagePreview && !currentImageId) {
      showToast("Por favor, selecione uma imagem primeiro", "error");
      return;
    }

    try {
      setRemovingBackground(true);

      // Get the image data (either from preview URL or create from blob or from existing image)
      let imageDataToSend;

      if (croppedImageBlob) {
        // Convert blob to base64
        const reader = new FileReader();
        imageDataToSend = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(croppedImageBlob);
        });
      } else if (imagePreview) {
        // If it's a data URL or blob URL, we need to fetch it first
        if (imagePreview.startsWith("data:")) {
          imageDataToSend = imagePreview;
        } else if (imagePreview.startsWith("blob:")) {
          // Convert blob URL to base64
          const response = await fetch(imagePreview);
          const blob = await response.blob();
          const reader = new FileReader();
          imageDataToSend = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          // It's a URL from the server, fetch it
          const response = await fetch(imagePreview);
          const blob = await response.blob();
          const reader = new FileReader();
          imageDataToSend = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } else if (currentImageId) {
        // Fetch existing image from server
        const imageUrl = getImageUrl(currentImageId);
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        imageDataToSend = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      console.log("[BG REMOVAL] Sending request to remove background...");

      // Save original image before removal (for undo)
      setOriginalImageBeforeRemoval({
        preview: imagePreview,
        blob: croppedImageBlob,
      });

      // Call the background removal API
      const response = await apiRequest("/upload/remove-background", {
        method: "POST",
        body: JSON.stringify({
          imageData: imageDataToSend,
        }),
      });

      console.log("[BG REMOVAL] Background removed successfully!");

      // Convert the returned base64 to blob
      const base64Response = response.imageData;
      const base64Data = base64Response.replace(
        /^data:image\/[^;]+;base64,/,
        ""
      );
      const binaryData = atob(base64Data);
      const arrayBuffer = new Uint8Array(binaryData.length);

      for (let i = 0; i < binaryData.length; i++) {
        arrayBuffer[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([arrayBuffer], { type: "image/png" });

      // Update the preview and blob
      const previewUrl = URL.createObjectURL(blob);
      setImagePreview(previewUrl);
      setCroppedImageBlob(blob);
      setBackgroundRemovalPreview(previewUrl);

      showToast("Fundo removido com sucesso!", "success");
    } catch (error) {
      console.error("[BG REMOVAL] Error removing background:", error);
      showToast(
        "Erro ao remover o fundo. Por favor, tente novamente.",
        "error"
      );
    } finally {
      setRemovingBackground(false);
    }
  };

  // Undo background removal
  const undoBackgroundRemoval = () => {
    if (originalImageBeforeRemoval) {
      setImagePreview(originalImageBeforeRemoval.preview);
      setCroppedImageBlob(originalImageBeforeRemoval.blob);
      setBackgroundRemovalPreview(null);
      setOriginalImageBeforeRemoval(null);
      showToast("Fundo original restaurado", "info");
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

      // Convert the file/blob to base64
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      return new Promise((resolve, reject) => {
        img.onload = async () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const base64Data = canvas.toDataURL("image/png");

          try {
            const response = await apiRequest("/upload/menu-image", {
              method: "POST",
              body: JSON.stringify({
                imageData: base64Data,
                filename: `menu-image-${Date.now()}.png`,
              }),
            });

            resolve(response.filename);
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = reject;

        // Handle both File objects and Blob objects
        if (fileOrBlob instanceof File || fileOrBlob instanceof Blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            img.src = e.target.result;
          };
          reader.readAsDataURL(fileOrBlob);
        } else {
          reject(new Error("Invalid file object"));
        }
      });
    } catch (error) {
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchCollections();
  }, [fetchMenu, fetchCollections]);

  // WebSocket Real-Time Updates
  useEffect(() => {
    if (!socket || !connected) return;

    console.log("🔌 MenuComponent: Setting up WebSocket listeners");

    // Menu item created
    const handleMenuCreated = (item) => {
      console.log("🍕 Menu item created via WebSocket:", item);

      // Add new item to the list (optimistic update)
      setMenuItems((prev) => {
        // Check if item already exists (avoid duplicates)
        const exists = prev.some(
          (m) =>
            m.$id === item.$id ||
            m.$id === item.id ||
            m.id === item.$id ||
            m.id === item.id
        );
        if (exists) return prev;

        return [item, ...prev];
      });

      // Update categories if new category introduced
      if (item.category) {
        setAvailableCategories((prev) => {
          const exists = prev.some((cat) => cat.name === item.category);
          if (!exists) {
            return [...prev, { id: item.category, name: item.category }];
          }
          return prev;
        });
      }

      // Update tags if new tags introduced
      if (item.tags && Array.isArray(item.tags)) {
        setAvailableTags((prev) => {
          const newTags = item.tags.filter(
            (tagName) => !prev.some((t) => t.name === tagName)
          );
          if (newTags.length > 0) {
            return [
              ...prev,
              ...newTags.map((tagName) => ({ id: tagName, name: tagName })),
            ];
          }
          return prev;
        });
      }
    };

    // Menu item updated
    const handleMenuUpdated = (item) => {
      console.log("✏️ Menu item updated via WebSocket:", item);

      setMenuItems((prev) =>
        prev.map((m) => {
          // Match by $id or id
          if (
            m.$id === item.$id ||
            m.$id === item.id ||
            m.id === item.$id ||
            m.id === item.id
          ) {
            return item;
          }
          return m;
        })
      );

      // Update categories if changed
      if (item.category) {
        setAvailableCategories((prev) => {
          const exists = prev.some((cat) => cat.name === item.category);
          if (!exists) {
            return [...prev, { id: item.category, name: item.category }];
          }
          return prev;
        });
      }

      // Update tags if changed
      if (item.tags && Array.isArray(item.tags)) {
        setAvailableTags((prev) => {
          const newTags = item.tags.filter(
            (tagName) => !prev.some((t) => t.name === tagName)
          );
          if (newTags.length > 0) {
            return [
              ...prev,
              ...newTags.map((tagName) => ({ id: tagName, name: tagName })),
            ];
          }
          return prev;
        });
      }
    };

    // Menu item deleted
    const handleMenuDeleted = (data) => {
      console.log("🗑️ Menu item deleted via WebSocket:", data);
      const itemId = data.id || data.$id;

      setMenuItems((prev) =>
        prev.filter((m) => m.$id !== itemId && m.id !== itemId)
      );

      // If currently editing this item, close the modal
      if (
        editingItem &&
        (editingItem.$id === itemId || editingItem.id === itemId)
      ) {
        setModalOpen(false);
        setEditingItem(null);
      }
    };

    // Register all event listeners
    socket.on("menu:created", handleMenuCreated);
    socket.on("menu:updated", handleMenuUpdated);
    socket.on("menu:deleted", handleMenuDeleted);

    // Cleanup function
    return () => {
      console.log("🔌 MenuComponent: Cleaning up WebSocket listeners");

      socket.off("menu:created", handleMenuCreated);
      socket.off("menu:updated", handleMenuUpdated);
      socket.off("menu:deleted", handleMenuDeleted);
    };
  }, [socket, connected, editingItem]);

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
      // Get S3 bucket URL from environment (fallback to API redirect if not set)
      const S3_BUCKET_URL = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_URL;
      const previewUrl = S3_BUCKET_URL
        ? `${S3_BUCKET_URL}/imagens-menu/${item.image_id}`
        : `${API_BASE_URL}/upload/files/imagens-menu/${item.image_id}`;
      setImagePreview(previewUrl);
    } else {
      resetImage();
    }

    setModalOpen(true);
  }

  async function handleSave() {
    try {
      let imageId = currentImageId;

      if (croppedImageBlob) {
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
        // Update existing item
        const response = await apiRequest(`/menu/${editingItem.$id}`, {
          method: "PUT",
          body: JSON.stringify(itemData),
        });

        if (response) {
          // Update local state immediately for editing
          setMenuItems((prev) =>
            prev.map((item) => (item.$id === editingItem.$id ? response : item))
          );
          showToast("Item atualizado com sucesso!", "success");
        }
      } else {
        // Create new item
        const response = await apiRequest("/menu", {
          method: "POST",
          body: JSON.stringify(itemData),
        });

        if (response) {
          // Don't add to state here - let WebSocket handle it to avoid duplicates
          // setMenuItems((prev) => [...prev, response]);
          showToast("Item criado com sucesso!", "success");
        }
      }

      setModalOpen(false);
      resetImage();
    } catch (err) {
      console.error("Error saving menu item:", err);
      showToast(
        `Erro ao ${editingItem ? "atualizar" : "criar"} item: ${err.message}`,
        "error"
      );
      // Refresh menu to ensure consistency
      fetchMenu();
    }
  }

  async function handleDelete(id) {
    if (!confirm("Tens a certeza que queres apagar este item?")) return;
    try {
      // Optimistic update
      setMenuItems((prev) => prev.filter((item) => item.$id !== id));

      // Backend will handle deleting the associated image
      await apiRequest(`/menu/${id}`, {
        method: "DELETE",
      });
    } catch (err) {
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

  function toggleTagsExpanded(itemId) {
    setExpandedTags((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }

  // Filtered menu items based on search and filters
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Search text filter
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchesName = item.nome?.toLowerCase().includes(searchLower);
        const matchesDescription = item.description
          ?.toLowerCase()
          .includes(searchLower);
        const matchesIngredients = item.ingredientes?.some((ing) =>
          ing.toLowerCase().includes(searchLower)
        );
        if (!matchesName && !matchesDescription && !matchesIngredients) {
          return false;
        }
      }

      // Category filter
      if (filterCategory && item.category !== filterCategory) {
        return false;
      }

      // Tag filter
      if (filterTag && !item.tags?.includes(filterTag)) {
        return false;
      }

      // Ingredient filter
      if (filterIngredient && !item.ingredientes?.includes(filterIngredient)) {
        return false;
      }

      return true;
    });
  }, [menuItems, searchText, filterCategory, filterTag, filterIngredient]);

  return (
    <div className="menu-component">
      {/* Header Card */}
      <div className="menu-header-card">
        <div className="menu-header-card__content">
          <div className="menu-header-card__left">
            <h1 className="menu-header-card__title">Gestão de Menu</h1>
            <p className="menu-header-card__description">
              Crie e gere o menu do restaurante com categorias, tags e
              ingredientes.
            </p>
            <div className="menu-header-card__actions">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="menu-header-card__btn menu-header-card__btn--secondary"
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "animate-spin" : ""}
                />
                Atualizar
              </button>
              <button
                onClick={openAddModal}
                className="menu-header-card__btn menu-header-card__btn--primary"
                disabled={loading}
              >
                <Plus size={16} />
                Adicionar Item
              </button>
            </div>
          </div>
          <div className="menu-header-card__right">
            <div className="menu-header-card__circles">
              <div className="circle circle-1"></div>
              <div className="circle circle-2"></div>
              <div className="circle circle-3"></div>
              <div className="circle circle-4"></div>
              <div className="circle circle-5"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="menu-content">
        {authError ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px",
              color: "#dc2626",
              backgroundColor: "#fef2f2",
              borderRadius: "8px",
              border: "1px solid #fecaca",
            }}
          >
            <p style={{ fontSize: "18px", marginBottom: "8px" }}>
              ⚠️ Erro de Autenticação
            </p>
            <p style={{ fontSize: "14px", marginBottom: "16px" }}>
              Não foi possível autenticar. Verifique se está logado.
            </p>
            <p style={{ fontSize: "12px", color: "#6b7280" }}>
              Token atual: {getAuthToken() ? "Presente" : "Ausente"}
            </p>
            <button
              onClick={() => {
                setAuthError(false);
                handleRefresh();
              }}
              style={{
                marginTop: "16px",
                padding: "8px 16px",
                backgroundColor: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Tentar Novamente
            </button>
          </div>
        ) : loading ? (
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
          <>
            {/* Search and Filter Bar */}
            <div
              style={{
                marginBottom: "16px",
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <Input.Search
                placeholder="Buscar por nome, descrição ou ingredientes..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onSearch={(value) => setSearchText(value)}
                style={{ flex: "1 1 300px", minWidth: "250px" }}
                allowClear
              />
              <Select
                placeholder="Filtrar por categoria"
                value={filterCategory || undefined}
                onChange={(value) => setFilterCategory(value || "")}
                style={{ width: 200 }}
                className="custom-select"
                allowClear
              >
                {availableCategories.map((cat) => (
                  <Select.Option key={cat.name} value={cat.name}>
                    {cat.name}
                  </Select.Option>
                ))}
              </Select>
              <Select
                placeholder="Filtrar por tag"
                value={filterTag || undefined}
                onChange={(value) => setFilterTag(value || "")}
                style={{ width: 180 }}
                className="custom-select"
                allowClear
              >
                {availableTags.map((tag) => (
                  <Select.Option key={tag.name} value={tag.name}>
                    {tag.name}
                  </Select.Option>
                ))}
              </Select>
              <Select
                placeholder="Filtrar por ingrediente"
                value={filterIngredient || undefined}
                onChange={(value) => setFilterIngredient(value || "")}
                style={{ width: 200 }}
                className="custom-select"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.children ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                {[
                  ...new Set(
                    menuItems.flatMap((item) => item.ingredientes || [])
                  ),
                ]
                  .sort()
                  .map((ing) => (
                    <Select.Option key={ing} value={ing}>
                      {ing}
                    </Select.Option>
                  ))}
              </Select>
            </div>

            <Table
              dataSource={filteredMenuItems.map((item) => ({
                ...item,
                key: item.$id,
              }))}
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} p/página de ${total} itens${
                    total !== menuItems.length
                      ? ` (${menuItems.length} no total)`
                      : ""
                  }`,
              }}
              scroll={{ x: "max-content" }}
              tableLayout="auto"
              columns={[
                {
                  title: "Imagem",
                  dataIndex: "image_id",
                  key: "image_id",
                  width: 100,
                  render: (imageId, record) => {
                    const imageUrl = imageUrls[record.$id];
                    return imageUrl ? (
                      <AntdImage
                        src={imageUrl}
                        alt={record.nome}
                        width={60}
                        height={60}
                        style={{ borderRadius: "8px", objectFit: "contain" }}
                        preview={false}
                        fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect fill='%23f0f0f0' width='60' height='60'/%3E%3C/svg%3E"
                      />
                    ) : (
                      <div
                        style={{
                          width: "60px",
                          height: "60px",
                          borderRadius: "8px",
                          background: "#f8f9fa",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <Upload size={20} color="#9ca3af" />
                      </div>
                    );
                  },
                },
                {
                  title: "Item",
                  dataIndex: "nome",
                  key: "nome",
                  render: (nome, record) => (
                    <div style={{ minWidth: 150 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: "#1a1a1a",
                          fontSize: "14px",
                          marginBottom: record.description ? "4px" : 0,
                        }}
                      >
                        {nome}
                      </div>
                      {record.description && (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748b",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {record.description}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  title: "Preço",
                  dataIndex: "preco",
                  key: "preco",
                  width: 100,
                  sorter: (a, b) => parseFloat(a.preco) - parseFloat(b.preco),
                  render: (preco) => (
                    <span
                      style={{
                        fontWeight: 700,
                        color: "#059669",
                        fontSize: "14px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <NumberFlow
                        value={parseFloat(preco) || 0}
                        format={{
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }}
                      />
                      €
                    </span>
                  ),
                },
                {
                  title: "Categoria",
                  dataIndex: "category",
                  key: "category",
                  width: 120,
                  render: (category) =>
                    category ? (
                      <Tag
                        color="blue"
                        style={{
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        {category}
                      </Tag>
                    ) : (
                      <span style={{ color: "#9ca3af", fontSize: "12px" }}>
                        Sem categoria
                      </span>
                    ),
                },
                {
                  title: "Tags",
                  dataIndex: "tags",
                  key: "tags",
                  render: (tags, record) => {
                    if (!tags || tags.length === 0) return "-";
                    const isExpanded = expandedTags.has(record.$id);
                    const displayTags = isExpanded ? tags : tags.slice(0, 2);
                    return (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "4px",
                        }}
                      >
                        {displayTags.map((tag) => (
                          <Tag
                            key={tag}
                            style={{
                              borderRadius: "6px",
                              fontSize: "11px",
                              margin: 0,
                            }}
                          >
                            {tag}
                          </Tag>
                        ))}
                        {tags.length > 2 && (
                          <Tag
                            color="default"
                            style={{
                              borderRadius: "6px",
                              fontSize: "11px",
                              cursor: "pointer",
                              margin: 0,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTagsExpanded(record.$id);
                            }}
                          >
                            {isExpanded ? "Menos" : `+${tags.length - 2}`}
                          </Tag>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: "Ingredientes",
                  dataIndex: "ingredientes",
                  key: "ingredientes",
                  render: (ingredientes, record) => {
                    if (!ingredientes || ingredientes.length === 0) return "-";
                    const isExpanded = expandedTags.has(`${record.$id}-ing`);
                    const displayIngredientes = isExpanded
                      ? ingredientes
                      : ingredientes.slice(0, 2);
                    return (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "4px",
                        }}
                      >
                        {displayIngredientes.map((ing) => (
                          <Tag
                            key={ing}
                            color="green"
                            style={{
                              borderRadius: "6px",
                              fontSize: "11px",
                              margin: 0,
                            }}
                          >
                            {ing}
                          </Tag>
                        ))}
                        {ingredientes.length > 2 && (
                          <Tag
                            color="default"
                            style={{
                              borderRadius: "6px",
                              fontSize: "11px",
                              cursor: "pointer",
                              margin: 0,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTagsExpanded(`${record.$id}-ing`);
                            }}
                          >
                            {isExpanded
                              ? "Menos"
                              : `+${ingredientes.length - 2}`}
                          </Tag>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: "Ações",
                  key: "actions",
                  width: 120,
                  render: (_, record) => (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button
                        type="default"
                        size="small"
                        icon={<Edit size={14} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(record);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          color: "#2563eb",
                          borderColor: "#bfdbfe",
                        }}
                      />
                      <Button
                        type="default"
                        size="small"
                        danger
                        icon={<Trash2 size={14} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(record.$id);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                        }}
                      />
                    </div>
                  ),
                },
              ]}
              locale={{
                emptyText: (
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
                ),
              }}
            />
          </>
        )}
      </div>

      {/* Modal - Rendered via Portal to bypass stacking context */}
      {modalOpen &&
        typeof document !== "undefined" &&
        createPortal(
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
                      className="custom-select"
                    >
                      <Select.Option value="none">Sem categoria</Select.Option>
                      {availableCategories.map((category) => (
                        <Select.Option key={category.id} value={category.name}>
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
                            flexWrap: "wrap",
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
                        backgroundColor: "transparent",
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
                            backgroundColor: backgroundRemovalPreview
                              ? "transparent"
                              : "#ffffff",
                          }}
                        />
                        {backgroundRemovalPreview && (
                          <div
                            style={{
                              position: "absolute",
                              top: "8px",
                              left: "8px",
                              backgroundColor: "#10b981",
                              color: "white",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                            }}
                          >
                            <Wand2 size={12} />
                            Fundo Removido
                          </div>
                        )}
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
                          flexWrap: "wrap",
                        }}
                      >
                        {!backgroundRemovalPreview ? (
                          <button
                            type="button"
                            onClick={removeBackground}
                            disabled={removingBackground}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "8px 16px",
                              backgroundColor: removingBackground
                                ? "#9ca3af"
                                : "#8b5cf6",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "14px",
                              cursor: removingBackground
                                ? "not-allowed"
                                : "pointer",
                              transition: "all 0.2s ease",
                            }}
                            title="Remover fundo da imagem usando IA"
                          >
                            <Wand2
                              size={16}
                              className={
                                removingBackground ? "animate-spin" : ""
                              }
                            />
                            {removingBackground
                              ? "A processar..."
                              : "Remover Fundo"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={undoBackgroundRemoval}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "8px 16px",
                              backgroundColor: "#f59e0b",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "14px",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                            title="Restaurar imagem original"
                          >
                            <RefreshCw size={16} />
                            Desfazer Remoção
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={removingBackground}
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
                            cursor: removingBackground
                              ? "not-allowed"
                              : "pointer",
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
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
                  >
                    {availableTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag.name);
                      return (
                        <button
                          key={tag.id}
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
                    loadingCollections ||
                    !nome.trim() ||
                    !preco ||
                    uploadingImage
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
          </div>,
          document.body
        )}

      {/* Image Cropper Modal (via Portal) */}
      {showCropper &&
        typeof document !== "undefined" &&
        createPortal(
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
          </div>,
          document.body
        )}
    </div>
  );
}
