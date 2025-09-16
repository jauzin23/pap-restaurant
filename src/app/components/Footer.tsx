import React, { memo } from "react";
import "./footer.scss";

const Footer = memo(function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-left">
          <p className="developer-credit">
            Desenvolvido por{" "}
            <span className="developer-name">João Monteiro</span>
          </p>
        </div>
        <div className="footer-right">
          <p className="copyright">© 2025 Todos os direitos reservados</p>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
