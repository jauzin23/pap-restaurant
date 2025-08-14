"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "react-responsive";
import { useEffect } from "react";

export default function UnsupportedPage() {
  const router = useRouter();
  const isMobile = useMediaQuery({ maxWidth: 767 });

  useEffect(() => {
    if (!isMobile) router.push("/");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="bg-white shadow-xl rounded-xl p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-semibold text-gray-800 mb-4">
          Dispositivo Não Suportado
        </h1>
        <p className="text-gray-600 mb-6">
          Lamentamos, mas este dashboard não está disponível em dispositivos
          móveis. Por favor, utilize um tablet ou desktop.
        </p>
        <Button
          variant="ghost"
          className="flex items-center gap-2 text-gray-600 hover:text-orange-500 mx-auto"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para o site
        </Button>
      </div>
    </div>
  );
}
