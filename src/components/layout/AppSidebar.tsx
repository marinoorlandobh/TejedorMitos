
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollText, Wand2, ImageIcon, GalleryVerticalEnd, Settings, Sparkles, Palette, FileText, Layers, FileSpreadsheet } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/create", label: "Crear Mito", icon: Wand2 },
  { href: "/analyze", label: "Analizar Imagen", icon: ImageIcon, subIcon: Sparkles },
  { href: "/reimagine", label: "Reimaginar Imagen", icon: Palette },
  { href: "/batch-create", label: "Creación en Lote", icon: Layers },
  { href: "/import", label: "Importar PDF", icon: FileText },
  { href: "/import-csv", label: "Importar CSV", icon: FileSpreadsheet },
  { href: "/gallery", label: "Mi Galería", icon: GalleryVerticalEnd },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="sidebar" collapsible="icon" side="left" className="border-r">
      <SidebarHeader className="p-4 justify-between items-center">
        <Link href="/create" className="flex items-center gap-2">
          <ScrollText className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-headline font-semibold group-data-[collapsible=icon]:hidden">Tejedor de Mitos</h1>
        </Link>
        <div className="block md:hidden">
           <SidebarTrigger />
        </div>
      </SidebarHeader>
      <Separator className="my-0" />
      <SidebarContent className="flex-1 p-2">
        <SidebarMenu>
          {navItems.map((item) => (
             <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                variant="default"
                size="default"
                isActive={pathname === item.href || (item.href !== "/create" && pathname.startsWith(item.href))}
                tooltip={{children: item.label, side: "right", className: "font-body"}}
                className="font-body"
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                  {item.subIcon && <item.subIcon className="ml-auto h-4 w-4 opacity-70" />}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <Separator className="my-0" />
      <SidebarFooter className="p-4 flex items-center justify-between group-data-[collapsible=icon]:justify-center">
         <div className="group-data-[collapsible=icon]:hidden">
          <Button variant="outline" size="sm" onClick={() => window.open('https://github.com/your-repo/myth-weaver', '_blank')}>
            Ver Código Fuente
          </Button>
         </div>
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
