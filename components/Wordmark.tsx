/**
 * The project's name as the page's main heading: large, high contrast, with a short subtitle.
 * The name comes from config/brand.ts. "EMIS" is kept left-to-right inside Hebrew text.
 */
export function Wordmark({ name, subtitle, className = "" }: { name: string; subtitle: string; className?: string }) {
  return (
    <header className={className}>
      <h1 className="text-[2.6rem] font-black leading-tight tracking-tight text-ink sm:text-5xl">
        <bdi>{name}</bdi>
      </h1>
      <p className="mt-3 border-s-8 border-brand ps-4 text-xl font-bold text-ink sm:text-2xl">{subtitle}</p>
    </header>
  );
}
