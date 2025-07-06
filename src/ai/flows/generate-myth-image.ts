'use server';

/**
 * @fileOverview A flow for generating images based on mythological themes.
 *
 * - generateMythImage - A function that generates an image based on a mythological theme.
 * - GenerateMythImageInput - The input type for the generateMythImage function.
 * - GenerateMythImageOutput - The return type for the generateMythImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateMythImageInputSchema = z.object({
  culture: z
    .string()
    .describe('The mythological culture to use (e.g., Greek, Norse, Egyptian).'),
  entity: z.string().describe('The main entity or theme (e.g., Zeus, Phoenix).'),
  details: z.string().describe('Descriptive details to enrich the image (e.g., holding a lightning bolt).'),
  style: z.string().describe('The visual style (e.g., Photorealistic, Anime, Oil Painting).'),
  aspectRatio: z.string().describe('The aspect ratio of the image.'),
  imageQuality: z.string().describe('The quality of the image.'),
});

export type GenerateMythImageInput = z.infer<typeof GenerateMythImageInputSchema>;

const GenerateMythImageOutputSchema = z.object({
  imageUrl: z.string().describe('The generated image as a data URI.'),
  prompt: z.string().describe('The prompt used to generate the image.'),
});

export type GenerateMythImageOutput = z.infer<typeof GenerateMythImageOutputSchema>;

export async function generateMythImage(input: GenerateMythImageInput): Promise<GenerateMythImageOutput> {
  return generateMythImageFlow(input);
}

const generateMythImageFlow = ai.defineFlow(
  {
    name: 'generateMythImageFlow',
    inputSchema: GenerateMythImageInputSchema,
    outputSchema: GenerateMythImageOutputSchema,
  },
  async input => {
    // A more descriptive prompt to guide the model better.
    const fullPrompt = `A visually rich image in the style of ${input.style}. The primary subject is the entity '${input.entity}' from ${input.culture} mythology. Key scene details include: ${input.details}. The desired aspect ratio is ${input.aspectRatio} and the image quality should be ${input.imageQuality}.`;

    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: fullPrompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        safetySettings: [
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_ONLY_HIGH',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_ONLY_HIGH',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_ONLY_HIGH',
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
        ],
      },
    });

    if (!media?.url) {
      throw new Error(
        "La IA no pudo generar una imagen para este prompt. Puede infringir las políticas de seguridad. Intenta con la opción 'Corregir con IA' o modifica el prompt."
      );
    }

    return {
      imageUrl: media.url,
      prompt: fullPrompt,
    };
  }
);
