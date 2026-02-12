interface Props {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function ChapterNav({ hasPrev, hasNext, onPrev, onNext }: Props) {
  return (
    <nav className="sticky bottom-12 bg-[#fafaf8]/95 backdrop-blur border-t border-gray-200">
      <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          &larr; Previous
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          Next &rarr;
        </button>
      </div>
    </nav>
  );
}
