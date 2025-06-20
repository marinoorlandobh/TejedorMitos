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

const prompt = ai.definePrompt({
  name: 'generateMythImagePrompt',
  input: {schema: GenerateMythImageInputSchema},
  output: {schema: GenerateMythImageOutputSchema},
  prompt: `Generate an image based on the following mythological theme:\n\nCulture: {{{culture}}}\nEntity/Theme: {{{entity}}}\nDetails: {{{details}}}\nStyle: {{{style}}}\nAspect Ratio: {{{aspectRatio}}}\nImage Quality: {{{imageQuality}}}`,
});

const generateMythImageFlow = ai.defineFlow(
  {
    name: 'generateMythImageFlow',
    inputSchema: GenerateMythImageInputSchema,
    outputSchema: GenerateMythImageOutputSchema,
  },
  async input => {
    // IMPORTANT: ONLY the googleai/gemini-2.0-flash-exp model is able to generate images.
    // You MUST use exactly this model to generate images.
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: `Culture: ${input.culture}, Entity/Theme: ${input.entity}, Details: ${input.details}, Style: ${input.style}, Aspect Ratio: ${input.aspectRatio}, Image Quality: ${input.imageQuality}`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE, IMAGE only won't work
      },
    });

    return {
      imageUrl: media.url,
      prompt: `Culture: ${input.culture}, Entity/Theme: ${input.entity}, Details: ${input.details}, Style: ${input.style}, Aspect Ratio: ${input.aspectRatio}, Image Quality: ${input.imageQuality}`,
    };
  }
);
