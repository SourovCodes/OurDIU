import { AVATAR_CONTENT_TYPES } from "@ourdiu/shared/constants";
import { Upload, ZoomIn, ZoomOut } from "lucide-react";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { formatBytes } from "~/lib/format";
import {
  cropToFile,
  MAX_AVATAR_SOURCE_BYTES,
  type CropArea,
} from "~/lib/image-crop";

// Only needed once someone picks a photo, so it stays out of the initial bundle.
const Cropper = lazy(() => import("react-easy-crop"));

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const CENTER = { x: 0, y: 0 };

type Source = { file: File; url: string };

type AvatarInputProps = {
  /** Form field name for the cropped image. */
  name: string;
  label: string;
  /** Receives the cropped square, or null when the choice is undone. */
  onChange: (file: File | null) => void;
};

/**
 * Picks a photo and crops it to a square before it reaches the form. The real file
 * input stays in the form, holding the cropped image rather than what was picked.
 */
export function AvatarInput({ name, label, onChange }: AvatarInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crop, setCrop] = useState(CENTER);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [area, setArea] = useState<CropArea | null>(null);
  const [cropping, setCropping] = useState(false);
  const zoomId = useId();
  const errorId = useId();

  // Free the source preview's object URL once the cropper is done with it.
  useEffect(() => {
    if (!source) return;
    return () => URL.revokeObjectURL(source.url);
  }, [source]);

  function openCropper(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      clearInput();
      setError(
        `Choose an image under ${formatBytes(MAX_AVATAR_SOURCE_BYTES)}.`,
      );
      return;
    }
    setError(null);
    setCrop(CENTER);
    setZoom(MIN_ZOOM);
    setArea(null);
    setSource({ file, url: URL.createObjectURL(file) });
  }

  /** Empties the field so a cancelled or failed crop can't be submitted. */
  function clearInput() {
    if (inputRef.current) inputRef.current.value = "";
    onChange(null);
  }

  function closeCropper() {
    setSource(null);
    setCropping(false);
  }

  async function applyCrop() {
    if (!source || !area) return;
    setCropping(true);
    try {
      const cropped = await cropToFile(source.url, area, source.file.name);
      // The form submits the cropped square, not the picked file.
      const transfer = new DataTransfer();
      transfer.items.add(cropped);
      if (inputRef.current) inputRef.current.files = transfer.files;
      onChange(cropped);
      closeCropper();
    } catch {
      setError("That image couldn’t be cropped. Try another one.");
      clearInput();
      closeCropper();
    }
  }

  return (
    <>
      <label
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className:
            "cursor-pointer has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
        })}
      >
        <Upload aria-hidden />
        {label}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={AVATAR_CONTENT_TYPES.join(",")}
          required
          aria-describedby={error ? errorId : undefined}
          className="sr-only"
          onChange={(event) => openCropper(event.target.files?.[0])}
        />
      </label>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Dialog
        open={source !== null}
        onOpenChange={(open) => {
          if (open) return;
          clearInput();
          closeCropper();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crop your photo</DialogTitle>
            <DialogDescription>
              Drag to reposition and zoom. Only what’s inside the circle is
              saved.
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
            {source && (
              <Suspense fallback={<Skeleton className="size-full" />}>
                <Cropper
                  image={source.url}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  minZoom={MIN_ZOOM}
                  maxZoom={MAX_ZOOM}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, pixels) => setArea(pixels)}
                />
              </Suspense>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor={zoomId} className="sr-only">
              Zoom
            </label>
            <ZoomOut
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <input
              id={zoomId}
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer accent-primary"
            />
            <ZoomIn
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearInput();
                closeCropper();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={applyCrop}
              disabled={!area || cropping}
            >
              {cropping ? "Cropping…" : "Use photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
