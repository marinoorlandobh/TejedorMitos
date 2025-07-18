
"use server";

import { generateMythImage as generateMythImageFlow, type GenerateMythImageOutput } from "@/ai/flows/generate-myth-image";
import { analyzeUploadedImage as analyzeUploadedImageFlow, type AnalyzeUploadedImageInput, type AnalyzeUploadedImageOutput } from "@/ai/flows/analyze-uploaded-image";
import { reimagineUploadedImage as reimagineUploadedImageFlow, type ReimagineUploadedImageInput, type ReimagineUploadedImageOutput } from "@/ai/flows/reimagine-uploaded-image";
import { extractMythologiesFromText as extractMythologiesFlow, type ExtractMythologiesInput, type ExtractMythologiesOutput } from "@/ai/flows/extract-mythologies-flow";
import { fixImagePrompt as fixImagePromptFlow, type FixImagePromptInput, type FixImagePromptOutput } from "@/ai/flows/fix-image-prompt";
import { translateText as translateTextFlow, type TranslateTextInput, type TranslateTextOutput } from "@/ai/flows/translate-text-flow";
import { translateCreationDetails as translateCreationDetailsFlow, type TranslateCreationDetailsInput, type TranslateCreationDetailsOutput } from "@/ai/flows/translate-creation-details-flow";
import { regenerateCreationName as regenerateCreationNameFlow, type RegenerateCreationNameInput, type RegenerateCreationNameOutput } from "@/ai/flows/regenerate-creation-name-flow";
import type { GeneratedParams } from "./types";

// Helper for exponential backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const handleActionError = (error: any, defaultMessage: string) => {
    console.error(`Error in action:`, error);
    throw new Error(error.message || defaultMessage);
};

export async function generateMythImageAction(input: GeneratedParams): Promise<GenerateMythImageOutput> {
  try {
    const result = await generateMythImageFlow(input);
    return result;
  } catch (error: any) {
    handleActionError(error, "Failed to generate image with Google AI.");
  }
}

export async function analyzeUploadedImageAction(input: AnalyzeUploadedImageInput): Promise<AnalyzeUploadedImageOutput> {
  try {
    const result = await analyzeUploadedImageFlow(input);
    return result;
  } catch (error: any) {
    handleActionError(error, "Failed to analyze image.");
  }
}

export async function reimagineUploadedImageAction(input: ReimagineUploadedImageInput): Promise<ReimagineUploadedImageOutput> {
  try {
    const result = await reimagineUploadedImageFlow(input);
    return result;
  } catch (error: any) {
    handleActionError(error, "Failed to reimagine image with Google AI.");
  }
}

export async function extractMythologiesAction(input: ExtractMythologiesInput): Promise<ExtractMythologiesOutput> {
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      const result = await extractMythologiesFlow(input);
      return result;
    } catch (error: any) {
      const isQuotaError = error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota'));
      
      if (isQuotaError && retries < maxRetries - 1) {
        retries++;
        const waitTime = Math.pow(2, retries) * 1000; // 2s, 4s
        console.log(`Quota error in extractMythologiesAction. Retrying in ${waitTime / 1000}s... (Attempt ${retries}/${maxRetries})`);
        await delay(waitTime);
      } else {
        handleActionError(error, "No se pudieron extraer las mitologías del texto.");
      }
    }
  }
  // This part should not be reachable if logic is correct, but as a fallback:
  throw new Error("No se pudieron extraer las mitologías del texto tras varios intentos.");
}

export async function fixImagePromptAction(input: FixImagePromptInput): Promise<FixImagePromptOutput> {
  try {
    const result = await fixImagePromptFlow(input);
    return result;
  } catch (error: any) {
    handleActionError(error, "Failed to fix prompt with AI.");
  }
}

export async function translateTextAction(input: TranslateTextInput): Promise<TranslateTextOutput> {
  try {
    const result = await translateTextFlow(input);
    return result;
  } catch (error: any) {
    handleActionError(error, "No se pudo traducir el texto.");
  }
}

export async function translateCreationDetailsAction(input: TranslateCreationDetailsInput): Promise<TranslateCreationDetailsOutput> {
  try {
    const result = await translateCreationDetailsFlow(input);
    return result;
  } catch (error: any) {
    handleActionError(error, "No se pudieron traducir los detalles de la creación.");
  }
}

export async function regenerateCreationNameAction(input: RegenerateCreationNameInput): Promise<RegenerateCreationNameOutput> {
  try {
    const result = await regenerateCreationNameFlow(input);
    return result;
  } catch (error: any) {
    handleActionError(error, "No se pudo regenerar el nombre de la creación.");
  }
}
