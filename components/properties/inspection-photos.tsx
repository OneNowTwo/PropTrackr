"use client";

import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import type { InspectionPhoto } from "@/app/actions/inspection-photos";
import {
  deletePhoto,
  updatePhotoCaption,
} from "@/app/actions/inspection-photos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

function Lightbox({
  photos,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  photos: InspectionPhoto[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
      >
        <X className="h-5 w-5" />
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-4 z-10 rounded-full bg-black/50 p-2.5 text-white transition-colors hover:bg-black/70"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-4 z-10 rounded-full bg-black/50 p-2.5 text-white transition-colors hover:bg-black/70"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div
        className="flex max-h-[90vh] max-w-[90vw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption || "Inspection photo"}
          className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
        />
        <div className="mt-3 flex items-center gap-3 text-sm text-white/80">
          {photo.caption && (
            <span className="max-w-md truncate">{photo.caption}</span>
          )}
          <span>
            {index + 1} / {photos.length}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Photo card
// ---------------------------------------------------------------------------

function PhotoCard({
  photo,
  onView,
  onRemove,
}: {
  photo: InspectionPhoto;
  onView: () => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const saveCaption = useCallback(() => {
    setEditing(false);
    if (caption !== (photo.caption ?? "")) {
      startTransition(async () => {
        await updatePhotoCaption(photo.id, caption);
      });
    }
  }, [caption, photo.caption, photo.id]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <button
        type="button"
        onClick={onView}
        className="block w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption || "Inspection photo"}
          className="aspect-square w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </button>

      <button
        type="button"
        onClick={() => onRemove(photo.id)}
        className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <div className="px-3 py-2">
        {editing ? (
          <input
            ref={inputRef}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={saveCaption}
            onKeyDown={(e) => { if (e.key === "Enter") saveCaption(); }}
            placeholder="Add a caption…"
            className="w-full border-b border-[#0D9488] bg-transparent text-base text-[#111827] outline-none placeholder:text-[#9CA3AF] md:text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex w-full items-center gap-1 text-left text-xs text-[#6B7280] hover:text-[#111827]"
          >
            <span className="min-w-0 flex-1 truncate">
              {isPending ? "Saving…" : photo.caption || "Add caption…"}
            </span>
            <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload zone
// ---------------------------------------------------------------------------

function UploadZone({
  propertyId,
  onUploaded,
}: {
  propertyId: string;
  onUploaded: (photo: InspectionPhoto) => void;
}) {
  const [uploading, setUploading] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const batch = Array.from(files).slice(0, 10);
      setUploading((c) => c + batch.length);

      for (const file of batch) {
        try {
          const base64 = await resizeImage(file);
          const res = await fetch("/api/photos/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ propertyId, base64Image: base64 }),
          });
          const data = await res.json();
          if (data.ok) {
            onUploaded({
              id: data.photoId,
              propertyId,
              url: data.url,
              caption: null,
              takenAt: new Date(),
              createdAt: new Date(),
            });
          }
        } catch (e) {
          console.error("[inspection-photos] upload error:", e);
        } finally {
          setUploading((c) => c - 1);
        }
      }
    },
    [propertyId, onUploaded],
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] shadow-sm transition-colors hover:border-[#0D9488] hover:bg-[#F9FAFB]"
        >
          <Upload className="h-4 w-4 text-[#0D9488]" />
          Upload Photos
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0D9488]/90"
        >
          <Camera className="h-4 w-4" />
          Take Photo
        </button>
      </div>

      {uploading > 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#0D9488] bg-[#0D9488]/5 p-6">
          <Loader2 className="h-6 w-6 animate-spin text-[#0D9488]" />
          <p className="text-sm font-medium text-[#374151]">
            Uploading {uploading} {uploading === 1 ? "photo" : "photos"}…
          </p>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#0D9488]", "bg-[#0D9488]/5"); }}
          onDragLeave={(e) => { e.currentTarget.classList.remove("border-[#0D9488]", "bg-[#0D9488]/5"); }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("border-[#0D9488]", "bg-[#0D9488]/5");
            processFiles(e.dataTransfer.files);
          }}
          className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-[#D1D5DB] px-6 py-4 text-center transition-colors"
        >
          <p className="text-xs text-[#9CA3AF]">or drag and drop images here · PNG, JPG, HEIC up to 10 files</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { processFiles(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { processFiles(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}

function resizeImage(file: File, maxDim = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("No canvas context")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function InspectionPhotosSection({
  propertyId,
  initialPhotos,
}: {
  propertyId: string;
  initialPhotos: InspectionPhoto[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const handleUploaded = useCallback((photo: InspectionPhoto) => {
    setPhotos((prev) => [photo, ...prev]);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    startTransition(async () => {
      await deletePhoto(id);
    });
  }, []);

  const openLightbox = useCallback((idx: number) => setLightboxIdx(idx), []);
  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const prevPhoto = useCallback(
    () => setLightboxIdx((i) => (i !== null ? (i - 1 + photos.length) % photos.length : null)),
    [photos.length],
  );
  const nextPhoto = useCallback(
    () => setLightboxIdx((i) => (i !== null ? (i + 1) % photos.length : null)),
    [photos.length],
  );

  return (
    <>
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
            <Camera className="h-4 w-4" />
          </span>
          <CardTitle className="text-base text-[#111827]">
            Inspection Photos
          </CardTitle>
          {photos.length > 0 && (
            <span className="ml-auto text-xs text-[#9CA3AF]">
              {photos.length} {photos.length === 1 ? "photo" : "photos"}
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <UploadZone propertyId={propertyId} onUploaded={handleUploaded} />

          {photos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Camera className="h-10 w-10 text-[#D1D5DB]" />
              <p className="text-sm text-[#6B7280]">
                No inspection photos yet.
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Add photos during or after your inspection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo, i) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onView={() => openLightbox(i)}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIdx}
          onClose={closeLightbox}
          onPrev={prevPhoto}
          onNext={nextPhoto}
        />
      )}
    </>
  );
}
