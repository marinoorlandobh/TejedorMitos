import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const mapAspectRatioToDimensions = (aspectRatioString: string): { width: number; height: number } => {
  // Default to a sensible value like 512x512 if mapping fails
  const baseSize = 512;
  const highResBase = 768;

  switch (aspectRatioString) {
    case "1:1 (Cuadrado)": return { width: highResBase, height: highResBase };
    case "16:9 (Panorámico)": return { width: Math.round(highResBase * 16/9), height: highResBase };
    case "9:16 (Vertical)": return { width: highResBase, height: Math.round(highResBase * 16/9) };
    case "4:3 (Estándar)": return { width: Math.round(highResBase * 4/3), height: highResBase };
    case "3:4 (Vertical Estándar)": return { width: highResBase, height: Math.round(highResBase * 4/3) };
    default: return { width: baseSize, height: baseSize };
  }
};

export const mapQualityToSteps = (quality: string): number => {
    switch(quality) {
        case "Estándar": return 20;
        case "Alta": return 30;
        case "Ultra": return 40;
        default: return 25;
    }
};
