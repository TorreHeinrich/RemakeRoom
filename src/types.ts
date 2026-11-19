export type SupportedAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface ImageAsset {
  id: string;
  dataUrl: string;
  name: string;
  aspectRatio?: SupportedAspectRatio;
}

export interface DraftAngleImage {
  angleIndex: number;
  label: string;
  imageDataUrl: string | null;
}

export interface RoomDraft {
  version: number;
  imageDataUrl: string | null;
  angleImages?: DraftAngleImage[];
  changeSummary: string;
  designNotes: string[];
  refinementPrompt: string;
  createdAt: string;
  fallbackOnly?: boolean;
}

export interface ShoppingItem {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedMinEur: number;
  estimatedMaxEur: number;
  searchQuery: string;
  secondhandQuery?: string;
}

export interface ShoppingListResult {
  approvedVersion: number;
  summary: string;
  keptItemsNote: string;
  items: ShoppingItem[];
  totalMinEur: number;
  totalMaxEur: number;
  generatedAt: string;
}

export interface SavedSession {
  originalRooms: ImageAsset[];
  originalRoom?: ImageAsset | null;
  roomDimensions: string;
  inspirations: ImageAsset[];
  keepAndAdjustText: string;
  drafts: RoomDraft[];
  activeDraftIndex: number;
  activeAngleIndex?: number;
  comparisonMode: 'after' | 'before';
  approvedVersion: number | null;
  shoppingList: ShoppingListResult | null;
  checkedItemIds: string[];
  includeSecondhand: boolean;
}
