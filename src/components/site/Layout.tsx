import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { FloatingWhatsApp } from "./FloatingWhatsApp";
import { IncompleteProfileBanner } from "./IncompleteProfileBanner";

export const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-1">
      <IncompleteProfileBanner />
      {children}
    </main>
    <Footer />
    <FloatingWhatsApp />
  </div>
);
