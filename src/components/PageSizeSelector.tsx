const SIZES = [15, 30, 60, 75];

interface Props {
  value: number;
  onChange: (size: number) => void;
}

export function PageSizeSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 text-[12px] text-slate-500">
      <span className="font-medium mr-1">Exibir:</span>
      {SIZES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`w-9 h-7 rounded font-semibold transition-colors ${
            value === s
              ? 'bg-primary text-white'
              : 'text-slate-500 hover:text-primary hover:bg-primary/8'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
