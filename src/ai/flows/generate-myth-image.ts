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
import { mapAspectRatioToDimensions, mapQualityToSteps } from '@/lib/utils';

const GenerateMythImageInputSchema = z.object({
  culture: z
    .string()
    .describe('The mythological culture to use (e.g., Greek, Norse, Egyptian).'),
  entity: z.string().describe('The main entity or theme (e.g., Zeus, Phoenix).'),
  details: z.string().describe('Descriptive details to enrich the image (e.g., holding a lightning bolt).'),
  style: z.string().describe('The visual style (e.g., Photorealistic, Anime, Oil Painting).'),
  aspectRatio: z.string().describe('The aspect ratio of the image.'),
  imageQuality: z.string().describe('The quality of the image.'),
  provider: z.enum(['google-ai', 'stable-diffusion']).describe('The image generation provider to use.'),
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

async function generateWithGoogleAI(prompt: string, aspectRatio: string) {
    const aspectRatioForApi = aspectRatio.split(' ')[0];

    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: prompt,
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
        "La generación de imagen falló, probablemente por infringir las políticas de seguridad del modelo. Esto puede ocurrir con escenas de batalla o desnudos artísticos. Intenta usar la opción 'Corregir con IA' para reescribir el prompt o modifícalo manualmente para que sea más descriptivo y menos explícito."
      );
    }
    return media.url;
}

async function generateWithStableDiffusion(prompt: string, input: GenerateMythImageInput) {
    const apiUrl = process.env.NEXT_PUBLIC_STABLE_DIFFUSION_API_URL;
    if (!apiUrl) {
        throw new Error("La URL de la API de Stable Diffusion no está configurada. Por favor, define NEXT_PUBLIC_STABLE_DIFFUSION_API_URL en tu archivo .env.local.");
    }
    
    const dimensions = mapAspectRatioToDimensions(input.aspectRatio);
    const steps = mapQualityToSteps(input.imageQuality);

    const payload = {
        prompt: prompt,
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
    };

    try {
        const response = await fetch(`${apiUrl}/sdapi/v1/txt2img`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error de la API de Stable Diffusion: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        
        if (!result.images || result.images.length === 0) {
            throw new Error("La API de Stable Diffusion no devolvió ninguna imagen.");
        }

        return `data:image/png;base64,${result.images[0]}`;
    } catch (e: any) {
        if (e.message.includes('fetch failed')) {
            throw new Error(`No se pudo conectar a la API de Stable Diffusion en ${apiUrl}. ¿Está el servidor en ejecución con el argumento --api?`);
        }
        throw e;
    }
}


const generateMythImageFlow = ai.defineFlow(
  {
    name: 'generateMythImageFlow',
    inputSchema: GenerateMythImageInputSchema,
    outputSchema: GenerateMythImageOutputSchema,
  },
  async input => {
    // A more descriptive prompt to guide the model better.
    const fullPrompt = `A visually rich image in the style of ${input.style}. The primary subject is the entity '${input.entity}' from ${input.culture} mythology. Key scene details include: ${input.details}. The desired image quality is ${input.imageQuality}.`;
    
    let imageUrl: string;

    if (input.provider === 'stable-diffusion') {
        imageUrl = await generateWithStableDiffusion(fullPrompt, input);
    } else {
        imageUrl = await generateWithGoogleAI(fullPrompt, input.aspectRatio);
    }

    return {
      imageUrl: imageUrl,
      prompt: fullPrompt,
    };
  }
);
