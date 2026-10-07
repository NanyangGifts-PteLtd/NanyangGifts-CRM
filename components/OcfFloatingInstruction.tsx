type OcfFloatingInstructionProps = {
  children: string;
  side: "left" | "right";
  step: number;
  className?: string;
};

export function OcfFloatingInstruction({
  children,
  side,
  step,
  className = "",
}: OcfFloatingInstructionProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 hidden w-52 -translate-y-1/2 items-center gap-2 xl:flex ${
        side === "left" ? "right-full mr-7 flex-row" : "left-full ml-7 flex-row-reverse"
      } ${className}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-sky-600 bg-white text-sm font-bold text-sky-700 shadow-sm">
        {step}
      </span>
      <span className="relative flex-1 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-center text-xs font-semibold leading-snug text-sky-800 shadow-sm">
        {children}
      </span>
      <span className="shrink-0 text-2xl font-bold leading-none text-sky-600" aria-hidden="true">
        {side === "left" ? "→" : "←"}
      </span>
    </div>
  );
}
