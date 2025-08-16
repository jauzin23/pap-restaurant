import React, { memo } from "react";

const Footer = memo(function Footer() {
  return (
    <footer className="w-full py-5 border-white/10 bg-neutral-900/95 shadow-lg border-t border-neutral-800 mt-auto backdrop-blur-sm">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between space-y-2 md:space-y-0">
        <p className="text-center md:text-left text-sm text-neutral-400">
          Desenvolvido por{" "}
          <span className="font-bold text-yellow-400 cursor-default hover:text-yellow-300 transition-colors">
            João Monteiro
          </span>
        </p>
        <p className="text-center md:text-right text-sm text-neutral-500">
          © 2025 Todos os direitos reservados
        </p>
      </div>
    </footer>
  );
});

export default Footer;
