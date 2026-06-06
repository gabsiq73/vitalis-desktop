export interface SortState {
  field: string;
  dir: 'asc' | 'desc';
}

interface Props {
  label: string;
  field: string;
  sort: SortState | null;
  onSort: (s: SortState | null) => void;
  defaultDir?: 'asc' | 'desc';
}

export function SortableHeader({ label, field, sort, onSort, defaultDir = 'asc' }: Props) {
  const isActive = sort?.field === field;
  return (
    <button
      type="button"
      onClick={() => onSort(isActive ? null : { field, dir: defaultDir })}
      className="flex items-center gap-0.5 group select-none hover:text-slate-700 transition-colors"
    >
      {label}
      <span
        className={`material-symbols-outlined transition-colors ${isActive ? 'text-primary' : 'opacity-25 group-hover:opacity-50'}`}
        style={{ fontSize: '13px' }}
      >
        {isActive ? (sort!.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
      </span>
    </button>
  );
}
