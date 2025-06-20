// src/lib/actions.ts
"use server";

import { generateMythImage as generateMythImageFlow, type GenerateMythImageInput, type GenerateMythImageOutput } from "@/ai/flows/generate-myth-image";
import { analyzeUploadedImage as analyzeUploadedImageFlow, type AnalyzeUploadedImageInput, type AnalyzeUploadedImageOutput } from "@/ai/flows/analyze-uploaded-image";
import { reimagineUploadedImage as reimagineUploadedImageFlow, type ReimagineUploadedImageInput, type ReimagineUploadedImageOutput } from "@/ai/flows/reimagine-uploaded-image";

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
