
// src/lib/actions.ts
"use server";

import { generateMythImage as generateMythImageFlow, type GenerateMythImageInput, type GenerateMythImageOutput } from "@/ai/flows/generate-myth-image";
import { analyzeUploadedImage as analyzeUploadedImageFlow, type AnalyzeUploadedImageInput, type AnalyzeUploadedImageOutput } from "@/ai/flows/analyze-uploaded-image";
import { reimagineUploadedImage as reimagineUploadedImageFlow, type ReimagineUploadedImageInput, type ReimagineUploadedImageOutput } from "@/ai/flows/reimagine-uploaded-image";
import { extractMythologiesFromText as extractMythologiesFlow, type ExtractMythologiesInput, type ExtractMythologiesOutput } from "@/ai/flows/extract-mythologies-flow";
import { extractDetailsFromPrompt as extractDetailsFromPromptFlow, type ExtractDetailsInput, type ExtractDetailsOutput } from "@/ai/flows/extract-details-from-prompt";
import { fixImagePrompt as fixImagePromptFlow, type FixImagePromptInput, type FixImagePromptOutput } from "@/ai/flows/fix-image-prompt";
import { translateText as translateTextFlow, type TranslateTextInput, type TranslateTextOutput } from "@/ai/flows/translate-text-flow";


export async function generateMythImageAction(input: GenerateMythImageInput): Promise<GenerateMythImageOutput> {
  try {
    const result = await generateMythImageFlow(input);
    return result;
  } catch (error: any) {
    console.error("Error in generateMythImageAction:", error);
    if (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota'))) {
        throw new Error("Has excedido tu cuota de generación de imágenes. Por favor, inténtalo de nuevo más tarde o revisa tu plan.");
    }
    // Propagate the specific error message from the flow
    throw new Error(error.message || "Failed to generate image. Please try again.");
  }
}

export async function analyzeUploadedImageAction(input: AnalyzeUploadedImageInput): Promise<AnalyzeUploadedImageOutput> {
  try {
    const result = await analyzeUploadedImageFlow(input);
    return result;
  } catch (error: any) {
    console.error("Error in analyzeUploadedImageAction:", error);
    if (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota'))) {
        throw new Error("Has excedido tu cuota de análisis de API. Por favor, inténtalo de nuevo más tarde o revisa tu plan.");
    }
    throw new Error(error.message || "Failed to analyze image. Please try again.");
  }
}

export async function reimagineUploadedImageAction(input: ReimagineUploadedImageInput): Promise<ReimagineUploadedImageOutput> {
  try {
    const result = await reimagineUploadedImageFlow(input);
    return result;
  } catch (error: any) {
    console.error("Error in reimagineUploadedImageAction:", error);
    if (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota'))) {
        throw new Error("Has excedido tu cuota de generación de imágenes. Por favor, inténtalo de nuevo más tarde o revisa tu plan.");
    }
    throw new Error(error.message || "Failed to reimagine image. Please try again.");
  }
}

export async function extractMythologiesAction(input: ExtractMythologiesInput): Promise<ExtractMythologiesOutput> {
  try {
    const result = await extractMythologiesFlow(input);
    return result;
  } catch (error: any) {
    console.error("Error in extractMythologiesAction:", error);
     if (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota'))) {
        throw new Error("Has excedido tu cuota de API. Por favor, inténtalo de nuevo más tarde o revisa tu plan.");
    }
    throw new Error(error.message || "Failed to extract mythologies from text. Please try again.");
  }
}

export async function extractDetailsFromPromptAction(input: ExtractDetailsInput): Promise<ExtractDetailsOutput> {
  try {
    const result = await extractDetailsFromPromptFlow(input);
    return result;
  } catch (error: any) {
    console.error("Error in extractDetailsFromPromptAction:", error);
    if (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota'))) {
        throw new Error("Has excedido tu cuota de API. Por favor, inténtalo de nuevo más tarde o revisa tu plan.");
    }
    throw new Error(error.message || "No se pudieron extraer los detalles del prompt. Por favor, inténtalo de nuevo.");
  }
}

export async function fixImagePromptAction(input: FixImagePromptInput): Promise<FixImagePromptOutput> {
  try {
    const result = await fixImagePromptFlow(input);
    return result;
  } catch (error: any) {
    console.error("Error in fixImagePromptAction:", error);
     if (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota'))) {
        throw new Error("Has excedido tu cuota de API. Por favor, inténtalo de nuevo más tarde o revisa tu plan.");
    }
    // Propagate the specific error message from the flow
    throw new Error(error.message || "Failed to fix prompt with AI. Please try again.");
  }
}

export async function translateTextAction(input: TranslateTextInput): Promise<TranslateTextOutput> {
  try {
    const result = await translateTextFlow(input);
    return result;
  } catch (error: any) {
    console.error("Error in translateTextAction:", error);
    if (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota'))) {
      throw new Error("Has excedido tu cuota de API. Por favor, inténtalo de nuevo más tarde o revisa tu plan.");
    }
    throw new Error(error.message || "No se pudo traducir el texto. Por favor, inténtalo de nuevo.");
  }
}
