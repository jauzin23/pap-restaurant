import React from "react";

const Footer: React.FC = () => {
  return (
    <footer className="w-full py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="border-t border-slate-200/50 pt-4">
          <p className="text-center text-xs text-slate-500/80">
            Desenvolvido por{" "}
            <span className="font-medium text-slate-600">João Monteiro</span> •
            © 2025 Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
