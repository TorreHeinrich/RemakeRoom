import React from 'react';
import { Check, Loader2, RefreshCw, ShoppingBag, AlertCircle } from 'lucide-react';
import { ImageAsset, RoomDraft } from '../types';

interface DesignStageProps {
  originalRooms: ImageAsset[];
  activeAngleIndex: number;
  drafts: RoomDraft[];
  activeDraftIndex: number;
  comparisonMode: 'after' | 'before';
  approvedVersion: number | null;
  isGenerating: boolean;
  isRefining: boolean;
  isGeneratingList: boolean;
  onSelectAngle: (index: number) => void;
  onSelectDraft: (index: number) => void;
  onToggleComparison: (mode: 'after' | 'before') => void;
  onApproveDraft: () => void;
  onRetryDraft: () => void;
  onQuickStartSample: () => void;
}

export const DesignStage: React.FC<DesignStageProps> = ({
  originalRooms,
  activeAngleIndex,
  drafts,
  activeDraftIndex,
  comparisonMode,
  approvedVersion,
  isGenerating,
  isRefining,
  isGeneratingList,
  onSelectAngle,
  onSelectDraft,
  onToggleComparison,
  onApproveDraft,
  onRetryDraft,
  onQuickStartSample,
}) => {
  const activeDraft = drafts[activeDraftIndex] ?? null;
  const safeAngleIndex =
    originalRooms.length > 0 ? Math.min(activeAngleIndex, originalRooms.length - 1) : 0;
  const activeOriginalRoom = originalRooms[safeAngleIndex] ?? null;

  const getAngleResultUrl = (draft: RoomDraft | null, idx: number): string | null => {
    if (!draft) return null;
    if (Array.isArray(draft.angleImages) && draft.angleImages[idx]) {
      return draft.angleImages[idx].imageDataUrl;
    }
    return idx === 0 ? draft.imageDataUrl : null;
  };

  const activeGeneratedUrl = getAngleResultUrl(activeDraft, safeAngleIndex);
  const isBusy = isGenerating || isRefining;
  const isApprovedActive = activeDraft !== null && approvedVersion === activeDraft.version;

  const displayImageUrl = (() => {
    if (!activeOriginalRoom) return null;
    if (!activeDraft) return activeOriginalRoom.dataUrl;
    if (comparisonMode === 'before') return activeOriginalRoom.dataUrl;
    return activeGeneratedUrl;
  })();

  const angleLabel = (idx: number) => (idx === 0 ? 'Hauptansicht' : `Blickwinkel ${idx + 1}`);

  const formattedTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <section
      id="entwurf"
      className="bg-white border border-[#E7E5E4] rounded-xl p-6 lg:p-8 flex flex-col gap-6"
    >
      {/* Kopfzeile der Studio-Bühne */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E7E5E4]">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl font-medium text-[#18181B]">
            {activeDraft
              ? `Entwurf v${activeDraft.version}`
              : activeOriginalRoom
                ? `Ausgangszustand (${angleLabel(safeAngleIndex)})`
                : 'Raumvorschau'}
          </h2>

          {activeDraft ? (
            <div className="flex items-center gap-2 text-xs text-[#71717A]">
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{formattedTime(activeDraft.createdAt)}</span>
              {originalRooms.length > 1 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{originalRooms.length} Perspektiven (1:1 Originalwinkel)</span>
                </>
              )}
              {isApprovedActive && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#18181B] font-medium">Freigegeben</span>
                </>
              )}
            </div>
          ) : (
            originalRooms.length > 1 && (
              <div className="flex items-center gap-2 text-xs text-[#71717A]">
                <span aria-hidden="true">·</span>
                <span>{originalRooms.length} Perspektiven für 1:1 Raummaße erfasst</span>
              </div>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Versionsleiste */}
          {drafts.length > 1 && (
            <div
              role="group"
              aria-label="Entwurfsversionen"
              className="flex items-center gap-1 p-1 bg-[#F4F4F2] rounded-lg"
            >
              {drafts.map((draft, idx) => (
                <button
                  key={draft.version}
                  type="button"
                  onClick={() => onSelectDraft(idx)}
                  disabled={isBusy}
                  className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    idx === activeDraftIndex
                      ? 'bg-white text-[#18181B] font-medium border border-[#E7E5E4]'
                      : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  v{draft.version}
                </button>
              ))}
            </div>
          )}

          {/* Einfacher Vorher / Nachher Umschalter */}
          {activeDraft && activeOriginalRoom && (
            <div
              role="group"
              aria-label="Vorher-Nachher-Vergleich"
              className="flex items-center gap-1 p-1 bg-[#F4F4F2] rounded-lg"
            >
              <button
                type="button"
                onClick={() => onToggleComparison('before')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  comparisonMode === 'before'
                    ? 'bg-[#18181B] text-[#FAF9F6]'
                    : 'text-[#52525B] hover:text-[#18181B]'
                }`}
              >
                Vorher
              </button>
              <button
                type="button"
                onClick={() => onToggleComparison('after')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  comparisonMode === 'after'
                    ? 'bg-[#18181B] text-[#FAF9F6]'
                    : 'text-[#52525B] hover:text-[#18181B]'
                }`}
              >
                Nachher
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Perspektiven-Auswahl bei mehreren Originalfotos */}
      {originalRooms.length > 1 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-xs text-[#71717A]">
            <span>Perspektive wählen (Originalwinkel bleibt 1:1 erhalten)</span>
            <span className="font-mono tabular-nums">
              {safeAngleIndex + 1} / {originalRooms.length}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {originalRooms.map((room, idx) => {
              const draftThumb =
                activeDraft && comparisonMode === 'after'
                  ? getAngleResultUrl(activeDraft, idx) ?? room.dataUrl
                  : room.dataUrl;
              const isSelected = idx === safeAngleIndex;

              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onSelectAngle(idx)}
                  disabled={isBusy}
                  className={`text-left rounded-lg border overflow-hidden transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#18181B] bg-[#F4F4F2]'
                      : 'border-[#E7E5E4] bg-[#FAF9F6] hover:border-[#A1A1AA]'
                  }`}
                >
                  <div className="aspect-[4/3] w-full bg-[#F4F4F2] overflow-hidden">
                    <img
                      src={draftThumb}
                      alt={angleLabel(idx)}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="px-2.5 py-1.5 text-[11px] font-medium text-[#18181B] truncate">
                    {angleLabel(idx)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Haupt-Visualisierungsrahmen im exakten Originalformat (ohne Zuschnitt) */}
      <div className="relative w-full min-h-[360px] max-h-[640px] aspect-[4/3] rounded-xl overflow-hidden bg-[#F4F4F2] border border-[#E7E5E4] flex items-center justify-center">
        {!activeOriginalRoom ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
            <p className="font-display text-2xl text-[#18181B] max-w-md">
              Ihr Zimmer im neuen Licht
            </p>
            <p className="text-sm text-[#52525B] mt-2.5 max-w-md leading-relaxed">
              Laden Sie links 1 bis 4 Fotos Ihres aktuellen Raums sowie Inspirationsbilder hoch.
              Alle Perspektiven werden im exakten Originalwinkel neu gestaltet.
            </p>
            <button
              type="button"
              onClick={onQuickStartSample}
              className="mt-6 px-5 py-2.5 rounded-lg bg-[#18181B] text-[#FAF9F6] text-xs font-medium hover:bg-[#27272A] transition-colors cursor-pointer whitespace-nowrap"
            >
              Mit Beispielzimmer starten
            </button>
          </div>
        ) : activeDraft && comparisonMode === 'after' && !activeGeneratedUrl ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-[#FAF9F6]">
            <AlertCircle className="w-6 h-6 text-[#52525B] mb-3" aria-hidden="true" />
            <p className="font-display text-lg text-[#18181B]">
              {activeDraft.fallbackOnly
                ? 'Bildausgabe derzeit nicht verfügbar'
                : `Für ${angleLabel(safeAngleIndex)} konnte kein Bild generiert werden`}
            </p>
            <p className="text-sm text-[#52525B] mt-2 max-w-md leading-relaxed">
              Das schriftliche Raumkonzept wurde unten erstellt. Sie können den Entwurf jederzeit
              erneut generieren oder bereits eine Einkaufsliste ableiten.
            </p>
            <button
              type="button"
              onClick={onRetryDraft}
              disabled={isBusy}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#18181B] text-[#FAF9F6] text-xs font-medium hover:bg-[#27272A] transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Bildgenerierung erneut versuchen</span>
            </button>
          </div>
        ) : displayImageUrl ? (
          <img
            key={`${activeDraft?.version ?? 'orig'}-${safeAngleIndex}-${comparisonMode}`}
            src={displayImageUrl}
            alt={
              activeDraft && comparisonMode === 'after'
                ? `Raumentwurf Version ${activeDraft.version} – ${angleLabel(safeAngleIndex)}`
                : `Originalzimmer – ${angleLabel(safeAngleIndex)}`
            }
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain transition-opacity duration-200"
          />
        ) : null}

        {/* Ruhiger Status-Hinweis links unten im Bild */}
        {activeOriginalRoom && !isBusy && (displayImageUrl || activeDraft) && (
          <div className="pointer-events-none absolute bottom-3 left-3 px-3 py-1.5 rounded-md bg-white/90 backdrop-blur-xs border border-[#E7E5E4] text-xs font-medium text-[#18181B]">
            {!activeDraft
              ? `Ist-Zustand · ${angleLabel(safeAngleIndex)}`
              : comparisonMode === 'before'
                ? `Vorher · ${angleLabel(safeAngleIndex)}`
                : `Nachher · v${activeDraft.version} (${angleLabel(safeAngleIndex)})`}
          </div>
        )}

        {/* Ladezustand */}
        {isBusy && (
          <div className="absolute inset-0 bg-[#FAF9F6]/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="w-6 h-6 text-[#18181B] animate-spin mb-3" aria-hidden="true" />
            <p className="font-display text-lg text-[#18181B]">
              {isRefining
                ? originalRooms.length > 1
                  ? `Entwurf wird für ${originalRooms.length} Perspektiven verfeinert …`
                  : 'Entwurf wird gezielt verfeinert …'
                : originalRooms.length > 1
                  ? `Entwurf wird für ${originalRooms.length} Originalperspektiven erstellt …`
                  : 'Neuer Raumentwurf wird erstellt …'}
            </p>
            <p className="text-xs text-[#52525B] mt-1.5 max-w-sm">
              Kamerawinkel, 1:1 Raummaße und gewünschte Bestandsmöbel bleiben exakt erhalten.
              Dies dauert je nach Anzahl der Perspektiven 15–30 Sekunden.
            </p>
          </div>
        )}
      </div>

      {/* Änderungsnotizen & Freigabe-Aktion */}
      {activeDraft && (
        <div className="flex flex-col gap-5 pt-2">
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#71717A]">
              Änderungsnotizen zu Entwurf v{activeDraft.version}
            </h3>
            <p className="text-sm text-[#18181B] leading-relaxed">{activeDraft.changeSummary}</p>

            {activeDraft.designNotes.length > 0 && (
              <ul className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-[#52525B]">
                {activeDraft.designNotes.map((note, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#18181B] select-none" aria-hidden="true">
                      —
                    </span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            )}

            {activeDraft.refinementPrompt && (
              <p className="text-xs text-[#71717A] pt-1">
                Basis-Anpassung: „{activeDraft.refinementPrompt}“
              </p>
            )}
          </div>

          <div className="pt-5 border-t border-[#E7E5E4] flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-[#52525B] max-w-md">
              Zufrieden mit dieser Raumversion? Nach Freigabe erstellen wir eine Einkaufsliste
              ausschließlich für neu ergänzte oder ausgetauschte Elemente.
            </p>

            <button
              type="button"
              onClick={onApproveDraft}
              disabled={isBusy || isGeneratingList}
              className="px-5 py-3 rounded-lg bg-[#18181B] text-[#FAF9F6] text-sm font-medium hover:bg-[#27272A] disabled:opacity-45 disabled:pointer-events-none transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isGeneratingList ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Einkaufsliste wird erstellt …</span>
                </>
              ) : isApprovedActive ? (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>Einkaufsliste aktualisieren</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                  <span>Entwurf freigeben & Einkaufsliste erstellen</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
