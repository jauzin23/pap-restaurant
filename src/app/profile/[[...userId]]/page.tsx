"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  UserCircle,
  Mail,
  Phone,
  User,
  Save,
  X,
  Calendar,
  Clock,
  Briefcase,
  CreditCard,
  Loader2,
  CheckCircle,
  Camera,
  Upload,
  Wand2,
  RefreshCw,
  Check,
  Tag,
  Building2,
} from "lucide-react";
import { Cropper } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";
import { BackgroundBeams } from "../../components/BackgroundBeams";
import { auth, users, getAuthToken } from "../../../lib/api";
import { isAuthenticated } from "../../../lib/auth";
import { useWebSocketContext } from "../../../contexts/WebSocketContext";
import "./page.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface User {
  $id: string;
  id: string;
  name: string;
  username: string;
  email: string;
  labels: string[];
  profile_image?: string;
  telefone?: string;
  nif?: number;
  status?: string;
  contrato?: string;
  hrs?: number;
  ferias?: boolean;
  created_at?: string;
}

function ProfilePageContent({
  params,
}: {
  params: Promise<{ userId?: string[] }>;
}) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const userIdParam = resolvedParams.userId ? resolvedParams.userId[0] : null;

  // WebSocket context
  const { socket, connected } = useWebSocketContext();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userLabels, setUserLabels] = useState<string[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "",
    telefone: "",
    nif: "",
    contrato: "",
    hrs: "",
    ferias: false,
    labels: [] as string[],
  });

  // Image editing states
  const [editingImage, setEditingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [croppedImageBlob, setCroppedImageBlob] = useState<Blob | null>(null);
  const [removingBackground, setRemovingBackground] = useState(false);
  const [backgroundRemovalPreview, setBackgroundRemovalPreview] = useState<
    string | null
  >(null);
  const [originalImageBeforeRemoval, setOriginalImageBeforeRemoval] = useState<{
    preview: string | null;
    blob: Blob | null;
  } | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<any>(null);

  // Toast notification function
  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success"
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Profile Image Component
  const ProfileImage = ({
    src,
    alt,
    size = 120,
  }: {
    src?: string;
    alt: string;
    size?: number;
  }) => {
    const [hasError, setHasError] = useState(false);

    return (
      <div
        style={{
          position: "relative",
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          overflow: "hidden",
          backgroundColor: "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {hasError || !src ? (
          <UserCircle size={size * 0.6} style={{ color: "#9ca3af" }} />
        ) : (
          <img
            src={src}
            alt={alt}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            onError={() => setHasError(true)}
          />
        )}
      </div>
    );
  };

  // Check if current user is manager
  const isManager =
    userLabels.includes("manager") ||
    userLabels.includes("Manager") ||
    userLabels.includes("gerente") ||
    userLabels.includes("Gerente");

  // Check if viewing own profile
  const isOwnProfile =
    currentUser && profileUser && currentUser.id === profileUser.id;

  // Can edit check
  const canEdit = isOwnProfile || isManager;

  // Can edit manager fields
  const canEditManagerFields = isManager;

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      try {
        // Get current logged-in user
        const userData = await auth.get();
        setCurrentUser(userData);
        setUserLabels(userData.labels || []);

        // Determine which user profile to load
        let targetUserId = userIdParam;

        // If no userId provided or userId matches current user, show own profile
        if (!targetUserId || targetUserId === userData.id) {
          targetUserId = userData.id;
        }

        // Fetch the profile user data
        const profileUserData = await users.get(targetUserId);
        setProfileUser(profileUserData);

        // Initialize form data
        setFormData({
          name: profileUserData.name || "",
          email: profileUserData.email || "",
          username: profileUserData.username || "",
          telefone: profileUserData.telefone || "",
          nif: profileUserData.nif?.toString() || "",
          contrato: profileUserData.contrato || "",
          hrs: profileUserData.hrs?.toString() || "",
          ferias: profileUserData.ferias || false,
          labels: profileUserData.labels || [],
        });
      } catch (error) {
        console.error("Error loading user data:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [userIdParam]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!socket || !connected || !profileUser?.id) return;

    const handleUserUpdated = (updatedUser: any) => {
      // Only update if it's THIS user's profile
      if (
        updatedUser.id === profileUser.id ||
        updatedUser.$id === profileUser.id
      ) {
        console.log("📝 Profile updated via WebSocket:", updatedUser.name);
        setProfileUser(updatedUser);

        // Update form data if not currently editing
        if (!isEditing) {
          setFormData({
            name: updatedUser.name || "",
            email: updatedUser.email || "",
            username: updatedUser.username || "",
            telefone: updatedUser.telefone || "",
            nif: updatedUser.nif?.toString() || "",
            contrato: updatedUser.contrato || "",
            hrs: updatedUser.hrs?.toString() || "",
            ferias: updatedUser.ferias || false,
            labels: updatedUser.labels || [],
          });
        }
      }
    };

    (socket as any).on("user:updated", handleUserUpdated);

    return () => {
      (socket as any).off("user:updated", handleUserUpdated);
    };
  }, [socket, connected, profileUser?.id, isEditing]);

  // Handle form input change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Handle save
  const handleSave = async () => {
    if (!profileUser || !canEdit) return;

    try {
      setIsSaving(true);

      // Prepare update data
      const updateData: any = {
        name: formData.name,
        email: formData.email,
        username: formData.username,
        telefone: formData.telefone,
        nif: formData.nif ? parseInt(formData.nif) : undefined,
      };

      // If manager, include manager-only fields
      if (canEditManagerFields) {
        updateData.contrato = formData.contrato;
        updateData.hrs = formData.hrs ? parseFloat(formData.hrs) : undefined;
        updateData.ferias = formData.ferias;
        updateData.labels = formData.labels;
      }

      // Remove undefined values
      Object.keys(updateData).forEach(
        (key) => updateData[key] === undefined && delete updateData[key]
      );

      // Update user
      const updatedUser = await users.update(profileUser.id, updateData);

      // Update local state
      setProfileUser(updatedUser);
      setIsEditing(false);
      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      showToast(
        "Erro ao atualizar perfil. Por favor, tente novamente.",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (!profileUser) return;

    // Reset form data
    setFormData({
      name: profileUser.name || "",
      email: profileUser.email || "",
      username: profileUser.username || "",
      telefone: profileUser.telefone || "",
      nif: profileUser.nif?.toString() || "",
      contrato: profileUser.contrato || "",
      hrs: profileUser.hrs?.toString() || "",
      ferias: profileUser.ferias || false,
      labels: profileUser.labels || [],
    });
    setIsEditing(false);
  };

  // Go back
  const goBack = () => {
    router.push("/pagina-teste-new");
  };

  // Image handling functions
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setCropImage(e.target?.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setCroppedImageBlob(null);
    setShowCropper(false);
    setCropImage(null);
    setBackgroundRemovalPreview(null);
    setOriginalImageBeforeRemoval(null);
    setEditingImage(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
        canvas.toBlob((blob: Blob | null) => {
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

  // API helper function with timeout
  const apiRequest = async (
    endpoint: string,
    options: RequestInit = {},
    timeoutMs = 30000
  ) => {
    const token = getAuthToken();

    const defaultOptions: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...defaultOptions,
        ...options,
        headers: {
          ...defaultOptions.headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText || response.statusText}`
        );
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error(
          `Request timeout (${timeoutMs}ms) - O servidor demorou muito tempo a responder`
        );
      }

      throw error;
    }
  };

  const removeBackground = async () => {
    if (!imagePreview && !profileUser?.profile_image) {
      showToast("Por favor, selecione uma imagem primeiro", "error");
      return;
    }

    try {
      setRemovingBackground(true);

      let imageDataToSend: string;

      if (croppedImageBlob) {
        const reader = new FileReader();
        imageDataToSend = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(croppedImageBlob);
        });
      } else if (imagePreview) {
        if (imagePreview.startsWith("data:")) {
          imageDataToSend = imagePreview;
        } else if (imagePreview.startsWith("blob:")) {
          const response = await fetch(imagePreview);
          const blob = await response.blob();
          const reader = new FileReader();
          imageDataToSend = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          const response = await fetch(imagePreview);
          const blob = await response.blob();
          const reader = new FileReader();
          imageDataToSend = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } else if (profileUser?.profile_image) {
        const imageUrl = `${API_BASE_URL}/files/imagens-perfil/${profileUser.profile_image}`;
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        imageDataToSend = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        return;
      }

      // Check image size (warn if > 5MB)
      const sizeInMB = (imageDataToSend.length * 3) / 4 / (1024 * 1024);
      if (sizeInMB > 5) {
        console.warn(`Large image: ${sizeInMB.toFixed(2)}MB`);
      }

      setOriginalImageBeforeRemoval({
        preview: imagePreview,
        blob: croppedImageBlob,
      });

      console.log("[BG REMOVAL] Sending request to remove background...");

      // Use 60 second timeout for background removal (it can take time)
      const response = await apiRequest(
        "/upload/remove-background",
        {
          method: "POST",
          body: JSON.stringify({ imageData: imageDataToSend }),
        },
        60000 // 60 second timeout
      );

      console.log("[BG REMOVAL] Background removed successfully!");

      const base64Data = response.imageData.replace(
        /^data:image\/[^;]+;base64,/,
        ""
      );
      const binaryData = atob(base64Data);
      const arrayBuffer = new Uint8Array(binaryData.length);

      for (let i = 0; i < binaryData.length; i++) {
        arrayBuffer[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([arrayBuffer], { type: "image/png" });
      const previewUrl = URL.createObjectURL(blob);
      setImagePreview(previewUrl);
      setCroppedImageBlob(blob);
      setBackgroundRemovalPreview(previewUrl);

      showToast("Fundo removido com sucesso!", "success");
    } catch (error: any) {
      console.error("Error removing background:", error);

      // More specific error messages
      let errorMessage = "Erro ao remover o fundo. ";
      if (error.message?.includes("timeout")) {
        errorMessage +=
          "O servidor demorou muito tempo a responder. Tente com uma imagem menor.";
      } else if (error.message?.includes("Failed to fetch")) {
        errorMessage +=
          "Não foi possível conectar ao servidor. Verifique se o servidor está a correr.";
      } else if (error.message?.includes("HTTP 413")) {
        errorMessage += "A imagem é muito grande. Por favor, reduza o tamanho.";
      } else if (error.message?.includes("HTTP 500")) {
        errorMessage += "Erro no servidor. Por favor, tente novamente.";
      } else {
        errorMessage += "Por favor, tente novamente.";
      }

      showToast(errorMessage, "error");
    } finally {
      setRemovingBackground(false);
    }
  };

  const undoBackgroundRemoval = () => {
    if (originalImageBeforeRemoval) {
      setImagePreview(originalImageBeforeRemoval.preview);
      setCroppedImageBlob(originalImageBeforeRemoval.blob);
      setBackgroundRemovalPreview(null);
      setOriginalImageBeforeRemoval(null);
      showToast("Fundo original restaurado", "info");
    }
  };

  const uploadProfileImage = async () => {
    if (!croppedImageBlob || !profileUser) return;

    try {
      setUploadingImage(true);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      const filename: string = await new Promise((resolve, reject) => {
        img.onload = async () => {
          if (ctx) {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const base64Data = canvas.toDataURL("image/png");

            try {
              const response = await apiRequest("/upload/profile-image", {
                method: "POST",
                body: JSON.stringify({
                  imageData: base64Data,
                  userId: profileUser.id,
                }),
              });

              resolve(response.filename);
            } catch (error) {
              reject(error);
            }
          }
        };

        img.onerror = reject;

        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(croppedImageBlob);
      });

      // Update user with new profile image
      const updatedUser = await users.update(profileUser.id, {
        profile_image: filename,
      });

      setProfileUser(updatedUser);

      resetImage();
      showToast("Foto de perfil atualizada com sucesso!", "success");
      setSaveSuccess(true);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error uploading profile image:", error);
      showToast(
        "Erro ao carregar imagem. Por favor, tente novamente.",
        "error"
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="dashboard fade-in">
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: -1,
          }}
        >
          <div className="relative bg-white text-black min-h-screen">
            <BackgroundBeams />
          </div>
        </div>

        <main className="main-content">
          <div className="profile-page">
            <div className="profile-loading">
              <Loader2 size={48} className="loading-spinner" />
              <p>A carregar perfil...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="dashboard fade-in">
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: -1,
          }}
        >
          <div className="relative bg-white text-black min-h-screen">
            <BackgroundBeams />
          </div>
        </div>

        <main className="main-content">
          <div className="profile-page">
            <div className="profile-error">
              <p>Utilizador não encontrado</p>
              <button onClick={goBack} className="back-button">
                Voltar
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard fade-in">
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: -1,
        }}
      >
        <div className="relative bg-white text-black min-h-screen">
          <BackgroundBeams />
        </div>
      </div>

      {/* Success overlay */}
      {saveSuccess && (
        <div className="save-success-overlay">
          <div className="save-success-content">
            <CheckCircle size={48} className="success-icon" />
            <h3>Perfil atualizado com sucesso!</h3>
          </div>
        </div>
      )}

      <main className="main-content fade-in-delayed">
        <div className="profile-page">
          {/* Header */}
          <div className="profile-header">
            <button onClick={goBack} className="back-button">
              <ArrowLeft size={20} />
            </button>
            <h1 className="page-title">
              {isOwnProfile ? "O Meu Perfil" : `Perfil de ${profileUser.name}`}
            </h1>
          </div>

          {/* Grid Layout */}
          <div className="profile-grid">
            {/* Left Column - Profile Card */}
            <div className="profile-card">
              {/* Profile Avatar Section */}
              <div className="profile-avatar-section">
                <div
                  style={{
                    position: "relative",
                    display: "inline-block",
                    cursor: canEdit ? "pointer" : "default",
                  }}
                  onClick={() => canEdit && setEditingImage(true)}
                >
                  <ProfileImage
                    src={
                      profileUser.profile_image
                        ? `${API_BASE_URL}/files/imagens-perfil/${profileUser.profile_image}`
                        : undefined
                    }
                    alt={profileUser.name}
                    size={120}
                  />
                  {canEdit && !editingImage && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0,
                        transition: "opacity 0.2s ease",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "0")
                      }
                    >
                      <Camera size={32} style={{ color: "white" }} />
                    </div>
                  )}
                </div>
                <h2 className="profile-name">{profileUser.name}</h2>
                <p className="profile-username">@{profileUser.username}</p>
                {profileUser.labels && profileUser.labels.length > 0 && (
                  <div className="profile-labels">
                    {profileUser.labels.map((label) => (
                      <span key={label} className="label-badge">
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="profile-quick-stats">
                <div className="stat-item">
                  <span className="stat-label">
                    <User size={14} />
                    Estado
                  </span>
                  <span
                    className={`stat-value status-${
                      profileUser.status || "offline"
                    }`}
                  >
                    {profileUser.status || "offline"}
                  </span>
                </div>
                {profileUser.contrato && (
                  <div className="stat-item">
                    <span className="stat-label">
                      <Briefcase size={14} />
                      Contrato
                    </span>
                    <span className="stat-value">{profileUser.contrato}</span>
                  </div>
                )}
                {profileUser.hrs !== undefined && (
                  <div className="stat-item">
                    <span className="stat-label">
                      <Clock size={14} />
                      Horas
                    </span>
                    <span className="stat-value">
                      {typeof profileUser.hrs === "number"
                        ? `${profileUser.hrs}h`
                        : "—"}
                    </span>
                  </div>
                )}
                <div className="stat-item">
                  <span className="stat-label">
                    <Calendar size={14} />
                    Férias
                  </span>
                  <span
                    className={`stat-value ${
                      profileUser.ferias ? "status-vacation" : "status-online"
                    }`}
                  >
                    {profileUser.ferias ? "De Férias" : "A Trabalhar"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column - Info Cards */}
            <div className="profile-info-grid">
              {/* Personal Information Card */}
              <div className="info-card">
                <div className="card-header">
                  <h3>
                    <User size={20} />
                    Informação Pessoal
                  </h3>
                  {!isEditing && canEdit && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="edit-button fade-in-edit"
                    >
                      Editar
                    </button>
                  )}
                </div>
                <div className="card-content">
                  {/* Name */}
                  <div className="info-field">
                    <label>
                      <User size={14} />
                      Nome
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Nome completo"
                        className="slide-in-edit"
                      />
                    ) : (
                      <p className="fade-in-edit">{profileUser.name || "—"}</p>
                    )}
                  </div>

                  {/* Username */}
                  <div className="info-field">
                    <label>
                      <User size={14} />
                      Nome de Utilizador
                    </label>
                    {isEditing ? (
                      <div
                        style={{ display: "flex", alignItems: "center" }}
                        className="slide-in-edit"
                      >
                        <span
                          style={{
                            background: "#f1f3f5",
                            border: "1px solid #e9ecef",
                            borderRadius: "8px 0 0 8px",
                            padding: "0.75rem 0.75rem",
                            fontSize: "clamp(0.875rem, 1.5vw, 1rem)",
                            color: "#6c757d",
                            fontWeight: 600,
                            borderRight: "none",
                            userSelect: "none",
                          }}
                        >
                          @
                        </span>
                        <input
                          type="text"
                          name="username"
                          value={formData.username}
                          onChange={(e) => {
                            // Prevent @ at the start
                            let val = e.target.value;
                            if (val.startsWith("@")) val = val.slice(1);
                            setFormData((prev) => ({ ...prev, username: val }));
                          }}
                          placeholder="Nome de utilizador"
                          style={{
                            borderRadius: "0 8px 8px 0",
                            borderLeft: "none",
                          }}
                          className="slide-in-edit"
                        />
                      </div>
                    ) : (
                      <p className="fade-in-edit">
                        @{profileUser.username || "—"}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="info-field">
                    <label>
                      <Mail size={14} />
                      Email
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="email@exemplo.com"
                        className="slide-in-edit"
                      />
                    ) : (
                      <p className="fade-in-edit">{profileUser.email || "—"}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="info-field">
                    <label>
                      <Phone size={14} />
                      Telefone
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        name="telefone"
                        value={formData.telefone}
                        onChange={handleInputChange}
                        placeholder="912345678"
                        className="slide-in-edit"
                      />
                    ) : (
                      <p className="fade-in-edit">
                        {profileUser.telefone || "—"}
                      </p>
                    )}
                  </div>

                  {/* NIF */}
                  <div className="info-field">
                    <label>
                      <CreditCard size={14} />
                      NIF
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="nif"
                        value={formData.nif}
                        onChange={handleInputChange}
                        placeholder="123456789"
                        maxLength={9}
                        className="slide-in-edit"
                      />
                    ) : (
                      <p className="fade-in-edit">{profileUser.nif || "—"}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Professional Information Card - Only visible if manager or has data */}
              {(isManager ||
                profileUser.contrato ||
                profileUser.hrs !== undefined) && (
                <div className="info-card manager-card">
                  <div className="card-header">
                    <h3>
                      <Building2 size={18} />
                      Informação Profissional
                    </h3>
                    {!canEditManagerFields && (
                      <span className="view-only">Apenas Visualização</span>
                    )}
                  </div>
                  <div className="card-content">
                    {/* Contract Type */}
                    <div className="info-field">
                      <label>
                        <Briefcase size={14} />
                        Tipo de Contrato
                      </label>
                      {isEditing && canEditManagerFields ? (
                        <input
                          type="text"
                          name="contrato"
                          value={formData.contrato}
                          onChange={handleInputChange}
                          placeholder="Ex: estagiário, efetivo, etc."
                          className="slide-in-edit"
                        />
                      ) : (
                        <p className="fade-in-edit">
                          {profileUser.contrato || "—"}
                        </p>
                      )}
                    </div>

                    {/* Hours Worked */}
                    <div className="info-field">
                      <label>
                        <Clock size={14} />
                        Horas Trabalhadas
                      </label>
                      {isEditing && canEditManagerFields ? (
                        <input
                          type="number"
                          name="hrs"
                          value={formData.hrs}
                          onChange={handleInputChange}
                          placeholder="0.0"
                          step="0.1"
                          className="slide-in-edit"
                        />
                      ) : (
                        <p className="fade-in-edit">
                          {profileUser.hrs ? `${profileUser.hrs}h` : "—"}
                        </p>
                      )}
                    </div>

                    {/* Vacation Status */}
                    <div className="info-field">
                      <label>
                        <Calendar size={14} />
                        Estado de Férias
                      </label>
                      {isEditing && canEditManagerFields ? (
                        <div className="checkbox-wrapper slide-in-edit">
                          <input
                            type="checkbox"
                            name="ferias"
                            checked={formData.ferias}
                            onChange={handleInputChange}
                            id="ferias-checkbox"
                          />
                          <label htmlFor="ferias-checkbox">Em férias</label>
                        </div>
                      ) : (
                        <p className="fade-in-edit">
                          {profileUser.ferias ? "De Férias" : "A Trabalhar"}
                        </p>
                      )}
                    </div>

                    {/* User Roles - Only for Managers */}
                    {canEditManagerFields && (
                      <div className="info-field">
                        <label>
                          <Tag size={14} />
                          Cargo
                        </label>
                        {isEditing ? (
                          <div className="labels-edit-wrapper slide-in-edit">
                            <div className="labels-checkboxes">
                              {[
                                { value: "manager", label: "Manager" },
                                {
                                  value: "Empregado de Mesa",
                                  label: "Empregado de Mesa",
                                },
                                { value: "chef", label: "chef" },
                                { value: "Limpeza", label: "Limpeza" },
                                {
                                  value: "Rececionista",
                                  label: "Rececionista",
                                },
                              ].map((role) => (
                                <div
                                  key={role.value}
                                  className="label-checkbox-item"
                                >
                                  <input
                                    type="checkbox"
                                    id={`role-${role.value}`}
                                    checked={formData.labels.includes(
                                      role.value
                                    )}
                                    onChange={(e) => {
                                      const newLabels = e.target.checked
                                        ? [...formData.labels, role.value]
                                        : formData.labels.filter(
                                            (l) => l !== role.value
                                          );
                                      setFormData((prev) => ({
                                        ...prev,
                                        labels: newLabels,
                                      }));
                                    }}
                                  />
                                  <label htmlFor={`role-${role.value}`}>
                                    {role.label}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="fade-in-edit">
                            {profileUser.labels &&
                            profileUser.labels.length > 0 ? (
                              <div className="labels-display">
                                {profileUser.labels.map((label) => (
                                  <span key={label} className="role-badge">
                                    {label}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p>Nenhuma função atribuída</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Account Information Card */}
              <div className="info-card">
                <div className="card-header">
                  <h3>
                    <Calendar size={20} />
                    Informação da Conta
                  </h3>
                </div>
                <div className="card-content">
                  <div className="info-field">
                    <label>
                      <Calendar size={14} />
                      Conta Criada
                    </label>
                    <p>
                      {profileUser.created_at
                        ? new Date(profileUser.created_at).toLocaleDateString(
                            "pt-PT",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Edit Actions at Bottom */}
              {canEdit && isEditing && (
                <div className="profile-actions">
                  <button
                    onClick={handleSave}
                    className="save-button"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      "A guardar..."
                    ) : (
                      <>
                        <Save size={16} />
                        Guardar
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="cancel-button"
                    disabled={isSaving}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Image Editing Modal */}
      {editingImage &&
        canEdit &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
            }}
            onClick={() => !uploadingImage && resetImage()}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                padding: "24px",
                maxWidth: "500px",
                width: "90%",
                maxHeight: "80vh",
                overflowY: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>
                  Editar Foto de Perfil
                </h2>
                <button
                  onClick={resetImage}
                  disabled={uploadingImage}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: uploadingImage ? "not-allowed" : "pointer",
                    padding: "4px",
                  }}
                >
                  <X size={24} />
                </button>
              </div>

              {/* Image Preview or Upload */}
              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "2px dashed #d1d5db",
                    borderRadius: "8px",
                    padding: "48px 32px",
                    textAlign: "center",
                    cursor: "pointer",
                    backgroundColor: "#f9fafb",
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
                    Selecionar Nova Imagem
                  </h4>
                  <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                    PNG, JPG ou WEBP até 5MB
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      position: "relative",
                      display: "inline-block",
                      marginBottom: "16px",
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
                        }}
                      >
                        <Wand2 size={12} />
                        Fundo Removido
                      </div>
                    )}
                  </div>

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
                        }}
                      >
                        <Wand2 size={16} />
                        {removingBackground
                          ? "A processar..."
                          : "Remover Fundo"}
                      </button>
                    ) : (
                      <button
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
                        }}
                      >
                        <RefreshCw size={16} />
                        Desfazer Remoção
                      </button>
                    )}
                    <button
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
                        cursor: removingBackground ? "not-allowed" : "pointer",
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

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "24px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={resetImage}
                  disabled={uploadingImage}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    backgroundColor: "white",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    cursor: uploadingImage ? "not-allowed" : "pointer",
                  }}
                >
                  Cancelar
                </button>
                {imagePreview && (
                  <button
                    onClick={uploadProfileImage}
                    disabled={uploadingImage}
                    style={{
                      padding: "8px 16px",
                      fontSize: "14px",
                      fontWeight: "500",
                      borderRadius: "6px",
                      border: "none",
                      cursor: uploadingImage ? "not-allowed" : "pointer",
                      backgroundColor: uploadingImage ? "#9ca3af" : "#3b82f6",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {uploadingImage ? (
                      "A carregar..."
                    ) : (
                      <>
                        <Save size={16} />
                        Guardar
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Image Cropper Modal */}
      {showCropper &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 101,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                padding: "24px",
                maxWidth: "800px",
                width: "90%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <h2
                    style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}
                  >
                    Recortar Imagem
                  </h2>
                  <p
                    style={{
                      margin: "4px 0 0 0",
                      fontSize: "14px",
                      color: "#6b7280",
                    }}
                  >
                    Ajuste a área de corte conforme necessário
                  </p>
                </div>
                <button
                  onClick={handleCropperClose}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                  }}
                >
                  <X size={24} />
                </button>
              </div>

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
                  src={cropImage || ""}
                  className="cropper"
                  stencilProps={{
                    handlers: true,
                    lines: true,
                    movable: true,
                    resizable: true,
                    aspectRatio: 1,
                  }}
                  backgroundWrapperProps={{
                    scaleImage: true,
                    moveImage: true,
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "24px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={handleCropperClose}
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
                  onClick={applyCrop}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    fontWeight: "500",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: "#3b82f6",
                    color: "white",
                  }}
                >
                  Aplicar Corte
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Toast Notification */}
      {toast &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: "24px",
              right: "24px",
              backgroundColor:
                toast.type === "success"
                  ? "#10b981"
                  : toast.type === "error"
                  ? "#ef4444"
                  : "#3b82f6",
              color: "white",
              padding: "16px 24px",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              zIndex: 999999,
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "14px",
              fontWeight: "500",
              animation: "slideInRight 0.3s ease-out",
            }}
          >
            {toast.type === "success" && <Check size={20} />}
            {toast.type === "error" && <X size={20} />}
            {toast.type === "info" && <RefreshCw size={20} />}
            <span>{toast.message}</span>
          </div>,
          document.body
        )}
    </div>
  );
}

// Main export
export default function ProfilePage({
  params,
}: {
  params: Promise<{ userId?: string[] }>;
}) {
  return <ProfilePageContent params={params} />;
}
