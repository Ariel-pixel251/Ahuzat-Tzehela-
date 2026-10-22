/**
 * The project's name as the page's main heading: large, high contrast, with a short subtitle.
 * The name comes from config/brand.ts. No <bdi>: it would make a Hebrew heading that starts with
 * "EMIS" read left to right; the page's own direction orders it correctly.
 */
export function Wordmark({
  name,
  subtitle,
  accent = "brand",
  className = "",
}: {
  name: string;
  subtitle: string;
  /** the subtitle's side bar: Ahuzat Tzahala maroon for residents, EMIS orange for students */
  accent?: "brand" | "maroon" | "emis";
  className?: string;
}) {
  const bar = { brand: "border-brand", maroon: "border-maroon", emis: "border-emis" }[accent];
  return (
    <header className={className}>
      <h1 className="text-[2.6rem] font-black leading-tight tracking-tight text-ink sm:text-5xl">
        {name}
      </h1>
      <p className={`mt-3 border-s-8 ${bar} ps-4 text-xl font-bold text-ink sm:text-2xl`}>{subtitle}</p>
    </header>
  );
}
