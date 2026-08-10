export default function PageHeader({ title, actionLabel, onAction }) {
  return (
    <div className="mb-6 flex items-start justify-between px-8 pt-8">
      <h1 className="text-4xl font-bold text-gray-900">{title}</h1>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
