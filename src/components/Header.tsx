import React from 'react';
import { RotateCcw } from 'lucide-react';

interface HeaderProps {
  hasSessionData: boolean;
  hasDrafts: boolean;
  hasShoppingList: boolean;
  onResetSession: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasSessionData,
  hasDrafts,
  hasShoppingList,
  onResetSession,
}) => {
  return (
    <header className="border-b border-[#E7E5E4] bg-[#FAF9F6]/95 backdrop-blur-xs sticky top-0 z-30">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
        <a
          href="#top"
          className="font-display text-xl font-medium tracking-tight text-[#18181B] whitespace-nowrap shrink-0"
        >
          Raumstudio
        </a>

        <nav
          aria-label="Hauptnavigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#52525B]"
        >
          <a
            href="#arbeitsbereich"
            className="hover:text-[#18181B] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Arbeitsbereich
          </a>
          <a
            href="#entwurf"
            className={`hover:text-[#18181B] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              !hasDrafts ? 'text-[#A1A1AA]' : ''
            }`}
          >
            Entwurf & Vergleich
          </a>
          <a
            href="#einkaufsliste"
            className={`hover:text-[#18181B] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              !hasShoppingList ? 'text-[#A1A1AA]' : ''
            }`}
          >
            Einkaufsliste
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onResetSession}
            disabled={!hasSessionData}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#18181B] bg-white border border-[#D4D4D8] rounded-lg hover:bg-[#F4F4F2] disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Neue Sitzung</span>
          </button>
        </div>
      </div>
    </header>
  );
};
