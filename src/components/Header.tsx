import { useState } from 'react';
import { Car, Menu, X } from 'lucide-react';

interface HeaderProps {
  isMenuOpen: boolean;
  onToggleMenu: () => void;
}

const LOGO_URL = '/assets/aistudio/Glowing_Orange_Car_in_Motion_f49c6093.png';

export function Header({ isMenuOpen, onToggleMenu }: HeaderProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <header>
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 pt-4 pb-1 sm:px-6">
        <a
          href="#top"
          aria-label="Vehicle Image Restoration Home"
          className="inline-flex items-center mix-blend-screen transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF7A00]"
        >
          {!logoFailed ? (
            <img
              src={LOGO_URL}
              alt="Vehicle Image Restoration logo"
              referrerPolicy="no-referrer"
              onError={() => setLogoFailed(true)}
              className="h-12 w-20 object-cover object-center select-none sm:h-14 sm:w-24"
            />
          ) : (
            <span className="inline-flex h-11 w-11 items-center justify-center text-[#FF7A00]">
              <Car className="h-7 w-7" aria-hidden="true" />
            </span>
          )}
        </a>

        <button
          type="button"
          onClick={onToggleMenu}
          aria-expanded={isMenuOpen}
          aria-controls="backend-menu-panel"
          aria-label={isMenuOpen ? 'Close backend status menu' : 'Open backend status menu'}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-200 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00]"
        >
          {isMenuOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}
