"use client";

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Wand2, Loader2, Eye, Copy } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useHistory } from '@/contexts/HistoryContext';
import { useToast } from '@/hooks/use-toast';
import { generateMythImageAction } from '@/lib/actions';
import type { GeneratedParams } from '@/lib/types';
import { MYTHOLOGICAL_CULTURES, IMAGE_STYLES, ASPECT_RATIOS, IMAGE_QUALITIES } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

const createMythSchema = z.object({
  name: z.string().min(1, "Creation name is required.").max(100),
  culture: z.string().min(1, "Mythological culture is required."),
  customCultureDetails: z.string().optional(),
  entity: z.string().min(1, "Entity/Theme is required.").max(150),
  details: z.string().min(1, "Descriptive details are required.").max(1000),
  style: z.string().min(1, "Visual style is required."),
  aspectRatio: z.string().min(1, "Aspect ratio is required."),
  imageQuality: z.string().min(1, "Image quality is required."),
});

type CreateMythFormData = z.infer<typeof createMythSchema>;

export default function CreateMythPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const { addCreation } = useHistory();
  const { toast } = useToast();

  const form = useForm<CreateMythFormData>({
    resolver: zodResolver(createMythSchema),
    defaultValues: {
      name: '',
      culture: MYTHOLOGICAL_CULTURES[0],
      customCultureDetails: '',
      entity: '',
      details: '',
      style: IMAGE_STYLES[0],
      aspectRatio: ASPECT_RATIOS[0],
      imageQuality: IMAGE_QUALITIES[0],
    },
  });

  const selectedCulture = form.watch('culture');

  async function onSubmit(data: CreateMythFormData) {
    setIsLoading(true);
    setGeneratedImage(null);
    setGeneratedPrompt(null);

    const aiInputParams: GeneratedParams = {
      culture: data.culture === 'Custom' ? data.customCultureDetails || 'Custom' : data.culture,
      entity: data.entity,
      details: data.details,
      style: data.style,
      aspectRatio: data.aspectRatio,
      imageQuality: data.imageQuality,
    };

    try {
      const result = await generateMythImageAction(aiInputParams);
      setGeneratedImage(result.imageUrl);
      setGeneratedPrompt(result.prompt);

      await addCreation(
        'generated',
        data.name,
        aiInputParams,
        { prompt: result.prompt },
        result.imageUrl
      );
      toast({ title: "Myth Created!", description: "Your creation has been saved to your gallery." });
    } catch (error: any) {
      console.error("Error generating myth:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to create myth." });
    } finally {
      setIsLoading(false);
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Prompt copied to clipboard." });
  };

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
            <Wand2 className="mr-3 h-10 w-10" />
            Create Your Myth
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Bring your mythological visions to life. Describe your concept, and let AI weave the imagery.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Describe Your Vision</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Creation Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Zeus's Thunder, Forest Spirit" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="culture"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mythological Culture</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a culture" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {MYTHOLOGICAL_CULTURES.map(culture => (
                                <SelectItem key={culture} value={culture}>{culture}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {selectedCulture === 'Custom' && (
                      <FormField
                        control={form.control}
                        name="customCultureDetails"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Culture Details</FormLabel>
                            <FormControl>
                              <Input placeholder="Describe your custom culture" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                   <FormField
                    control={form.control}
                    name="entity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entity / Theme</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Zeus, Phoenix, World Tree" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descriptive Details</FormLabel>
                        <FormControl>
                          <Textarea placeholder="e.g., Holding a lightning bolt, surrounded by swirling nebulae, ancient ruins in a misty forest..." {...field} rows={4} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="style"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Visual Style</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select a style" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {IMAGE_STYLES.map(style => (
                                <SelectItem key={style} value={style}>{style}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="aspectRatio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aspect Ratio</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select aspect ratio" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ASPECT_RATIOS.map(ratio => (
                                <SelectItem key={ratio} value={ratio}>{ratio}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                      control={form.control}
                      name="imageQuality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Image Quality</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select image quality" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {IMAGE_QUALITIES.map(quality => (
                                <SelectItem key={quality} value={quality}>{quality}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    Weave My Myth
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="shadow-lg flex flex-col">
            <CardHeader>
              <CardTitle>Your Woven Myth</CardTitle>
              <CardDescription>The AI's interpretation of your vision will appear here.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center justify-center">
              {isLoading && (
                <div className="flex flex-col items-center text-muted-foreground">
                  <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                  <p className="text-lg">Weaving your myth... please wait.</p>
                </div>
              )}
              {!isLoading && generatedImage && (
                <div className="w-full">
                  <Image
                    src={generatedImage}
                    alt="Generated mythological image"
                    width={512}
                    height={512}
                    className="rounded-lg object-contain max-h-[400px] w-auto mx-auto shadow-md"
                    data-ai-hint="mythological art"
                  />
                </div>
              )}
              {!isLoading && !generatedImage && (
                <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                  <Eye className="h-12 w-12 mx-auto mb-2" />
                  <p>Your creation will be displayed here once generated.</p>
                </div>
              )}
            </CardContent>
            {generatedPrompt && !isLoading && (
              <CardFooter className="flex-col items-start gap-2 border-t pt-4">
                <h3 className="font-semibold">Generated Prompt:</h3>
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md break-words">{generatedPrompt}</p>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedPrompt)}>
                  <Copy className="mr-2 h-4 w-4" /> Copy Prompt
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
