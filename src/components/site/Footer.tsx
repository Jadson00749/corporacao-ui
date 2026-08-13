import { Link } from "@/lib/router-compat";
import { Instagram, Mail, MapPin, MessageCircle } from "lucide-react";
import { useSettings, useWhatsappLink } from "@/contexts/SettingsContext";
import logo from "@/assets/logo.png";

export const Footer = () => {
  const siteSettings = useSettings();
  const whatsappLink = useWhatsappLink();
  return (
    <footer className="bg-gradient-dark text-white">
      <div className="container-page py-16">
        <div className="grid md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img
                src={logo}
                alt={`${siteSettings.brand.name} logo`}
                className="w-11 h-11 object-contain"
              />
              <span className="font-display font-bold text-lg md:text-xl leading-tight">{siteSettings.brand.name}</span>
            </div>
            <p className="text-white/70 max-w-md leading-relaxed">
              {siteSettings.brand.description}
            </p>
            <div className="flex gap-3 mt-6">
              <a
                href={siteSettings.contact.instagram}
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-brand transition-colors flex items-center justify-center"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-brand transition-colors flex items-center justify-center"
                aria-label="WhatsApp"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
              <a
                href={`mailto:${siteSettings.contact.email}`}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-brand transition-colors flex items-center justify-center"
                aria-label="E-mail"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4">Navegação</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link to="/planos" className="hover:text-brand-glow transition-colors">Planos</Link></li>
              <li><Link to="/treinos" className="hover:text-brand-glow transition-colors">Treinos</Link></li>
              <li><Link to="/provas" className="hover:text-brand-glow transition-colors">Provas</Link></li>
              <li><Link to="/produtos" className="hover:text-brand-glow transition-colors">Produtos</Link></li>
              
              <li><Link to="/fotos" className="hover:text-brand-glow transition-colors">Fotos</Link></li>
              <li><Link to="/sobre" className="hover:text-brand-glow transition-colors">Quem somos</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4">Contato</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-2">
                <MessageCircle className="w-4 h-4 mt-0.5 text-brand-glow" />
                <a href={whatsappLink()} target="_blank" rel="noreferrer" className="hover:text-white">
                  {siteSettings.contact.whatsappDisplay}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 text-brand-glow" />
                <a href={`mailto:${siteSettings.contact.email}`} className="hover:text-white break-all">
                  {siteSettings.contact.email}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-brand-glow" />
                <span>{siteSettings.contact.region}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col md:flex-row gap-3 justify-between items-center text-xs text-white/50">
          <span>© {new Date().getFullYear()} {siteSettings.brand.name}. Todos os direitos reservados.</span>
          <span>Feito com energia para quem corre.</span>
        </div>
      </div>
    </footer>
  );
};
