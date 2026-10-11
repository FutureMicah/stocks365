import logoAsset from "@/assets/stocks365-logo.jpeg.asset.json";

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return <span className={`inline-flex h-12 w-44 shrink-0 items-center overflow-hidden rounded-md ${inverted ? "bg-card" : ""}`}>
    <img src={logoAsset.url} alt="stocks365" className="h-full w-full object-contain" width={176} height={48} />
  </span>;
}
