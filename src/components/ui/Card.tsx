type Props = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

export function Card({ children, className = "", onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={`bg-[#16161a] border border-zinc-800 rounded-xl p-4 ${onClick ? "cursor-pointer hover:border-zinc-600 transition-colors" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
