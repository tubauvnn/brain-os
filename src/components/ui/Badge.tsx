const VARIANTS = {
  default: "bg-zinc-800 text-zinc-300",
  indigo: "bg-indigo-900/50 text-indigo-300",
  green: "bg-emerald-900/50 text-emerald-300",
  yellow: "bg-amber-900/50 text-amber-300",
  red: "bg-red-900/50 text-red-300",
  pink: "bg-pink-900/50 text-pink-300",
};

type Props = {
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
};

export function Badge({ children, variant = "default" }: Props) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-mono ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}
