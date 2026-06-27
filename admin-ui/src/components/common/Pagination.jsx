import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable pagination component extracted from the repeated pagination logic
 * across Applications, AcademicRecords, Scholars, ScholarshipEvaluation pages.
 */
export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  pageSizeOptions = [5, 10, 25, 50, 100],
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  return (
    <div className="pagination-bar">
      <div className="pagination-info">
        Showing {startItem}–{endItem} of {totalItems}
      </div>

      <div className="pagination-controls">
        {onItemsPerPageChange && (
          <select
            className="pagination-select"
            value={itemsPerPage}
            onChange={(e) => {
              onItemsPerPageChange(Number(e.target.value));
              onPageChange(1);
            }}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        )}

        <button
          className="pagination-btn"
          onClick={handlePrev}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="pagination-page">
          {currentPage} / {totalPages}
        </span>

        <button
          className="pagination-btn"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
