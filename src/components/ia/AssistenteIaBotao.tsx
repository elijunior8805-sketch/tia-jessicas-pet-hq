import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssistenteIaSidebar } from './AssistenteIaSidebar';
import { useMyAccess } from '@/hooks/use-my-permissions';

export function AssistenteIaBotao() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: access } = useMyAccess();

  // Apenas usuários com perfil admin ou proprietário podem ver a assistente
  const canSeeAssistant = access?.isAdmin || access?.isProprietario;
  
  if (!canSeeAssistant) return null;

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          aria-label="Abrir Jessi"
          className="fixed z-40 right-4 md:right-6 h-[52px] w-[52px] md:h-14 md:w-auto p-0 md:px-4 rounded-full shadow-2xl bg-emerald-800 hover:bg-emerald-900 text-white border-2 border-[#C8A951] transition-all duration-200 hover:scale-105 active:scale-95 group flex items-center justify-center md:justify-start gap-2 focus:ring-2 focus:ring-[#C8A951] focus:ring-offset-2"
          style={{
            bottom: "calc(var(--mobile-bottom-nav-height, 64px) + 16px + env(safe-area-inset-bottom, 0px))",
          }}
          title="Jessi — Assistente Operacional do Spa"
        >
          <Sparkles className="w-6 h-6 md:w-5 md:h-5 text-[#C8A951] shrink-0 animate-pulse group-hover:animate-none" />
          <span className="sr-only md:not-sr-only md:inline font-semibold text-sm tracking-wide">
            Jessi
          </span>
        </Button>
      )}

      <AssistenteIaSidebar 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
}
