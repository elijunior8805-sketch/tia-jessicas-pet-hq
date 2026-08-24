import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IaHeader } from "./ui/IaHeader";
import { IaMessageList } from "./ui/IaMessageList";
import { IaInputArea } from "./ui/IaInputArea";
import { useAssistenteActions } from "./hooks/useAssistenteActions";
import { toast } from "sonner";
import { processarComprovanteIA } from "@/lib/ia/ia-financeiro.functions";
import { supabase } from "@/integrations/supabase/client";

interface AssistenteIaSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssistenteIaSidebar({ isOpen, onClose }: AssistenteIaSidebarProps) {
  const {
    messages,
    inputText,
    setInputText,
    voiceStatus,
    isProcessing,
    iaStatus,
    searchResults,
    filePreview,
    handleSend,
    toggleVoice,
    cancelVoice,
    scrollRef,
    setSelectedFile,
    setFilePreview,
    setIaStatus,
    setMessages,
    setIsProcessing,
    handleConfirmarAgendamento,
    selectedFile,
    analiseResult,
    interimTranscript,
    finalTranscript,
    isReviewingVoice,
    setFinalTranscript
  } = useAssistenteActions(isOpen, onClose);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 5MB.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato não suportado. Use JPG, PNG, WEBP ou PDF.");
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (prev) => setFilePreview(prev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview("pdf");
    }
  };

  const handleAnalizarComprovante = async () => {
    if (!selectedFile || !filePreview) return;

    setIsProcessing(true);
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: `[Arquivo: ${selectedFile.name}] Analisar este comprovante.`,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      let base64 = "";
      if (selectedFile.type.startsWith("image/")) {
        base64 = filePreview.split(",")[1];
      } else {
        const reader = new FileReader();
        base64 = await new Promise((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(selectedFile);
        });
      }

      const res = await processarComprovanteIA({
        data: { imagemBase64: base64, contentType: selectedFile.type },
      });

      if (res.sucesso) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Li o comprovante! Valor: R$ ${res.valor.toFixed(2)}.`,
            timestamp: new Date().toISOString(),
          },
        ]);
        
        // Upload logic simplified for brevity in refactor
        const fileExt = selectedFile.name.split(".").pop();
        const filePath = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        await supabase.storage.from("comprovantes").upload(filePath, selectedFile);
      } else {
        toast.error(res.mensagem || "Erro na análise.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao processar comprovante.");
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      setFilePreview(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px] md:bg-black/40"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="bg-[#F5F2EA] w-full md:w-[480px] h-full flex flex-col shadow-2xl relative z-10 border-l border-white/20"
          >
            <IaHeader iaStatus={iaStatus} onClose={onClose} />

            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              <IaMessageList
                messages={messages}
                searchResults={searchResults}
                handleSend={handleSend}
                handleConfirmarAgendamento={handleConfirmarAgendamento}
                isProcessing={isProcessing}
              />
            </ScrollArea>

            <IaInputArea
              inputText={inputText}
              setInputText={setInputText}
              voiceStatus={voiceStatus}
              isProcessing={isProcessing}
              handleSend={handleSend}
              toggleVoice={toggleVoice}
              cancelVoice={cancelVoice}
              handleFileSelect={handleFileSelect}
              filePreview={filePreview}
              setFilePreview={setFilePreview}
              setSelectedFile={setSelectedFile}
              handleAnalizarComprovante={handleAnalizarComprovante}
              interimTranscript={interimTranscript}
              finalTranscript={finalTranscript}
              isReviewingVoice={isReviewingVoice}
              setFinalTranscript={setFinalTranscript}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
