import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AssistenteErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in Assistente IA:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl border-2 border-red-100 shadow-xl m-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-[#123F2A] mb-2">Ops! Ocorreu um erro</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            A Assistente IA encontrou um problema técnico. O restante do sistema continua funcionando normalmente.
          </p>
          <div className="flex gap-3">
            <Button 
              onClick={() => this.setState({ hasError: false })}
              className="bg-[#C99845] hover:bg-[#C99845]/90 text-white font-bold px-6 rounded-xl"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.location.reload()}
              className="border-[#C99845]/20 text-[#C99845] font-bold px-6 rounded-xl"
            >
              Reiniciar Fluxo
            </Button>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-8 p-4 bg-gray-50 rounded-lg text-left text-[10px] text-red-400 overflow-auto max-w-full">
              {this.state.error?.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.children;
  }
}
