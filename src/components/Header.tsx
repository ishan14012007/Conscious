interface HeaderProps {
  onOpenAccessModal: () => void;
}

export function Header({ onOpenAccessModal }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#04070E]/92 border-b border-sky-400/12">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-8 px-6 lg:px-10">
        {/* Brand Wordmark */}
        <a
          href="#"
          className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
        >
          Conscious
        </a>

        {/* Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenAccessModal}
            className="inline-flex items-center justify-center rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Request Access
          </button>
        </div>
      </div>
    </header>
  );
}
