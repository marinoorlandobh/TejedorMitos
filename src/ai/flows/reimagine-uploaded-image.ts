'use server';

/**
 * @fileOverview AI flow for reimaging an uploaded image with a different style or parameters.
 *
 * - reimagineUploadedImage - A function that handles the image reimagination process.
 * - ReimagineUploadedImageInput - The input type for the reimagineUploadedImage function.
 * - ReimagineUploadedImageOutput - The return type for the reimagineUploadedImage function.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { mapAspectRatioToDimensions, mapQualityToSteps } from '@/lib/utils';

const ReimagineUploadedImageInputSchema = z.object({
  originalImage: z
    .string()
    .describe(
      "The original image to reimagine, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'.",
    ),
  contextCulture: z.string().describe('The mythological culture context for the image.'),
  contextEntity: z.string().describe('The mythological entity/theme for the image.'),
  contextDetails: z.string().describe('Additional details about the image context.'),
  visualStyle: z.string().describe('The new visual style for the reimagined image.'),
  aspectRatio: z.string().describe('The aspect ratio for the reimagined image.'),
  imageQuality: z.string().describe('The quality of the reimagined image.'),
  provider: z.enum(['google-ai', 'stable-diffusion']).describe('The image generation provider to use.'),
});

export type ReimagineUploadedImageInput = z.infer<typeof ReimagineUploadedImageInputSchema>;

const ReimagineUploadedImageOutputSchema = z.object({
  reimaginedImage: z
    .string()
    .describe(
      "The reimagined image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'.",
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
  Image Quality: {{{imageQuality}}}

  Based on the above information, create a detailed prompt to generate a reimagined version of the image.
  The prompt should be descriptive and consider the new visual style and desired image quality.
  Return ONLY the derived prompt. Do not include any other text or explanation.
  Derived Prompt:`,
});

async function reimagineWithGoogleAI(derivedPrompt: string, input: ReimagineUploadedImageInput) {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: [
        {media: {url: input.originalImage}},
        {text: derivedPrompt},
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        safetySettings: [
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
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
        'La reimaginación de la imagen falló, probablemente por infringir las políticas de seguridad. Intenta con un prompt o estilo diferente que sea menos explícito en su descripción.'
      );
    }
    return media.url;
}


async function reimagineWithStableDiffusion(derivedPrompt: string, input: ReimagineUploadedImageInput) {
    const apiUrl = process.env.NEXT_PUBLIC_STABLE_DIFFUSION_API_URL || 'http://host.docker.internal:7860';

    const dimensions = mapAspectRatioToDimensions(input.aspectRatio);
    const steps = mapQualityToSteps(input.imageQuality);

    // For img2img, the original image must not include the 'data:image/png;base64,' prefix.
    const base64Image = input.originalImage.split(',')[1];
    
    const payload = {
        init_images: [base64Image],
        prompt: derivedPrompt,
        negative_prompt: "ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, bad anatomy, watermark, signature, cut off, low contrast, underexposed, overexposed, bad art, beginner, amateur, distorted face, blurry, draft, grainy",
        seed: -1,
        sampler_name: "DPM++ 2M Karras",
        batch_size: 1,
        n_iter: 1,
        steps: steps,
        cfg_scale: 7,
        width: dimensions.width,
        height: dimensions.height,
        restore_faces: true,
        denoising_strength: 0.75, // Important for img2img
    };

    try {
        const response = await fetch(`${apiUrl}/sdapi/v1/img2img`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error de la API de Stable Diffusion (img2img): ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        
        if (!result.images || result.images.length === 0) {
            throw new Error("La API de Stable Diffusion (img2img) no devolvió ninguna imagen.");
        }

        return `data:image/png;base64,${result.images[0]}`;
    } catch (e: any) {
        if (e.message.includes('fetch failed')) {
            throw new Error(`No se pudo conectar a la API de Stable Diffusion en ${apiUrl}. ¿Está el servidor en ejecución con el argumento --api?`);
        }
        throw e;
    }
}


const reimagineUploadedImageFlow = ai.defineFlow(
  {
    name: 'reimagineUploadedImageFlow',
    inputSchema: ReimagineUploadedImageInputSchema,
    outputSchema: ReimagineUploadedImageOutputSchema,
  },
  async input => {
    const {output: {derivedPrompt}} = await reimagineImagePrompt(input);
    
    let reimaginedImage: string;

    if (input.provider === 'stable-diffusion') {
        reimaginedImage = await reimagineWithStableDiffusion(derivedPrompt, input);
    } else {
        reimaginedImage = await reimagineWithGoogleAI(derivedPrompt, input);
    }

    return {reimaginedImage, derivedPrompt};
  }
);
