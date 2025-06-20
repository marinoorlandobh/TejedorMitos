// src/ai/flows/analyze-uploaded-image.ts
'use server';

/**
 * @fileOverview Analyzes an uploaded image for its style and mythological connections.
 *
 * - analyzeUploadedImage - A function that handles the image analysis process.
 * - AnalyzeUploadedImageInput - The input type for the analyzeUploadedImage function.
 * - AnalyzeUploadedImageOutput - The return type for the analyzeUploadedImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const AnalyzeUploadedImageInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "The image to analyze, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  mythologicalContext: z.string().describe('The mythological context to consider for the analysis.'),
  entityTheme: z.string().describe('The entity or theme to consider for the analysis.'),
  additionalDetails: z.string().optional().describe('Any additional details or context for the image.'),
});
export type AnalyzeUploadedImageInput = z.infer<typeof AnalyzeUploadedImageInputSchema>;

const AnalyzeUploadedImageOutputSchema = z.object({
  analysis: z.string().describe('A detailed analysis of the image and its mythological connections.'),
  visualStyle: z.string().describe('The primary visual style of the image.'),
});
export type AnalyzeUploadedImageOutput = z.infer<typeof AnalyzeUploadedImageOutputSchema>;

export async function analyzeUploadedImage(input: AnalyzeUploadedImageInput): Promise<AnalyzeUploadedImageOutput> {
  return analyzeUploadedImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeUploadedImagePrompt',
  input: {schema: AnalyzeUploadedImageInputSchema},
  output: {schema: AnalyzeUploadedImageOutputSchema},
  prompt: `You are an art expert with extensive knowledge of mythology.

  Analyze the provided image and identify its visual style and possible mythological connections, based on the provided context.

  Image: {{media url=imageDataUri}}
  Mythological Context: {{{mythologicalContext}}}
  Entity/Theme: {{{entityTheme}}}
  Additional Details: {{{additionalDetails}}}

  Provide a detailed analysis and identify the primary visual style.
  `,
});

const analyzeUploadedImageFlow = ai.defineFlow(
  {
    name: 'analyzeUploadedImageFlow',
    inputSchema: AnalyzeUploadedImageInputSchema,
    outputSchema: AnalyzeUploadedImageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
