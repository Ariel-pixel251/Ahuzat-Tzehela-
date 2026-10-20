/**
 * The project's name as the page's main heading: large, high contrast, with a short subtitle.
 * The name comes from config/brand.ts. No <bdi>: it would make a Hebrew heading that starts with
 * "EMIS" read left to right; the page's own direction orders it correctly.
 */
export function Wordmark({ name, subtitle, className = "" }: { name: string; subtitle: string; className?: string }) {
  return (
    <header className={className}>
      <h1 className="text-[2.6rem] font-black leading-tight tracking-tight text-ink sm:text-5xl">
        {name}
      </h1>
      <p className="mt-3 border-s-8 border-brand ps-4 text-xl font-bold text-ink sm:text-2xl">{subtitle}</p>
    </header>
  );
}
