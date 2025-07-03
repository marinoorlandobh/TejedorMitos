export interface Creation {
  id: string; // UUID
  name: string;
  type: 'generated' | 'analyzed' | 'reimagined';
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
  params: GeneratedParams | AnalyzedParams | ReimaginedParams;
  customCultureDetails?: string;
  originalImageFileName?: string;
  imageDimensions?: { width: number; height: number };
  imageId?: string; // FK to ImageDataStore
  originalImageId?: string; // FK to ImageDataStore, for 'reimagined' type (source image)
  outputId?: string; // FK to TextOutputStore
}

export interface GeneratedParams {
  culture: string;
  entity: string;
  details: string;
  style: string;
  aspectRatio: string;
  imageQuality: string;
}

export interface AnalyzedParams {
  mythologicalContext: string;
  entityTheme: string;
  additionalDetails?: string;
}

export interface ReimaginedParams {
  contextCulture: string;
  contextEntity: string;
  contextDetails: string;
  visualStyle: string;
  aspectRatio: string;
  imageQuality: string;
}

export interface ImageDataModel {
  id: string; // UUID
  imageDataUri: string; // Data URI
}

export interface TextOutputModel {
  id: string; // UUID
  data: GeneratedOutputData | AnalyzedOutputData | ReimaginedOutputData;
}

export interface GeneratedOutputData {
  prompt: string;
}

export interface AnalyzedOutputData {
  analysis: string;
  visualStyle: string;
}

export interface ReimaginedOutputData {
  derivedPrompt: string;
}

// For form validation and AI flow inputs/outputs, we can reuse/import from Zod schemas if defined elsewhere
// or create specific types here if needed. The AI flows already export their Zod-derived types.

export const MYTHOLOGICAL_CULTURES = ["Azteca", "Celta", "China", "Egipcia", "Griega", "Hebrea", "Hindú", "Inca", "Japonesa", "Maya", "Mesopotámica", "Nórdica", "Romana", "Personalizada"];
export const IMAGE_STYLES = ["Fotorrealista", "Anime", "Pintura al Óleo", "Acuarela", "Abstracto", "Pixel Art", "Cómic", "Steampunk", "Cyberpunk", "Arte Fantástico"];
export const ASPECT_RATIOS = ["1:1 (Cuadrado)", "16:9 (Panorámico)", "9:16 (Vertical)", "4:3 (Estándar)", "3:4 (Vertical Estándar)"];
export const IMAGE_QUALITIES = ["Estándar", "Alta", "Ultra"];

// Helper to map aspect ratio string to numerical values if needed for generation
export const mapAspectRatio = (aspectRatioString: string): { width: number, height: number } | undefined => {
  switch (aspectRatioString) {
    case "1:1 (Cuadrado)": return { width: 1, height: 1 };
    case "16:9 (Panorámico)": return { width: 16, height: 9 };
    case "9:16 (Vertical)": return { width: 9, height: 16 };
    case "4:3 (Estándar)": return { width: 4, height: 3 };
    case "3:4 (Vertical Estándar)": return { width: 3, height: 4 };
    default: return undefined;
  }
};
