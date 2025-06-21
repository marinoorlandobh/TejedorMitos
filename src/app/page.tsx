'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, ScrollText } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    // Usamos un temporizador para mostrar la pantalla de bienvenida por un momento
    // antes de redirigir al usuario.
    const timer = setTimeout(() => {
      // Usamos `replace` para que la pantalla de bienvenida no quede en el historial del navegador.
      router.replace('/create');
    }, 1200); // 1.2 segundos de retraso

    // Limpiamos el temporizador si el componente se desmonta
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground animate-in fade-in-50 duration-1000">
      <div className="relative flex flex-col items-center justify-center text-center p-4">
        <ScrollText className="h-20 w-20 text-primary" />
        <h1 className="text-5xl font-headline font-bold text-primary mt-4">
          Tejedor de Mitos
        </h1>
        <p className="text-xl text-muted-foreground mt-2">
          Abriendo el telar de la imaginación...
        </p>
        <Loader2 className="h-10 w-10 animate-spin text-accent mt-8" />
      </div>
    </div>
  );
}
