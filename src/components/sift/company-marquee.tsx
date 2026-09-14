export function CompanyMarquee({ names }: { names: string[] }) {
  return (
    <div
      className="marquee-pause-on-hover relative w-full overflow-hidden"
      style={{ maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}
    >
      <div className="animate-marquee flex w-max items-center gap-16">
        {[names, names].map((set, i) => (
          <div key={i} className="flex items-center gap-16" aria-hidden={i === 1}>
            {set.map((name, j) => (
              <span
                key={`${name}-${j}`}
                className="font-heading text-lg whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
