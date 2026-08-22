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
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-2xl bg-gold hover:bg-gold/90 text-white border-4 border-white dark:border-zinc-950 transition-all hover:scale-110 active:scale-95 group"
      >
        <Sparkles className="w-6 h-6 animate-pulse group-hover:animate-none" />
        <span className="sr-only">Assistente IA</span>
      </Button>

      <AssistenteIaSidebar 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
}
