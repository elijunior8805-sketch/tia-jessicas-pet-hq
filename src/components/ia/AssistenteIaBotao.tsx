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
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-14 px-4 rounded-full shadow-2xl bg-emerald-800 hover:bg-emerald-900 text-white border-2 border-[#C8A951] transition-all hover:scale-105 active:scale-95 group flex items-center gap-2"
        title="Jessi — Assistente Operacional do Spa"
      >
        <Sparkles className="w-5 h-5 text-[#C8A951] animate-pulse group-hover:animate-none" />
        <span className="font-semibold text-sm tracking-wide">Jessi</span>
      </Button>

      <AssistenteIaSidebar 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
}
