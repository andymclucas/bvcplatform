import { useEffect, useRef, useState } from "react";
import BVCLayout from "@/components/BVCLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Upload, Trash2, Play, Lock, Music, Calendar, Clock } from "lucide-react";
import { trpc as trpcUtils } from "@/lib/trpc";

type Recording = {
  id: number;
  sessionId: number;
  title: string;
  description?: string | null;
  fileUrl: string;
  durationSeconds?: number | null;
  createdAt: Date;
  sessionTitle?: string | null;
  sessionDate?: Date | null;
  fileKey?: string;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "Unknown date";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Upload Dialog ─────────────────────────────────────────────────────────────

function UploadDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: sessions } = trpc.sessions.list.useQuery();
  const [sessionId, setSessionId] = useState<string>("");
  const [customSessionTitle, setCustomSessionTitle] = useState("");
  const [customSessionDate, setCustomSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpcUtils.useUtils();

  const usingCustomSession = sessionId === "__custom__";
  const sessionReady = usingCustomSession
    ? Boolean(customSessionTitle.trim() && customSessionDate)
    : Boolean(sessionId);

  useEffect(() => {
    if (!uploading) return;
    const preventAccidentalExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventAccidentalExit);
    return () => window.removeEventListener("beforeunload", preventAccidentalExit);
  }, [uploading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !sessionReady || !title.trim()) {
      toast.error("Please select or enter a rehearsal session, add a title, and choose a file.");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setUploadError("");
    setUploadStatus("Preparing your recording for secure upload…");
    try {
      const readResponse = async (response: Response) => {
        const text = await response.text();
        let payload: Record<string, unknown> = {};
        try {
          payload = text ? JSON.parse(text) as Record<string, unknown> : {};
        } catch {
          throw new Error(`The upload service returned an invalid response (status ${response.status}).`);
        }
        if (!response.ok) {
          const detail = typeof payload.detail === "string" ? ` ${payload.detail}` : "";
          const reference = typeof payload.reference === "string" ? ` Reference: ${payload.reference}.` : "";
          throw new Error(`${typeof payload.error === "string" ? payload.error : "The recording upload failed."}${detail}${reference}`);
        }
        return payload;
      };
      const chunkSize = 2 * 1024 * 1024;
      const totalChunks = Math.ceil(file.size / chunkSize);
      const initResponse = await fetch("/api/upload/recording/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          totalChunks,
          sessionId: usingCustomSession ? undefined : Number(sessionId),
          customSessionTitle: usingCustomSession ? customSessionTitle.trim() : undefined,
          customSessionDate: usingCustomSession ? customSessionDate : undefined,
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      });
      const initialised = await readResponse(initResponse);
      const uploadId = typeof initialised.uploadId === "string" ? initialised.uploadId : "";
      if (!uploadId) throw new Error("The recording upload could not be prepared. Please try again.");

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        setUploadStatus(`Uploading part ${chunkIndex + 1} of ${totalChunks} securely…`);
        const chunk = file.slice(chunkIndex * chunkSize, Math.min(file.size, (chunkIndex + 1) * chunkSize));
        const chunkData = new FormData();
        chunkData.append("uploadId", uploadId);
        chunkData.append("chunkIndex", String(chunkIndex));
        chunkData.append("chunk", chunk, `${file.name}.part${chunkIndex + 1}`);
        const chunkResponse = await fetch("/api/upload/recording/chunk", { method: "POST", body: chunkData });
        await readResponse(chunkResponse);
        setUploadProgress(Math.max(1, Math.round(((chunkIndex + 1) / totalChunks) * 90)));
      }

      setUploadProgress(95);
      setUploadStatus("All parts received. Saving the recording securely…");
      const completeResponse = await fetch("/api/upload/recording/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });
      const completed = await readResponse(completeResponse) as { recording?: { id?: number; fileUrl?: string } };
      const savedRecordingId = completed.recording?.id;
      if (!savedRecordingId || !completed.recording?.fileUrl) {
        throw new Error("The recording was uploaded but its saved record could not be confirmed.");
      }
      setUploadProgress(100);
      setUploadStatus("Recording saved. Refreshing your recordings…");

      const refreshedRecordings = await utils.recordings.list.fetch();
      if (!refreshedRecordings.some((recording) => recording.id === savedRecordingId)) {
        throw new Error("The recording could not be confirmed in the recordings list. It has not been marked as uploaded.");
      }
      toast.success("Recording uploaded successfully.");
      onSuccess();
      onClose();
      setSessionId("");
      setCustomSessionTitle("");
      setTitle("");
      setDescription("");
      setFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Recording upload failed. Please try again.";
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !uploading && onClose()}>
      <DialogContent
        className="max-w-lg"
        showCloseButton={!uploading}
        onPointerDownOutside={(event) => uploading && event.preventDefault()}
        onEscapeKeyDown={(event) => uploading && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Upload Rehearsal Recording</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <fieldset disabled={uploading} className="space-y-4 disabled:opacity-60">
          <div className="space-y-1">
            <Label htmlFor="rec-session">Rehearsal Session *</Label>
            <Select value={sessionId} onValueChange={setSessionId} disabled={uploading}>
              <SelectTrigger id="rec-session">
                <SelectValue placeholder="Select a session..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom__">Enter a custom rehearsal session…</SelectItem>
                {sessions?.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.title} — {formatDate(s.sessionDate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only members marked as attended for this session will be able to access the recording.
            </p>
          </div>

          {usingCustomSession && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-3 dark:bg-amber-950/20">
              <div>
                <p className="text-sm font-medium text-foreground">Custom rehearsal session</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This creates a session for this recording when no related rehearsal appears above.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="custom-rec-session">Session name *</Label>
                <Input
                  id="custom-rec-session"
                  value={customSessionTitle}
                  onChange={(e) => setCustomSessionTitle(e.target.value)}
                  placeholder="e.g. Orchestra Rehearsal — 27 August"
                  maxLength={255}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="custom-rec-date">Session date *</Label>
                <Input
                  id="custom-rec-date"
                  type="date"
                  value={customSessionDate}
                  onChange={(e) => setCustomSessionDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="rec-title">Title *</Label>
            <Input
              id="rec-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tuesday Night Rehearsal — Full Run"
              maxLength={255}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="rec-desc">Description (optional)</Label>
            <Textarea
              id="rec-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any notes about this recording..."
              rows={2}
            />
          </div>

          <div className="space-y-1">
            <Label>Audio / Video File *</Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => !uploading && fileRef.current?.click()}
            >
              {file ? (
                <p className="text-sm font-medium text-foreground">{file.name}</p>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to select a file (mp3, m4a, wav, mp4, webm)
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg,video/mp4,video/webm,.mp3,.m4a,.wav,.mp4,.webm,.ogg"
              disabled={uploading}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          </fieldset>

          {uploading && (
            <div
              className="rounded-lg border p-3 space-y-2"
              style={{ borderColor: "oklch(0.68 0.10 185)", background: "oklch(0.96 0.025 185)" }}
              aria-live="polite"
            >
              <div className="flex items-center justify-between gap-3 text-sm font-medium" style={{ color: "oklch(0.30 0.10 185)" }}>
                <span>{uploadStatus}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "oklch(0.88 0.03 185)" }}>
                <div
                  className="h-full rounded-full transition-[width] duration-200"
                  style={{ width: `${uploadProgress}%`, background: "oklch(0.55 0.14 185)" }}
                />
              </div>
              <p className="text-xs" style={{ color: "oklch(0.42 0.06 185)" }}>
                Please keep this window open. Closing, navigating away, or cancelling is disabled until the upload finishes.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={uploading}>
              {uploading ? "Upload in progress" : "Cancel"}
            </Button>
            <Button type="submit" disabled={uploading || !file || !sessionReady || !title.trim()}>
              {uploading ? `Uploading ${uploadProgress}%` : "Upload Recording"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Recording Card ────────────────────────────────────────────────────────────

function RecordingCard({
  recording,
  isAdmin,
  onDelete,
}: {
  recording: Recording;
  isAdmin: boolean;
  onDelete: (id: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const isAudio =
    !recording.fileUrl.match(/\.(mp4|webm|mov)$/i);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex items-start gap-4 p-4">
          {/* Icon / Play button */}
          <button
            onClick={togglePlay}
            className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
            title={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <span className="w-3 h-3 border-l-2 border-r-2 border-primary" />
            ) : (
              <Play className="h-5 w-5 text-primary ml-0.5" />
            )}
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{recording.title}</p>
                {recording.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                    {recording.description}
                  </p>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={() => onDelete(recording.id)}
                  className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete recording"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Media player */}
            {isAudio ? (
              <audio
                ref={audioRef}
                src={recording.fileUrl}
                className="w-full mt-2"
                controls
                onEnded={() => setPlaying(false)}
              />
            ) : (
              <video
                ref={audioRef as React.RefObject<HTMLVideoElement>}
                src={recording.fileUrl}
                className="w-full mt-2 rounded"
                controls
                onEnded={() => setPlaying(false)}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Metadata badges ───────────────────────────────────────────────────────────

function RecordingMeta({ recording }: { recording: Recording }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {recording.sessionTitle && (
        <Badge variant="secondary" className="text-xs gap-1">
          <Music className="h-3 w-3" />
          {recording.sessionTitle}
        </Badge>
      )}
      {recording.sessionDate && (
        <Badge variant="outline" className="text-xs gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(recording.sessionDate)}
        </Badge>
      )}
      {recording.durationSeconds != null && (
        <Badge variant="outline" className="text-xs gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(recording.durationSeconds)}
        </Badge>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpcUtils.useUtils();

  const { data: recordings, isLoading } = trpc.recordings.list.useQuery();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const deleteMutation = trpc.recordings.delete.useMutation({
    onSuccess: () => {
      utils.recordings.list.invalidate();
      toast.success("Recording deleted.");
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to delete recording.");
      setDeleteTarget(null);
    },
  });

  const handleDelete = async () => {
    if (deleteTarget == null) return;
    setDeleteLoading(true);
    try {
      await deleteMutation.mutateAsync({ id: deleteTarget });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <BVCLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Rehearsal Recordings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Listen to past rehearsal recordings.
              {!isAdmin && " Only sessions you attended are shown."}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setUploadOpen(true)} className="flex-shrink-0 gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : !recordings || recordings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Music className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">No recordings yet</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isAdmin
                    ? "Upload the first rehearsal recording using the button above."
                    : "Recordings from your attended sessions will appear here."}
                </p>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)} className="gap-2 mt-1">
                  <Upload className="h-4 w-4" />
                  Upload Recording
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {recordings.map((recording) => (
              <div key={recording.id} className="space-y-1">
                <RecordingMeta recording={recording} />
                <RecordingCard
                  recording={recording}
                  isAdmin={isAdmin}
                  onDelete={(id) => setDeleteTarget(id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload dialog */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => utils.recordings.list.invalidate()}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && !deleteLoading && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recording?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the recording and its audio/video file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "Deleting…" : "Delete Recording"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BVCLayout>
  );
}
