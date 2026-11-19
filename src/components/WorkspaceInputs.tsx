import React, { useRef, useState } from 'react';
import { Upload, X, Plus, Sparkles, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { ImageAsset } from '../types';
import { assetUrlToCompressedImage, fileToCompressedImage } from '../utils/image';
import { SAMPLE_INSPIRATIONS, SAMPLE_ROOMS, SampleRoomPreset } from '../constants/samples';

const INSTRUCTION_SNIPPETS = [
  'Behalte das graue Sofa und den Eichenboden',
  'Wände wärmer streichen, weniger Kitsch, mehr Tageslicht',
  'Günstige skandinavische Möbel und natürliche Textilien',
];

const REFINEMENT_SNIPPETS = [
  'Tausche den Couchtisch gegen etwas Rundes',
  'Behalte jetzt auch die Stehlampe',
  'Wände noch etwas ruhiger und heller halten',
];

interface WorkspaceInputsProps {
  originalRooms: ImageAsset[];
  roomDimensions: string;
  inspirations: ImageAsset[];
  keepAndAdjustText: string;
  refinementText: string;
  hasDrafts: boolean;
  currentDraftVersion: number | null;
  isGenerating: boolean;
  isRefining: boolean;
  onAddOriginalRooms: (assets: ImageAsset[]) => void;
  onRemoveOriginalRoom: (id: string) => void;
  onSetPrimaryRoom: (id: string) => void;
  onChangeRoomDimensions: (dimensions: string) => void;
  onAddInspirations: (assets: ImageAsset[]) => void;
  onRemoveInspiration: (id: string) => void;
  onChangeKeepAndAdjust: (text: string) => void;
  onChangeRefinementText: (text: string) => void;
  onGenerateDraft: () => void;
  onRefineDraft: () => void;
  onError: (msg: string) => void;
}

export const WorkspaceInputs: React.FC<WorkspaceInputsProps> = ({
  originalRooms,
  roomDimensions,
  inspirations,
  keepAndAdjustText,
  refinementText,
  hasDrafts,
  currentDraftVersion,
  isGenerating,
  isRefining,
  onAddOriginalRooms,
  onRemoveOriginalRoom,
  onSetPrimaryRoom,
  onChangeRoomDimensions,
  onAddInspirations,
  onRemoveInspiration,
  onChangeKeepAndAdjust,
  onChangeRefinementText,
  onGenerateDraft,
  onRefineDraft,
  onError,
}) => {
  const roomInputRef = useRef<HTMLInputElement>(null);
  const inspoInputRef = useRef<HTMLInputElement>(null);
  const [dragRoomOver, setDragRoomOver] = useState(false);
  const [dragInspoOver, setDragInspoOver] = useState(false);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);

  const busy = isGenerating || isRefining || loadingSample !== null;

  const handleRoomFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = Math.max(0, 4 - originalRooms.length);
    if (remainingSlots === 0) {
      onError('Sie können maximal 4 Fotos Ihres aktuellen Zimmers hochladen.');
      return;
    }

    const selected = Array.from(files).slice(0, remainingSlots);
    try {
      const loaded: ImageAsset[] = [];
      for (const file of selected) {
        const { dataUrl, aspectRatio } = await fileToCompressedImage(file);
        loaded.push({
          id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dataUrl,
          aspectRatio,
          name: file.name,
        });
      }
      onAddOriginalRooms(loaded);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Das Zimmerfoto konnte nicht gelesen werden.');
    }
  };

  const handleInspoFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = Math.max(0, 4 - inspirations.length);
    if (remainingSlots === 0) {
      onError('Sie können maximal 4 Inspirationsbilder gleichzeitig hinterlegen.');
      return;
    }

    const selected = Array.from(files).slice(0, remainingSlots);
    try {
      const loaded: ImageAsset[] = [];
      for (const file of selected) {
        const { dataUrl, aspectRatio } = await fileToCompressedImage(file);
        loaded.push({
          id: `inspo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dataUrl,
          aspectRatio,
          name: file.name,
        });
      }
      onAddInspirations(loaded);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : 'Ein Inspirationsbild konnte nicht verarbeitet werden.'
      );
    }
  };

  const handleLoadSampleRoom = async (sample: SampleRoomPreset) => {
    setLoadingSample(sample.id);
    try {
      const { dataUrl, aspectRatio } = await assetUrlToCompressedImage(sample.url);
      onAddOriginalRooms([
        {
          id: sample.id,
          dataUrl,
          aspectRatio,
          name: sample.name,
        },
      ]);
      const isDefaultSampleText = SAMPLE_ROOMS.some(
        (item) => item.defaultInstructions === keepAndAdjustText.trim()
      );
      if (!keepAndAdjustText.trim() || isDefaultSampleText) {
        onChangeKeepAndAdjust(sample.defaultInstructions);
      }
    } catch (err) {
      onError(
        err instanceof Error ? err.message : 'Das Beispielzimmer konnte nicht geladen werden.'
      );
    } finally {
      setLoadingSample(null);
    }
  };

  const handleLoadSampleInspo = async (url: string, label: string, key: string) => {
    if (inspirations.length >= 4) {
      onError('Maximal 4 Inspirationsbilder möglich. Entfernen Sie zunächst ein Bild.');
      return;
    }
    setLoadingSample(key);
    try {
      const { dataUrl, aspectRatio } = await assetUrlToCompressedImage(url);
      onAddInspirations([
        {
          id: `${key}-${Date.now()}`,
          dataUrl,
          aspectRatio,
          name: label,
        },
      ]);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : 'Das Inspirationsbild konnte nicht geladen werden.'
      );
    } finally {
      setLoadingSample(null);
    }
  };

  const appendSnippet = (current: string, snippet: string, setter: (v: string) => void) => {
    const trimmed = current.trim();
    if (!trimmed) {
      setter(snippet + '.');
      return;
    }
    if (trimmed.toLowerCase().includes(snippet.toLowerCase())) {
      return;
    }
    const separator = /[.!?]$/.test(trimmed) ? ' ' : '. ';
    setter(`${trimmed}${separator}${snippet}.`);
  };

  return (
    <aside
      id="arbeitsbereich"
      className="bg-white border border-[#E7E5E4] rounded-xl p-6 lg:p-7 flex flex-col gap-7"
    >
      {/* 01. Aktuelles Zimmer */}
      <section className="flex flex-col gap-3 pb-7 border-b border-[#E7E5E4]">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-lg font-medium text-[#18181B]">
            01. Aktuelles Zimmer
          </h2>
          <span className="text-xs text-[#71717A] font-mono tabular-nums whitespace-nowrap">
            {originalRooms.length} / 4
          </span>
        </div>

        <p className="text-xs text-[#71717A] leading-relaxed">
          Laden Sie 1 bis 4 Fotos Ihres Zimmers hoch. Jede Perspektive wird im exakten
          Originalwinkel und 1:1 Maßstab neu gestaltet.
        </p>

        <input
          ref={roomInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleRoomFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {originalRooms.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {originalRooms.map((room, idx) => (
              <div
                key={room.id}
                className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-[#F4F4F2] border border-[#E7E5E4]"
              >
                <img
                  src={room.dataUrl}
                  alt={room.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />

                {idx === 0 ? (
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-[#18181B]/90 text-[#FAF9F6] text-[11px] font-medium">
                    Hauptansicht
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetPrimaryRoom(room.id)}
                    disabled={busy}
                    className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-white/95 text-[#18181B] border border-[#E7E5E4] text-[11px] font-medium hover:bg-white transition-colors cursor-pointer"
                  >
                    Als Hauptansicht
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onRemoveOriginalRoom(room.id)}
                  disabled={busy}
                  aria-label={`${room.name} entfernen`}
                  className="absolute top-2 right-2 w-7 h-7 rounded-md bg-white/90 text-[#18181B] border border-[#E7E5E4] flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {originalRooms.length < 4 && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => roomInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                roomInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragRoomOver(true);
            }}
            onDragLeave={() => setDragRoomOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragRoomOver(false);
              handleRoomFiles(e.dataTransfer.files);
            }}
            className={`border border-dashed rounded-lg px-4 py-5 text-center transition-colors cursor-pointer ${
              dragRoomOver
                ? 'border-[#18181B] bg-[#F4F4F2]'
                : 'border-[#D4D4D8] hover:border-[#71717A] bg-[#FAF9F6]'
            }`}
          >
            <Upload className="w-4 h-4 mx-auto mb-2 text-[#52525B]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#18181B]">
              {originalRooms.length === 0
                ? 'Bis zu 4 Zimmerfotos hierher ziehen oder auswählen'
                : `Weitere Blickwinkel hinzufügen (${4 - originalRooms.length} frei)`}
            </p>
            <p className="text-[11px] text-[#71717A] mt-1">
              JPG, PNG oder WebP · Idealerweise bei Tageslicht aufgenommen
            </p>
          </div>
        )}

        {originalRooms.length === 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-xs text-[#71717A]">
              Oder mit einem von 4 Beispielzimmern testen:
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {SAMPLE_ROOMS.map((sample) => {
                const isThisLoading = loadingSample === sample.id;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleLoadSampleRoom(sample)}
                    disabled={busy}
                    className="group text-left rounded-lg border border-[#E7E5E4] bg-[#FAF9F6] hover:border-[#18181B] hover:bg-[#F4F4F2] overflow-hidden transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <div className="aspect-[4/3] w-full bg-[#F4F4F2] overflow-hidden">
                      <img
                        src={sample.url}
                        alt={sample.label}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                      />
                    </div>
                    <div className="px-2.5 py-1.5 text-xs font-medium text-[#18181B] truncate">
                      {isThisLoading ? 'Lädt …' : sample.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-1 flex flex-col gap-1.5">
          <label htmlFor="room-dimensions" className="text-xs text-[#52525B] font-medium">
            Raummaße (optional für 1:1 Maßstab)
          </label>
          <input
            id="room-dimensions"
            type="text"
            value={roomDimensions}
            onChange={(e) => onChangeRoomDimensions(e.target.value)}
            disabled={busy}
            placeholder="z. B. 4,2 × 3,5 × 2,8 m (Breite × Länge × Höhe)"
            className="w-full rounded-lg border border-[#D4D4D8] bg-[#FAF9F6] px-3 py-2 text-xs text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#18181B] focus:bg-white transition-colors"
          />
        </div>
      </section>

      {/* 02. Inspirationsbilder */}
      <section className="flex flex-col gap-3 pb-7 border-b border-[#E7E5E4]">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-lg font-medium text-[#18181B]">
            02. Inspirationsbilder
          </h2>
          <span className="text-xs text-[#71717A] font-mono tabular-nums whitespace-nowrap">
            {inspirations.length} / 4
          </span>
        </div>

        <input
          ref={inspoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleInspoFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {inspirations.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {inspirations.map((inspo) => (
              <div
                key={inspo.id}
                className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-[#F4F4F2] border border-[#E7E5E4]"
              >
                <img
                  src={inspo.dataUrl}
                  alt={inspo.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveInspiration(inspo.id)}
                  disabled={busy}
                  aria-label={`${inspo.name} entfernen`}
                  className="absolute top-2 right-2 w-7 h-7 rounded-md bg-white/90 text-[#18181B] border border-[#E7E5E4] flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {inspirations.length < 4 && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inspoInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inspoInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragInspoOver(true);
            }}
            onDragLeave={() => setDragInspoOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragInspoOver(false);
              handleInspoFiles(e.dataTransfer.files);
            }}
            className={`border border-dashed rounded-lg px-4 py-4 flex items-center justify-center gap-2.5 text-xs font-medium transition-colors cursor-pointer ${
              dragInspoOver
                ? 'border-[#18181B] bg-[#F4F4F2] text-[#18181B]'
                : 'border-[#D4D4D8] hover:border-[#71717A] bg-[#FAF9F6] text-[#3F3F46]'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-[#71717A]" aria-hidden="true" />
            <span>Stilvorlagen hinzufügen (ein oder mehrere Bilder)</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-[#71717A]">Beispiele:</span>
          {SAMPLE_INSPIRATIONS.map((inspo) => (
            <button
              key={inspo.id}
              type="button"
              onClick={() => handleLoadSampleInspo(inspo.url, inspo.label, inspo.id)}
              disabled={busy || inspirations.length >= 4}
              className="text-xs font-medium text-[#18181B] px-2.5 py-1 rounded-md border border-[#E7E5E4] bg-[#FAF9F6] hover:bg-[#F4F4F2] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
            >
              {loadingSample === inspo.id ? 'Lädt …' : `+ ${inspo.label}`}
            </button>
          ))}
        </div>
      </section>

      {/* 03. Anpassungen & Möbel behalten */}
      <section className={`flex flex-col gap-3 ${hasDrafts ? 'pb-7 border-b border-[#E7E5E4]' : ''}`}>
        <div className="flex items-baseline justify-between gap-4">
          <label
            htmlFor="keep-and-adjust"
            className="font-display text-lg font-medium text-[#18181B]"
          >
            03. Anpassungen & Möbel behalten
          </label>
        </div>

        <textarea
          id="keep-and-adjust"
          rows={4}
          value={keepAndAdjustText}
          onChange={(e) => onChangeKeepAndAdjust(e.target.value)}
          disabled={busy}
          placeholder="z. B. Behalte das graue Sofa und den Eichenboden. Mach die Wände wärmer, weniger Kitsch, mehr Licht."
          className="w-full rounded-lg border border-[#D4D4D8] bg-[#FAF9F6] px-3.5 py-3 text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#18181B] focus:bg-white transition-colors resize-y leading-relaxed"
        />

        <div className="flex flex-wrap gap-1.5">
          {INSTRUCTION_SNIPPETS.map((snippet) => (
            <button
              key={snippet}
              type="button"
              onClick={() => appendSnippet(keepAndAdjustText, snippet, onChangeKeepAndAdjust)}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs text-[#52525B] hover:text-[#18181B] px-2.5 py-1 rounded-md bg-[#F4F4F2] hover:bg-[#E7E5E4] transition-colors cursor-pointer text-left"
            >
              <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>{snippet}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onGenerateDraft}
          disabled={originalRooms.length === 0 || busy}
          className="mt-2 w-full py-3 px-5 rounded-lg bg-[#18181B] text-[#FAF9F6] text-sm font-medium hover:bg-[#27272A] disabled:opacity-40 disabled:pointer-events-none transition-colors inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span>
            {isGenerating
              ? 'Entwurf wird erstellt …'
              : hasDrafts
                ? 'Neuen Basisentwurf erstellen'
                : 'Entwurf erstellen'}
          </span>
        </button>
      </section>

      {/* 04. Iterative Verfeinerung */}
      {hasDrafts && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <label
              htmlFor="refine-input"
              className="font-display text-lg font-medium text-[#18181B]"
            >
              04. Entwurf verfeinern
            </label>
            <span className="text-xs font-mono tabular-nums text-[#71717A] whitespace-nowrap">
              Basis: v{currentDraftVersion}
            </span>
          </div>

          <textarea
            id="refine-input"
            rows={3}
            value={refinementText}
            onChange={(e) => onChangeRefinementText(e.target.value)}
            disabled={busy}
            placeholder="z. B. Tausche den Couchtisch gegen etwas Rundes oder behalte jetzt auch die Stehlampe."
            className="w-full rounded-lg border border-[#D4D4D8] bg-[#FAF9F6] px-3.5 py-3 text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#18181B] focus:bg-white transition-colors resize-y leading-relaxed"
          />

          <div className="flex flex-wrap gap-1.5">
            {REFINEMENT_SNIPPETS.map((snippet) => (
              <button
                key={snippet}
                type="button"
                onClick={() => appendSnippet(refinementText, snippet, onChangeRefinementText)}
                disabled={busy}
                className="inline-flex items-center gap-1 text-xs text-[#52525B] hover:text-[#18181B] px-2.5 py-1 rounded-md bg-[#F4F4F2] hover:bg-[#E7E5E4] transition-colors cursor-pointer text-left"
              >
                <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>{snippet}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onRefineDraft}
            disabled={!refinementText.trim() || busy}
            className="mt-1 w-full py-2.5 px-5 rounded-lg bg-white text-[#18181B] border border-[#18181B] text-sm font-medium hover:bg-[#F4F4F2] disabled:opacity-40 disabled:pointer-events-none transition-colors inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <span>{isRefining ? 'Entwurf wird angepasst …' : 'Entwurf anpassen'}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </section>
      )}
    </aside>
  );
};
