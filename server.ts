import "dotenv/config";
import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const TEXT_MODEL = "gemini-4-hydrogen";
const ALLOWED_ASPECT_RATIOS = new Set(["1:1", "3:4", "4:3", "9:16", "16:9"]);

function sanitizeAspectRatio(ratio?: string): string {
  if (ratio && ALLOWED_ASPECT_RATIOS.has(ratio)) {
    return ratio;
  }
  return "4:3";
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error(
      "Es ist kein Gemini API-Schlüssel hinterlegt. Bitte prüfen Sie Ihre Konfiguration unter Settings > Secrets."
    ) as Error & { status?: number };
    err.status = 500;
    throw err;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Ungültiges Bildformat übermittelt.");
  }
  return {
    mimeType: match[1],
    data: match[2],
  };
}

function normalizeRoomUrls(
  originalRoomDataUrls?: string[],
  originalRoomDataUrl?: string
): string[] {
  if (Array.isArray(originalRoomDataUrls) && originalRoomDataUrls.length > 0) {
    return originalRoomDataUrls.filter(Boolean).slice(0, 4);
  }
  if (originalRoomDataUrl) {
    return [originalRoomDataUrl];
  }
  return [];
}

function classifyGeminiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes("permission_denied") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid") ||
    lower.includes("403")
  ) {
    return {
      status: 403,
      message:
        "Der API-Schlüssel ist ungültig oder für das Bildmodell nicht freigeschaltet. Bitte prüfen Sie Ihren Schlüssel unter Settings > Secrets.",
    };
  }

  if (lower.includes("resource_exhausted") || lower.includes("429") || lower.includes("quota")) {
    return {
      status: 429,
      message:
        "Das Anfrage-Limit (Rate-Limit) wurde vorübergehend erreicht. Bitte warten Sie einen kurzen Moment oder prüfen Sie Ihren kostenpflichtigen API-Schlüssel unter Settings > Secrets.",
    };
  }

  if (lower.includes("not_found") || lower.includes("404")) {
    return {
      status: 404,
      message:
        "Das angeforderte Gemini-Modell ist aktuell nicht erreichbar. Bitte versuchen Sie es später erneut.",
    };
  }

  if (lower.includes("400") || lower.includes("invalid_argument")) {
    return {
      status: 400,
      message:
        "Die Anfrage konnte vom Modell nicht verarbeitet werden. Bitte prüfen Sie die hochgeladenen Bilder oder kürzen Sie den Text.",
    };
  }

  return {
    status: 500,
    message:
      raw ||
      "Bei der Verarbeitung des Raumentwurfs ist ein unerwarteter Fehler aufgetreten.",
  };
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      const isTransient =
        msg.includes("503") ||
        msg.includes("unavailable") ||
        msg.includes("timeout") ||
        msg.includes("econnreset");
      if (!isTransient || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
  throw lastError;
}

async function analyzeRoomGeometry(
  ai: GoogleGenAI,
  roomInlines: Array<{ mimeType: string; data: string }>,
  roomDimensions: string
): Promise<string> {
  if (roomInlines.length <= 1 && !roomDimensions.trim()) {
    return "";
  }

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: {
        parts: [
          ...roomInlines.map((img) => ({ inlineData: img })),
          {
            text: [
              `These ${roomInlines.length} photos show the same original room from different angles.`,
              roomDimensions.trim()
                ? `The user provided these real room dimensions: "${roomDimensions.trim()}".`
                : "",
              "Provide a concise architectural measurement summary (3-4 short lines in English) covering: exact wall proportions, ceiling height impression, window/door/radiator locations, and exact scale constraints for furniture so an image editor preserves the room's 1:1 dimensions and camera perspectives without enlarging the space.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    return (response.text ?? "").trim();
  } catch {
    return "";
  }
}

async function generateSingleImage(
  ai: GoogleGenAI,
  parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }>,
  aspectRatio: string
): Promise<string | null> {
  const imageResponse = await withRetry(() =>
    ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: sanitizeAspectRatio(aspectRatio),
        },
      },
    })
  );

  for (const part of imageResponse.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType ?? "image/png";
      return `data:${mime};base64,${part.inlineData.data}`;
    }
  }
  return null;
}

async function generateGermanSummary(
  ai: GoogleGenAI,
  parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }>,
  contextInstruction: string
): Promise<{ changeSummary: string; designNotes: string[] }> {
  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: {
        parts: [
          ...parts,
          {
            text: contextInstruction,
          },
        ],
      },
      config: {
        systemInstruction:
          "Du bist ein präziser, minimalistischer Innenarchitekt. Antworte ausschließlich auf natürlichem, klarem Deutsch ohne Werbefloskeln.",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            changeSummary: {
              type: Type.STRING,
              description:
                "Eine prägnante Zusammenfassung in 1 bis 2 Sätzen auf Deutsch, was im Raum verändert und was beibehalten wurde.",
            },
            designNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 kurze, konkrete Stichpunkte auf Deutsch zu den wichtigsten Änderungen.",
            },
          },
          required: ["changeSummary", "designNotes"],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? "{}").trim()) as {
      changeSummary?: string;
      designNotes?: string[];
    };

    return {
      changeSummary:
        parsed.changeSummary?.trim() ||
        "Der Raum wurde gemäß Ihren Vorgaben und Inspirationsbildern in den Originalperspektiven neu gestaltet.",
      designNotes: Array.isArray(parsed.designNotes) ? parsed.designNotes.slice(0, 4) : [],
    };
  } catch {
    return {
      changeSummary:
        "Der Raum wurde gemäß Ihren Vorgaben und Inspirationsbildern in den Originalperspektiven neu gestaltet.",
      designNotes: [],
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "40mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post("/api/design/generate", async (req: Request, res: Response) => {
    try {
      const {
        originalRoomDataUrls,
        originalRoomDataUrl,
        roomAspectRatios = [],
        roomDimensions = "",
        inspirationDataUrls = [],
        keepAndAdjustText = "",
      } = req.body as {
        originalRoomDataUrls?: string[];
        originalRoomDataUrl?: string;
        roomAspectRatios?: string[];
        roomDimensions?: string;
        inspirationDataUrls?: string[];
        keepAndAdjustText?: string;
      };

      const roomUrls = normalizeRoomUrls(originalRoomDataUrls, originalRoomDataUrl);
      if (roomUrls.length === 0) {
        res
          .status(400)
          .json({ error: "Bitte laden Sie zuerst mindestens ein Foto Ihres aktuellen Zimmers hoch." });
        return;
      }

      const ai = getAiClient();
      const roomInlines = roomUrls.map(parseDataUrl);
      const inspoInlines = (Array.isArray(inspirationDataUrls) ? inspirationDataUrls : [])
        .slice(0, 4)
        .map(parseDataUrl);

      const userInstructions = keepAndAdjustText.trim()
        ? keepAndAdjustText.trim()
        : "Harmonische skandinavische Aufwertung mit ruhiger, heller Atmosphäre, natürlichen Materialien und aufgeräumter Wirkung. Bestehende Hauptmöbel respektieren.";

      const geometryNotes = await analyzeRoomGeometry(ai, roomInlines, roomDimensions);
      const roomCount = roomInlines.length;

      // 1) Blickwinkel 0 (Hauptansicht) zuerst generieren als Stil- & Möbelanker
      const primaryPrompt = [
        "Edit IMAGE 1 in-place into ONE photorealistic redesigned interior photograph.",
        "EXACT CAMERA ANGLE & PERSPECTIVE LOCK (CRITICAL):",
        "- The output image MUST match the EXACT camera position, viewing angle, horizon line, lens focal length, field of view, and framing of IMAGE 1.",
        "- Do NOT rotate the camera, do NOT zoom in or out, do NOT shift left/right, and do NOT invent a different angle.",
        roomCount > 1
          ? `- Images 2 to ${roomCount} show other angles of the EXACT SAME physical room so you can verify true 1:1 dimensions and spatial depth.`
          : "",
        roomDimensions.trim() ? `KNOWN ROOM DIMENSIONS: "${roomDimensions.trim()}".` : "",
        geometryNotes ? `MEASURED ARCHITECTURAL CONSTRAINTS:\n${geometryNotes}` : "",
        "STRICT 1:1 DIMENSION LOCK:",
        "- Keep all walls, corners, ceiling height, windows, window frames, sills, doors, radiators, and floor boundaries in their exact 1:1 pixel geometry and positions from IMAGE 1.",
        "- Strictly preserve all existing furniture, floors, or elements that the user requested to keep.",
        inspoInlines.length > 0
          ? `- Images ${roomCount + 1} to ${roomCount + inspoInlines.length} are aesthetic inspiration references ONLY (colors, materials, lighting mood, furniture style — never copy their room layout or perspective).`
          : "- Apply a calm, light Scandinavian editorial architectural aesthetic.",
        `USER KEEP & ADJUSTMENT INSTRUCTIONS (in German): "${userInstructions}"`,
        "Produce realistic daylight, natural shadows, believable 1:1 scale, and zero text overlays or watermarks.",
      ]
        .filter(Boolean)
        .join("\n");

      const primaryParts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
      > = [
        ...roomInlines.map((img) => ({ inlineData: img })),
        ...inspoInlines.map((img) => ({ inlineData: img })),
        { text: primaryPrompt },
      ];

      const generatedUrls: Array<string | null> = new Array(roomCount).fill(null);
      let imageWarning: string | undefined;

      try {
        generatedUrls[0] = await generateSingleImage(
          ai,
          primaryParts,
          roomAspectRatios[0] || "4:3"
        );
      } catch (imgErr) {
        const classified = classifyGeminiError(imgErr);
        if (classified.status === 403 || classified.status === 429) {
          res.status(classified.status).json({ error: classified.message });
          return;
        }
        imageWarning = `${classified.message} Als Orientierung wurde ein schriftliches Raumkonzept erstellt.`;
      }

      // 2) Weitere Original-Blickwinkel (1..N-1) parallel in exakt deren Originalperspektive generieren
      if (roomCount > 1 && generatedUrls[0]) {
        const primaryDesignInline = parseDataUrl(generatedUrls[0]);

        const secondaryResults = await Promise.all(
          roomInlines.slice(1).map(async (targetRoomInline, offset) => {
            const idx = offset + 1;
            const anglePrompt = [
              "Edit IMAGE 1 in-place into ONE photorealistic redesigned interior photograph.",
              "EXACT CAMERA ANGLE & PERSPECTIVE LOCK (HIGHEST PRIORITY):",
              "- You MUST output the EXACT camera position, viewing angle, horizon line, lens focal length, framing, and 1:1 room geometry of IMAGE 1.",
              "- Keep all walls, windows, doors, radiators, ceiling edges, and floor boundaries in the exact same positions as IMAGE 1. NEVER switch to the camera angle of IMAGE 2.",
              "- IMAGE 2 shows the already-redesigned primary view of THIS SAME ROOM. Apply the EXACT SAME wall colors, floor finish, furniture pieces, lighting, textiles, and kept items shown in IMAGE 2 consistently into the camera perspective of IMAGE 1.",
              roomDimensions.trim() ? `KNOWN ROOM DIMENSIONS: "${roomDimensions.trim()}".` : "",
              geometryNotes ? `MEASURED ARCHITECTURAL CONSTRAINTS:\n${geometryNotes}` : "",
              `USER KEEP & ADJUSTMENT INSTRUCTIONS (in German): "${userInstructions}"`,
              "Produce realistic daylight, natural shadows, believable 1:1 scale, and zero text overlays.",
            ]
              .filter(Boolean)
              .join("\n");

            const parts: Array<
              { inlineData: { mimeType: string; data: string } } | { text: string }
            > = [
              { inlineData: targetRoomInline },
              { inlineData: primaryDesignInline },
              ...inspoInlines.slice(0, 2).map((img) => ({ inlineData: img })),
              { text: anglePrompt },
            ];

            try {
              return await generateSingleImage(ai, parts, roomAspectRatios[idx] || "4:3");
            } catch {
              return null;
            }
          })
        );

        secondaryResults.forEach((url, offset) => {
          generatedUrls[offset + 1] = url;
        });

        const missingCount = generatedUrls.filter((u) => !u).length;
        if (missingCount > 0 && generatedUrls[0]) {
          imageWarning = `${roomCount - missingCount} von ${roomCount} Perspektiven wurden erstellt. Einzelne Nebenperspektiven konnten nicht generiert werden.`;
        }
      }

      if (!generatedUrls[0] && !imageWarning) {
        imageWarning =
          "Das Bildmodell hat für diese Anfrage kein Bild zurückgegeben. Unten finden Sie das schriftliche Raumkonzept — bitte passen Sie den Text leicht an oder versuchen Sie es erneut.";
      }

      const angleImages = generatedUrls.map((url, idx) => ({
        angleIndex: idx,
        label: idx === 0 ? "Hauptansicht" : `Blickwinkel ${idx + 1}`,
        imageDataUrl: url,
      }));

      const summaryParts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
      > = [...roomInlines.map((img) => ({ inlineData: img }))];
      if (generatedUrls[0]) {
        summaryParts.push({ inlineData: parseDataUrl(generatedUrls[0]) });
      }

      const summary = await generateGermanSummary(
        ai,
        summaryParts,
        generatedUrls[0]
          ? `Vergleiche die Originalfotos des Zimmers (${roomCount} Perspektive${
              roomCount > 1 ? "n" : ""
            }) mit dem neuen Entwurf unter Berücksichtigung der Nutzervorgabe: "${userInstructions}"${
              roomDimensions.trim() ? ` und der Maße (${roomDimensions.trim()})` : ""
            }. Fasse auf Deutsch zusammen, was exakt 1:1 in Perspektive und Maßen erhalten blieb und was neu gestaltet wurde.`
          : `Analysiere die Originalfotos des Zimmers und erstelle auf Basis der Nutzervorgabe ("${userInstructions}") ein konkretes, maßstabgetreues Raumkonzept auf Deutsch.`
      );

      res.json({
        imageDataUrl: generatedUrls[0],
        angleImages,
        fallbackOnly: generatedUrls.every((u) => !u),
        imageWarning,
        changeSummary: summary.changeSummary,
        designNotes: summary.designNotes,
      });
    } catch (error) {
      const classified = classifyGeminiError(error);
      res.status(classified.status).json({ error: classified.message });
    }
  });

  app.post("/api/design/refine", async (req: Request, res: Response) => {
    try {
      const {
        originalRoomDataUrls,
        originalRoomDataUrl,
        roomAspectRatios = [],
        roomDimensions = "",
        currentDraftImages,
        currentDraftDataUrl,
        inspirationDataUrls = [],
        initialInstructions = "",
        refinementPrompt = "",
        historyPrompts = [],
      } = req.body as {
        originalRoomDataUrls?: string[];
        originalRoomDataUrl?: string;
        roomAspectRatios?: string[];
        roomDimensions?: string;
        currentDraftImages?: Array<string | null>;
        currentDraftDataUrl?: string | null;
        inspirationDataUrls?: string[];
        initialInstructions?: string;
        refinementPrompt?: string;
        historyPrompts?: string[];
      };

      const roomUrls = normalizeRoomUrls(originalRoomDataUrls, originalRoomDataUrl);
      if (roomUrls.length === 0) {
        res.status(400).json({ error: "Originalfotos des Zimmers fehlen." });
        return;
      }
      if (!refinementPrompt.trim()) {
        res.status(400).json({ error: "Bitte geben Sie einen konkreten Änderungswunsch ein." });
        return;
      }

      const ai = getAiClient();
      const roomInlines = roomUrls.map(parseDataUrl);
      const roomCount = roomInlines.length;
      const inspoInlines = (Array.isArray(inspirationDataUrls) ? inspirationDataUrls : [])
        .slice(0, 3)
        .map(parseDataUrl);

      const previousAngles: Array<string | null> = roomInlines.map((_, idx) => {
        if (Array.isArray(currentDraftImages) && currentDraftImages[idx]) {
          return currentDraftImages[idx];
        }
        if (idx === 0 && currentDraftDataUrl) {
          return currentDraftDataUrl;
        }
        return null;
      });

      const priorContext = [initialInstructions, ...historyPrompts]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" | ");

      // 1) Hauptansicht (Winkel 0) im Originalwinkel verfeinern
      const primaryPrevUrl = previousAngles[0];
      const primaryPrompt = [
        primaryPrevUrl
          ? "Refine IMAGE 2 (the current room draft) while strictly locking the EXACT camera angle, perspective, horizon line, framing, and 1:1 room geometry of IMAGE 1 (the original room photo)."
          : "Redesign IMAGE 1 in-place while locking its EXACT camera angle, perspective, framing, and 1:1 room geometry.",
        "EXACT CAMERA ANGLE & 1:1 SCALE RULE:",
        "- Output MUST match the exact camera position, focal length, wall boundaries, window/door positions, and ceiling height of IMAGE 1.",
        "- Do NOT rotate or shift the camera perspective.",
        roomDimensions.trim()
          ? `KNOWN ROOM DIMENSIONS (must stay 1:1 accurate): "${roomDimensions.trim()}".`
          : "",
        priorContext ? `EXISTING CONSTRAINTS & KEPT ITEMS: "${priorContext}"` : "",
        `NEW REFINEMENT INSTRUCTION (in German): "${refinementPrompt.trim()}"`,
        "Apply ONLY the requested refinement cleanly and photorealistically while keeping all other parts of the current design and all explicitly preserved original items intact. Output one single interior photograph.",
      ]
        .filter(Boolean)
        .join("\n");

      const primaryParts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
      > = [{ inlineData: roomInlines[0] }];
      if (primaryPrevUrl) {
        primaryParts.push({ inlineData: parseDataUrl(primaryPrevUrl) });
      }
      for (const extraRoom of roomInlines.slice(1)) {
        primaryParts.push({ inlineData: extraRoom });
      }
      for (const inspo of inspoInlines) {
        primaryParts.push({ inlineData: inspo });
      }
      primaryParts.push({ text: primaryPrompt });

      const refinedUrls: Array<string | null> = new Array(roomCount).fill(null);
      let imageWarning: string | undefined;

      try {
        refinedUrls[0] = await generateSingleImage(
          ai,
          primaryParts,
          roomAspectRatios[0] || "4:3"
        );
      } catch (imgErr) {
        const classified = classifyGeminiError(imgErr);
        if (classified.status === 403 || classified.status === 429) {
          res.status(classified.status).json({ error: classified.message });
          return;
        }
        imageWarning = `${classified.message} Schriftliche Verfeinerungsnotiz wurde erstellt.`;
      }

      // 2) Weitere Winkel (1..N-1) parallel in deren exakt ursprünglicher Kameraperspektive verfeinern
      if (roomCount > 1 && refinedUrls[0]) {
        const newlyRefinedPrimaryInline = parseDataUrl(refinedUrls[0]);

        const secondaryRefined = await Promise.all(
          roomInlines.slice(1).map(async (targetRoomInline, offset) => {
            const idx = offset + 1;
            const prevAngleUrl = previousAngles[idx];

            const anglePrompt = [
              prevAngleUrl
                ? "Refine IMAGE 2 (current draft for this view) while strictly locking the EXACT camera angle, perspective, horizon line, framing, and 1:1 room geometry of IMAGE 1 (original room photo for this angle). Use IMAGE 3 (newly refined primary angle) as the consistency reference so the updated style and furniture match across all angles."
                : "Edit IMAGE 1 in-place using its EXACT camera angle, perspective, framing, and 1:1 room geometry, applying the consistent redesigned look and refinement shown in IMAGE 2.",
              "CRITICAL: Output MUST stay in the EXACT camera perspective of IMAGE 1 — never switch to another angle.",
              roomDimensions.trim()
                ? `KNOWN ROOM DIMENSIONS (must stay 1:1 accurate): "${roomDimensions.trim()}".`
                : "",
              priorContext ? `EXISTING CONSTRAINTS & KEPT ITEMS: "${priorContext}"` : "",
              `NEW REFINEMENT INSTRUCTION (in German): "${refinementPrompt.trim()}"`,
              "Output one single photorealistic interior photograph.",
            ]
              .filter(Boolean)
              .join("\n");

            const parts: Array<
              { inlineData: { mimeType: string; data: string } } | { text: string }
            > = [{ inlineData: targetRoomInline }];
            if (prevAngleUrl) {
              parts.push({ inlineData: parseDataUrl(prevAngleUrl) });
            }
            parts.push({ inlineData: newlyRefinedPrimaryInline });
            parts.push({ text: anglePrompt });

            try {
              return await generateSingleImage(ai, parts, roomAspectRatios[idx] || "4:3");
            } catch {
              return prevAngleUrl;
            }
          })
        );

        secondaryRefined.forEach((url, offset) => {
          refinedUrls[offset + 1] = url;
        });
      }

      if (!refinedUrls[0] && !imageWarning) {
        imageWarning =
          "Das Bildmodell konnte für diesen Verfeinerungsschritt kein neues Bild erzeugen. Bitte formulieren Sie den Wunsch etwas konkreter oder versuchen Sie es erneut.";
      }

      const angleImages = refinedUrls.map((url, idx) => ({
        angleIndex: idx,
        label: idx === 0 ? "Hauptansicht" : `Blickwinkel ${idx + 1}`,
        imageDataUrl: url ?? previousAngles[idx] ?? null,
      }));

      const summaryParts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
      > = [{ inlineData: primaryPrevUrl ? parseDataUrl(primaryPrevUrl) : roomInlines[0] }];
      if (refinedUrls[0]) {
        summaryParts.push({ inlineData: parseDataUrl(refinedUrls[0]) });
      }

      const summary = await generateGermanSummary(
        ai,
        summaryParts,
        `Der Nutzer hat folgende Anpassung angefordert: "${refinementPrompt.trim()}". Fasse auf Deutsch kurz zusammen, wie diese Änderung unter Beibehaltung der 1:1 Raummaße und Originalperspektiven umgesetzt wurde und was unverändert blieb.`
      );

      res.json({
        imageDataUrl: angleImages[0]?.imageDataUrl ?? null,
        angleImages,
        fallbackOnly: angleImages.every((a) => !a.imageDataUrl),
        imageWarning,
        changeSummary: summary.changeSummary,
        designNotes: summary.designNotes,
      });
    } catch (error) {
      const classified = classifyGeminiError(error);
      res.status(classified.status).json({ error: classified.message });
    }
  });

  app.post("/api/shopping-list", async (req: Request, res: Response) => {
    try {
      const {
        originalRoomDataUrls,
        originalRoomDataUrl,
        roomDimensions = "",
        approvedDraftDataUrls = [],
        approvedDraftDataUrl,
        initialInstructions = "",
        refinementHistory = [],
      } = req.body as {
        originalRoomDataUrls?: string[];
        originalRoomDataUrl?: string;
        roomDimensions?: string;
        approvedDraftDataUrls?: Array<string | null>;
        approvedDraftDataUrl?: string | null;
        initialInstructions?: string;
        refinementHistory?: string[];
      };

      const roomUrls = normalizeRoomUrls(originalRoomDataUrls, originalRoomDataUrl);
      if (roomUrls.length === 0) {
        res.status(400).json({ error: "Originalfotos des Zimmers fehlen." });
        return;
      }

      const draftUrls = (
        Array.isArray(approvedDraftDataUrls) && approvedDraftDataUrls.length > 0
          ? approvedDraftDataUrls
          : approvedDraftDataUrl
            ? [approvedDraftDataUrl]
            : []
      ).filter((u): u is string => Boolean(u));

      const ai = getAiClient();
      const roomInlines = roomUrls.map(parseDataUrl);
      const draftInlines = draftUrls.map(parseDataUrl);

      const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [
        ...roomInlines.map((img) => ({ inlineData: img })),
        ...draftInlines.map((img) => ({ inlineData: img })),
      ];

      const allInstructions = [initialInstructions, ...(refinementHistory || [])]
        .map((s) => s.trim())
        .filter(Boolean)
        .join("\n- ");

      const prompt = [
        draftInlines.length > 0
          ? `Die ersten ${roomInlines.length} Bild(er) zeigen das ursprüngliche Zimmer (Ist-Zustand). Die folgenden ${draftInlines.length} Bild(er) zeigen den freigegebenen Neuentwurf aus denselben Originalperspektiven.`
          : `Die ${roomInlines.length} Bild(er) zeigen das ursprüngliche Zimmer. Erstelle anhand der Gestaltungsvorgaben eine maßstabgetreue, realistische Einkaufsliste.`,
        roomDimensions.trim()
          ? `Raummaße laut Nutzer: ${roomDimensions.trim()}. Berücksichtige diese Abmessungen bei empfohlenen Möbelgrößen.`
          : "",
        allInstructions ? `Nutzervorgaben (inkl. zu behaltender Möbel):\n- ${allInstructions}` : "",
        "Aufgabe:",
        "1. Liste AUSSCHLIESSLICH neu hinzugefügte oder bewusst ausgetauschte/veränderte Einrichtungsgegenstände, Leuchten, Textilien, Wandfarben oder Deko-Objekte auf.",
        "2. Schließe explizit alle Möbel und Elemente aus, die laut Nutzervorgabe oder visuellem Vergleich unverändert beibehalten wurden (sofern nicht später geändert).",
        "3. Orientiere alle geschätzten Preisspannen in Euro (€) an günstigen, realistischen Budget-Optionen (z. B. IKEA, JYSK, Otto) und nenne zu den echten Raummaßen passende Abmessungen in der Beschreibung.",
        "4. Erstelle für jeden Artikel eine präzise deutsche Suchanfrage (`searchQuery`, 3–5 Wörter, z. B. 'Couchtisch rund Eiche') und eine kurze Secondhand-Suchanfrage (`secondhandQuery`, 2–3 Wörter).",
      ]
        .filter(Boolean)
        .join("\n\n");

      parts.push({ text: prompt });

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: TEXT_MODEL,
          contents: { parts },
          config: {
            systemInstruction:
              "Du bist ein kostensensibler deutscher Einrichtungsberater. Alle Texte, Kategorien, Produktbeschreibungen und Suchbegriffe müssen auf natürlichem Deutsch verfasst sein.",
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description:
                    "Kurze Einordnung des freigegebenen Entwurfs in 1–2 Sätzen auf Deutsch.",
                },
                keptItemsNote: {
                  type: Type.STRING,
                  description:
                    "Welche bestehenden Möbel oder Elemente bewusst beibehalten und daher von der Einkaufsliste ausgenommen wurden.",
                },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: {
                        type: Type.STRING,
                        description: "Klarer Produktname auf Deutsch.",
                      },
                      description: {
                        type: Type.STRING,
                        description:
                          "Kurze Beschreibung zu Material, Farbe und passenden Maßen für diesen Raum auf Deutsch.",
                      },
                      category: {
                        type: Type.STRING,
                        description: "Kategorie: Möbel, Beleuchtung, Textilien oder Wand & Dekor.",
                      },
                      estimatedMinEur: {
                        type: Type.INTEGER,
                        description: "Unterer geschätzter Budget-Preis in EUR (ganze Zahl).",
                      },
                      estimatedMaxEur: {
                        type: Type.INTEGER,
                        description: "Oberer geschätzter Budget-Preis in EUR (ganze Zahl).",
                      },
                      searchQuery: {
                        type: Type.STRING,
                        description:
                          "Prägnante deutsche Suchanfrage für IKEA, JYSK, Otto und Google Shopping.",
                      },
                      secondhandQuery: {
                        type: Type.STRING,
                        description: "Kurze Suchanfrage (2-3 Wörter) für Kleinanzeigen.",
                      },
                    },
                    required: [
                      "name",
                      "description",
                      "category",
                      "estimatedMinEur",
                      "estimatedMaxEur",
                      "searchQuery",
                    ],
                  },
                },
              },
              required: ["summary", "keptItemsNote", "items"],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? "{}").trim()) as {
        summary?: string;
        keptItemsNote?: string;
        items?: Array<{
          name: string;
          description: string;
          category: string;
          estimatedMinEur: number;
          estimatedMaxEur: number;
          searchQuery: string;
          secondhandQuery?: string;
        }>;
      };

      const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
      const items = rawItems.map((item, idx) => {
        const min = Math.max(5, Math.round(Number(item.estimatedMinEur) || 20));
        const max = Math.max(min, Math.round(Number(item.estimatedMaxEur) || min + 25));
        return {
          id: `item-${Date.now()}-${idx}`,
          name: item.name,
          description: item.description,
          category: item.category || "Einrichtung",
          estimatedMinEur: min,
          estimatedMaxEur: max,
          searchQuery: item.searchQuery,
          secondhandQuery: item.secondhandQuery || item.searchQuery,
        };
      });

      const totalMinEur = items.reduce((acc, item) => acc + item.estimatedMinEur, 0);
      const totalMaxEur = items.reduce((acc, item) => acc + item.estimatedMaxEur, 0);

      res.json({
        summary:
          parsed.summary ||
          "Auswahl der neu ergänzten und geänderten Elemente passend zu Ihren Raummaßen.",
        keptItemsNote:
          parsed.keptItemsNote ||
          "Beibehaltene Bestandsmöbel wurden nicht in die Einkaufsliste aufgenommen.",
        items,
        totalMinEur,
        totalMaxEur,
      });
    } catch (error) {
      const classified = classifyGeminiError(error);
      res.status(classified.status).json({ error: classified.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Raumstudio server listening on http://localhost:${port}`);
  });
}

startServer();
