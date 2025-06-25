// 'use server';

/**
 * @fileOverview AI flow for reimaging an uploaded image with a different style or parameters.
 *
 * - reimagineUploadedImage - A function that handles the image reimagination process.
 * - ReimagineUploadedImageInput - The input type for the reimagineUploadedImage function.
 * - ReimagineUploadedImageOutput - The return type for the reimagineUploadedImage function.
 */

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ReimagineUploadedImageInputSchema = z.object({
  originalImage: z
    .string()
    .describe(
      'The original image to reimagine, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // Corrected typo here
    ),
  contextCulture: z.string().describe('The mythological culture context for the image.'),
  contextEntity: z.string().describe('The mythological entity/theme for the image.'),
  contextDetails: z.string().describe('Additional details about the image context.'),
  visualStyle: z.string().describe('The new visual style for the reimagined image.'),
  aspectRatio: z.string().describe('The aspect ratio for the reimagined image.'),
  imageQuality: z.string().describe('The quality of the reimagined image.'),
});

export type ReimagineUploadedImageInput = z.infer<typeof ReimagineUploadedImageInputSchema>;

const ReimagineUploadedImageOutputSchema = z.object({
  reimaginedImage: z
    .string()
    .describe(
      'The reimagined image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
  derivedPrompt: z.string().describe('The prompt derived by the AI to create the reimagined image.'),
});

export type ReimagineUploadedImageOutput = z.infer<typeof ReimagineUploadedImageOutputSchema>;

export async function reimagineUploadedImage(
  input: ReimagineUploadedImageInput
): Promise<ReimagineUploadedImageOutput> {
  return reimagineUploadedImageFlow(input);
}

const reimagineImagePrompt = ai.definePrompt({
  name: 'reimagineImagePrompt',
  input: {schema: ReimagineUploadedImageInputSchema},
  output: {schema: z.object({derivedPrompt: z.string()})},
  prompt: `You are an AI assistant that helps reimagine images in a mythological context.
  Analyze the original image provided, considering the context culture, entity, and details.
  Derive a descriptive prompt that captures the essence of the original image within the specified mythological context and style.
  Original Image: {{media url=originalImage}}
  Context Culture: {{{contextCulture}}}
  Context Entity: {{{contextEntity}}}
  Context Details: {{{contextDetails}}}
  New Visual Style: {{{visualStyle}}}
  Aspect Ratio: {{{aspectRatio}}}
  Image Quality: {{{imageQuality}}}

  Based on the above information, create a detailed prompt to generate a reimagined version of the image.
  The prompt should be descriptive and consider the new visual style, aspect ratio and desired image quality.
  Return ONLY the derived prompt. Do not include any other text or explanation.
  Derived Prompt:`, // Ensure clear instructions for the LLM
});

const reimagineUploadedImageFlow = ai.defineFlow(
  {
    name: 'reimagineUploadedImageFlow',
    inputSchema: ReimagineUploadedImageInputSchema,
    outputSchema: ReimagineUploadedImageOutputSchema,
  },
  async input => {
    const {output: {derivedPrompt}} = await reimagineImagePrompt(input);

    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: [
        {media: {url: input.originalImage}},
        {text: derivedPrompt},
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    return {reimaginedImage: media.url, derivedPrompt};
  }
);
