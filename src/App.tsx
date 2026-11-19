import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Header } from './components/Header';
import { WorkspaceInputs } from './components/WorkspaceInputs';
import { DesignStage } from './components/DesignStage';
import { ShoppingListSection } from './components/ShoppingListSection';
import {
  DraftAngleImage,
  ImageAsset,
  RoomDraft,
  SavedSession,
  ShoppingListResult,
} from './types';
import { assetUrlToCompressedImage } from './utils/image';
import { SAMPLE_INSPIRATIONS, SAMPLE_ROOMS } from './constants/samples';

const STORAGE_KEY = 'raumstudio_session_v1';
const SAMPLE_ROOM_URL = SAMPLE_ROOMS[0].url;
const SAMPLE_INSPO_SCANDI_URL = SAMPLE_INSPIRATIONS[0].url;

function loadInitialSession(): Partial<SavedSession> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<SavedSession>;
    if (!Array.isArray(parsed.originalRooms) && parsed.originalRoom) {
      parsed.originalRooms = [parsed.originalRoom];
    }
    return parsed;
  } catch {
    return {};
  }
}

export default function App() {
  const initial = loadInitialSession();

  const [originalRooms, setOriginalRooms] = useState<ImageAsset[]>(
    Array.isArray(initial.originalRooms) ? initial.originalRooms : []
  );
  const [roomDimensions, setRoomDimensions] = useState<string>(
    initial.roomDimensions ?? ''
  );
  const [inspirations, setInspirations] = useState<ImageAsset[]>(
    Array.isArray(initial.inspirations) ? initial.inspirations : []
  );
  const [keepAndAdjustText, setKeepAndAdjustText] = useState<string>(
    initial.keepAndAdjustText ?? ''
  );
  const [refinementText, setRefinementText] = useState<string>('');
  const [drafts, setDrafts] = useState<RoomDraft[]>(
    Array.isArray(initial.drafts) ? initial.drafts : []
  );
  const [activeDraftIndex, setActiveDraftIndex] = useState<number>(
    typeof initial.activeDraftIndex === 'number' ? initial.activeDraftIndex : 0
  );
  const [activeAngleIndex, setActiveAngleIndex] = useState<number>(
    typeof initial.activeAngleIndex === 'number' ? initial.activeAngleIndex : 0
  );
  const [comparisonMode, setComparisonMode] = useState<'after' | 'before'>(
    initial.comparisonMode === 'before' ? 'before' : 'after'
  );
  const [approvedVersion, setApprovedVersion] = useState<number | null>(
    typeof initial.approvedVersion === 'number' ? initial.approvedVersion : null
  );
  const [shoppingList, setShoppingList] = useState<ShoppingListResult | null>(
    initial.shoppingList ?? null
  );
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>(
    Array.isArray(initial.checkedItemIds) ? initial.checkedItemIds : []
  );
  const [includeSecondhand, setIncludeSecondhand] = useState<boolean>(
    Boolean(initial.includeSecondhand)
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isGeneratingList, setIsGeneratingList] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const payload: SavedSession = {
      originalRooms,
      roomDimensions,
      inspirations,
      keepAndAdjustText,
      drafts,
      activeDraftIndex,
      activeAngleIndex,
      comparisonMode,
      approvedVersion,
      shoppingList,
      checkedItemIds,
      includeSecondhand,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      try {
        const trimmedDrafts = drafts.slice(-1);
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...payload,
            drafts: trimmedDrafts,
            activeDraftIndex: Math.max(0, trimmedDrafts.length - 1),
          })
        );
      } catch {
        // Ignorieren, falls Speicher vollständig blockiert ist
      }
    }
  }, [
    originalRooms,
    roomDimensions,
    inspirations,
    keepAndAdjustText,
    drafts,
    activeDraftIndex,
    activeAngleIndex,
    comparisonMode,
    approvedVersion,
    shoppingList,
    checkedItemIds,
    includeSecondhand,
  ]);

  const activeDraft = drafts[activeDraftIndex] ?? null;

  const handleAddOriginalRooms = (assets: ImageAsset[]) => {
    setOriginalRooms((prev) => [...prev, ...assets].slice(0, 4));
    setErrorMessage(null);
  };

  const handleRemoveOriginalRoom = (id: string) => {
    setOriginalRooms((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 0) {
        setDrafts([]);
        setActiveDraftIndex(0);
        setActiveAngleIndex(0);
        setApprovedVersion(null);
        setShoppingList(null);
        setCheckedItemIds([]);
      } else if (activeAngleIndex >= next.length) {
        setActiveAngleIndex(0);
      }
      return next;
    });
  };

  const handleSetPrimaryRoom = (id: string) => {
    setOriginalRooms((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;
      return [target, ...prev.filter((item) => item.id !== id)];
    });
    setActiveAngleIndex(0);
  };

  const handleAddInspirations = (assets: ImageAsset[]) => {
    setInspirations((prev) => [...prev, ...assets].slice(0, 4));
    setErrorMessage(null);
  };

  const handleRemoveInspiration = (id: string) => {
    setInspirations((prev) => prev.filter((item) => item.id !== id));
  };

  const handleQuickStartSample = async () => {
    setErrorMessage(null);
    try {
      const [roomImg, inspoImg] = await Promise.all([
        assetUrlToCompressedImage(SAMPLE_ROOM_URL),
        assetUrlToCompressedImage(SAMPLE_INSPO_SCANDI_URL),
      ]);
      setOriginalRooms([
        {
          id: SAMPLE_ROOMS[0].id,
          dataUrl: roomImg.dataUrl,
          aspectRatio: roomImg.aspectRatio,
          name: SAMPLE_ROOMS[0].name,
        },
      ]);
      setActiveAngleIndex(0);
      setInspirations([
        {
          id: SAMPLE_INSPIRATIONS[0].id,
          dataUrl: inspoImg.dataUrl,
          aspectRatio: inspoImg.aspectRatio,
          name: SAMPLE_INSPIRATIONS[0].label,
        },
      ]);
      if (!keepAndAdjustText.trim()) {
        setKeepAndAdjustText(SAMPLE_ROOMS[0].defaultInstructions);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Die Beispieldateien konnten nicht geladen werden.'
      );
    }
  };

  const handleGenerateDraft = async () => {
    if (originalRooms.length === 0) {
      setErrorMessage('Bitte laden Sie zunächst mindestens ein Foto Ihres aktuellen Zimmers hoch.');
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/design/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalRoomDataUrls: originalRooms.map((r) => r.dataUrl),
          roomAspectRatios: originalRooms.map((r) => r.aspectRatio ?? '4:3'),
          roomDimensions,
          inspirationDataUrls: inspirations.map((i) => i.dataUrl),
          keepAndAdjustText,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        imageDataUrl?: string | null;
        angleImages?: DraftAngleImage[];
        fallbackOnly?: boolean;
        imageWarning?: string;
        changeSummary?: string;
        designNotes?: string[];
      };

      if (!response.ok) {
        throw new Error(
          data.error || 'Der Raumentwurf konnte nicht erstellt werden.'
        );
      }

      if (data.imageWarning) {
        setErrorMessage(data.imageWarning);
      }

      const nextVersion = drafts.length + 1;
      const newDraft: RoomDraft = {
        version: nextVersion,
        imageDataUrl: data.imageDataUrl ?? null,
        angleImages: Array.isArray(data.angleImages) ? data.angleImages : undefined,
        changeSummary:
          data.changeSummary ||
          'Neuer Entwurf gemäß Ihren Gestaltungs- und Bestandsangaben.',
        designNotes: Array.isArray(data.designNotes) ? data.designNotes : [],
        refinementPrompt: keepAndAdjustText.trim(),
        createdAt: new Date().toISOString(),
        fallbackOnly: Boolean(data.fallbackOnly),
      };

      const nextDrafts = [...drafts, newDraft];
      setDrafts(nextDrafts);
      setActiveDraftIndex(nextDrafts.length - 1);
      setActiveAngleIndex(0);
      setComparisonMode('after');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Bei der Erstellung des Raumentwurfs ist ein Fehler aufgetreten.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefineDraft = async () => {
    if (originalRooms.length === 0 || !activeDraft) return;
    if (!refinementText.trim()) {
      setErrorMessage('Bitte geben Sie an, was am aktuellen Entwurf geändert werden soll.');
      return;
    }

    setErrorMessage(null);
    setIsRefining(true);

    try {
      const historyPrompts = drafts
        .slice(0, activeDraftIndex + 1)
        .map((d) => d.refinementPrompt)
        .filter(Boolean);

      const currentDraftImages = originalRooms.map((_, idx) => {
        if (Array.isArray(activeDraft.angleImages) && activeDraft.angleImages[idx]) {
          return activeDraft.angleImages[idx].imageDataUrl;
        }
        return idx === 0 ? activeDraft.imageDataUrl : null;
      });

      const response = await fetch('/api/design/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalRoomDataUrls: originalRooms.map((r) => r.dataUrl),
          roomAspectRatios: originalRooms.map((r) => r.aspectRatio ?? '4:3'),
          roomDimensions,
          currentDraftImages,
          currentDraftDataUrl: activeDraft.imageDataUrl,
          inspirationDataUrls: inspirations.map((i) => i.dataUrl),
          initialInstructions: keepAndAdjustText,
          refinementPrompt: refinementText.trim(),
          historyPrompts,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        imageDataUrl?: string | null;
        angleImages?: DraftAngleImage[];
        fallbackOnly?: boolean;
        imageWarning?: string;
        changeSummary?: string;
        designNotes?: string[];
      };

      if (!response.ok) {
        throw new Error(
          data.error || 'Die Verfeinerung des Entwurfs ist fehlgeschlagen.'
        );
      }

      if (data.imageWarning) {
        setErrorMessage(data.imageWarning);
      }

      const nextVersion = drafts.length + 1;
      const refinedDraft: RoomDraft = {
        version: nextVersion,
        imageDataUrl: data.imageDataUrl ?? activeDraft.imageDataUrl ?? null,
        angleImages: Array.isArray(data.angleImages)
          ? data.angleImages
          : activeDraft.angleImages,
        changeSummary:
          data.changeSummary || 'Der Entwurf wurde gemäß Ihrem Änderungswunsch angepasst.',
        designNotes: Array.isArray(data.designNotes) ? data.designNotes : [],
        refinementPrompt: refinementText.trim(),
        createdAt: new Date().toISOString(),
        fallbackOnly: Boolean(data.fallbackOnly && !activeDraft.imageDataUrl),
      };

      const nextDrafts = [...drafts, refinedDraft];
      setDrafts(nextDrafts);
      setActiveDraftIndex(nextDrafts.length - 1);
      setComparisonMode('after');
      setRefinementText('');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Die Anpassung des Entwurfs konnte nicht durchgeführt werden.'
      );
    } finally {
      setIsRefining(false);
    }
  };

  const handleApproveDraft = async () => {
    if (originalRooms.length === 0 || !activeDraft) return;
    setErrorMessage(null);
    setIsGeneratingList(true);

    try {
      const refinementHistory = drafts
        .slice(0, activeDraftIndex + 1)
        .map((d) => d.refinementPrompt)
        .filter(Boolean);

      const approvedDraftDataUrls = Array.isArray(activeDraft.angleImages)
        ? activeDraft.angleImages.map((a) => a.imageDataUrl).filter(Boolean)
        : activeDraft.imageDataUrl
          ? [activeDraft.imageDataUrl]
          : [];

      const response = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalRoomDataUrls: originalRooms.map((r) => r.dataUrl),
          roomDimensions,
          approvedDraftDataUrls,
          approvedDraftDataUrl: activeDraft.imageDataUrl,
          initialInstructions: keepAndAdjustText,
          refinementHistory,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        summary?: string;
        keptItemsNote?: string;
        items?: ShoppingListResult['items'];
        totalMinEur?: number;
        totalMaxEur?: number;
      };

      if (!response.ok) {
        throw new Error(
          data.error || 'Die Einkaufsliste konnte nicht erstellt werden.'
        );
      }

      setApprovedVersion(activeDraft.version);
      setCheckedItemIds([]);
      setShoppingList({
        approvedVersion: activeDraft.version,
        summary: data.summary || '',
        keptItemsNote: data.keptItemsNote || '',
        items: Array.isArray(data.items) ? data.items : [],
        totalMinEur: Number(data.totalMinEur) || 0,
        totalMaxEur: Number(data.totalMaxEur) || 0,
        generatedAt: new Date().toISOString(),
      });

      requestAnimationFrame(() => {
        document.getElementById('einkaufsliste')?.scrollIntoView({ behavior: 'smooth' });
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Beim Erstellen der Einkaufsliste ist ein Fehler aufgetreten.'
      );
    } finally {
      setIsGeneratingList(false);
    }
  };

  const handleToggleItemChecked = (id: string) => {
    setCheckedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleResetSession = () => {
    setOriginalRooms([]);
    setRoomDimensions('');
    setInspirations([]);
    setKeepAndAdjustText('');
    setRefinementText('');
    setDrafts([]);
    setActiveDraftIndex(0);
    setActiveAngleIndex(0);
    setComparisonMode('after');
    setApprovedVersion(null);
    setShoppingList(null);
    setCheckedItemIds([]);
    setErrorMessage(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorieren
    }
  };

  const hasSessionData = Boolean(
    originalRooms.length > 0 ||
      roomDimensions.trim() ||
      inspirations.length > 0 ||
      keepAndAdjustText.trim() ||
      drafts.length > 0
  );

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#18181B]">
      <Header
        hasSessionData={hasSessionData}
        hasDrafts={drafts.length > 0}
        hasShoppingList={shoppingList !== null}
        onResetSession={handleResetSession}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 lg:px-10 py-8 lg:py-10 flex flex-col gap-8">
        {/* Kompakte Studio-Einleitung */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E7E5E4]">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl lg:text-4xl font-medium tracking-tight text-[#18181B]">
              Bestehendes bewahren, Räume gezielt neu denken
            </h1>
            <p className="text-sm lg:text-base text-[#52525B] mt-2 leading-relaxed">
              Laden Sie bis zu 4 Blickwinkel Ihres Zimmers und Stilvorlagen hoch. Jeder Entwurf
              wird exakt in Ihren Originalperspektiven und 1:1 Maßen umgesetzt.
            </p>
          </div>
          <div className="text-xs text-[#71717A] flex items-center gap-2 shrink-0">
            <span>Originalwinkel & 1:1 Maße</span>
            <span aria-hidden="true">·</span>
            <span>Ein Entwurf pro Durchlauf</span>
          </div>
        </section>

        {/* Fehler- oder Hinweisbanner */}
        {errorMessage && (
          <div
            role="alert"
            className="bg-white border border-[#18181B] rounded-xl px-4 py-3.5 flex items-start justify-between gap-4 text-sm text-[#18181B]"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#18181B]" aria-hidden="true" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              aria-label="Meldung schließen"
              className="p-1 text-[#71717A] hover:text-[#18181B] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Zweispalter-Arbeitsfläche */}
        <div className="grid grid-cols-1 lg:grid-cols-[390px_minmax(0,1fr)] gap-8 items-start">
          <WorkspaceInputs
            originalRooms={originalRooms}
            roomDimensions={roomDimensions}
            inspirations={inspirations}
            keepAndAdjustText={keepAndAdjustText}
            refinementText={refinementText}
            hasDrafts={drafts.length > 0}
            currentDraftVersion={activeDraft?.version ?? null}
            isGenerating={isGenerating}
            isRefining={isRefining}
            onAddOriginalRooms={handleAddOriginalRooms}
            onRemoveOriginalRoom={handleRemoveOriginalRoom}
            onSetPrimaryRoom={handleSetPrimaryRoom}
            onChangeRoomDimensions={setRoomDimensions}
            onAddInspirations={handleAddInspirations}
            onRemoveInspiration={handleRemoveInspiration}
            onChangeKeepAndAdjust={setKeepAndAdjustText}
            onChangeRefinementText={setRefinementText}
            onGenerateDraft={handleGenerateDraft}
            onRefineDraft={handleRefineDraft}
            onError={setErrorMessage}
          />

          <div className="flex flex-col gap-8 min-w-0">
            <DesignStage
              originalRooms={originalRooms}
              activeAngleIndex={activeAngleIndex}
              drafts={drafts}
              activeDraftIndex={activeDraftIndex}
              comparisonMode={comparisonMode}
              approvedVersion={approvedVersion}
              isGenerating={isGenerating}
              isRefining={isRefining}
              isGeneratingList={isGeneratingList}
              onSelectAngle={setActiveAngleIndex}
              onSelectDraft={(idx) => {
                setActiveDraftIndex(idx);
                setComparisonMode('after');
              }}
              onToggleComparison={setComparisonMode}
              onApproveDraft={handleApproveDraft}
              onRetryDraft={handleGenerateDraft}
              onQuickStartSample={handleQuickStartSample}
            />

            <ShoppingListSection
              shoppingList={shoppingList}
              isLoading={isGeneratingList}
              checkedItemIds={checkedItemIds}
              includeSecondhand={includeSecondhand}
              onToggleItemChecked={handleToggleItemChecked}
              onToggleSecondhand={setIncludeSecondhand}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-[#E7E5E4] mt-12">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-[#71717A]">
          <span>Raumstudio · Minimalistische Einrichtungsplanung</span>
          <span>Geschätzte Preise dienen als Budget-Orientierung für den Produktvergleich.</span>
        </div>
      </footer>
    </div>
  );
}
