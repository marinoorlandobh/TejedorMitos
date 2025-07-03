
// src/lib/actions.ts
"use server";

import { generateMythImage as generateMythImageFlow, type GenerateMythImageInput, type GenerateMythImageOutput } from "@/ai/flows/generate-myth-image";
import { analyzeUploadedImage as analyzeUploadedImageFlow, type AnalyzeUploadedImageInput, type AnalyzeUploadedImageOutput } from "@/ai/flows/analyze-uploaded-image";
import { reimagineUploadedImage as reimagineUploadedImageFlow, type ReimagineUploadedImageInput, type ReimagineUploadedImageOutput } from "@/ai/flows/reimagine-uploaded-image";
import { extractMythologiesFromText as extractMythologiesFlow, type ExtractMythologiesInput, type ExtractMythologiesOutput } from "@/ai/flows/extract-mythologies-flow";
import { extractDetailsFromPrompt as extractDetailsFromPromptFlow, type ExtractDetailsInput, type ExtractDetailsOutput } from "@/ai/flows/extract-details-from-prompt";

export async function generateMythImageAction(input: GenerateMythImageInput): Promise<GenerateMythImageOutput> {
  try {
    // Add any necessary validation or pre-processing here
    const result = await generateMythImageFlow(input);
    return result;
  } catch (error) {
    console.error("Error in generateMythImageAction:", error);
    throw new Error("Failed to generate image. Please try again.");
  }
}

export async function analyzeUploadedImageAction(input: AnalyzeUploadedImageInput): Promise<AnalyzeUploadedImageOutput> {
  try {
    const result = await analyzeUploadedImageFlow(input);
    return result;
  } catch (error) {
    console.error("Error in analyzeUploadedImageAction:", error);
    throw new Error("Failed to analyze image. Please try again.");
  }
}

export async function reimagineUploadedImageAction(input: ReimagineUploadedImageInput): Promise<ReimagineUploadedImageOutput> {
  try {
    const result = await reimagineUploadedImageFlow(input);
    return result;
  } catch (error) {
    console.error("Error in reimagineUploadedImageAction:", error);
    throw new Error("Failed to reimagine image. Please try again.");
  }
}

export async function extractMythologiesAction(input: ExtractMythologiesInput): Promise<ExtractMythologiesOutput> {
  try {
    const result = await extractMythologiesFlow(input);
    return result;
  } catch (error) {
    console.error("Error in extractMythologiesAction:", error);
    throw new Error("Failed to extract mythologies from text. Please try again.");
  }
}

export async function extractDetailsFromPromptAction(input: ExtractDetailsInput): Promise<ExtractDetailsOutput> {
  try {
    const result = await extractDetailsFromPromptFlow(input);
    return result;
  } catch (error) {
    console.error("Error in extractDetailsFromPromptAction:", error);
    throw new Error("Failed to extract details from prompt. Please try again.");
  }
}
