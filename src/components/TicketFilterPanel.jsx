import { memo } from "react";

const TicketFilterPanel = memo(function TicketFilterPanel({
  applyFilters,
  categories,
  categoryError,
  clearFilters,
  draftFilters,
  formatCategoryOption,
  formatLabel,
  formatLegacyCategory,
  formatStatusOption,
  handleFilterInput,
  isLoadingCategories,
  isLoadingStatusOptions,
  selectedCategory,
  selectedCategoryInOptions,
  selectedStatus,
  selectedStatusInOptions,
  setDateRange,
  statusFilterOptions,
  statusOptionsError,
}) {
  return (
    <div className="ticket-filter-panel mt-3 border-t border-blue-100 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 sm:mt-4 sm:pb-0 sm:pt-4">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-950 sm:col-span-2">
          <input
            name="mine"
            type="checkbox"
            checked={draftFilters.mine}
            onChange={handleFilterInput}
            className="h-5 w-5 rounded border-gray-300 text-blue-950 focus:ring-blue-950"
          />
          My Tickets
        </label>

        <label className="text-sm font-semibold text-gray-700">
          Status
          <select
            name="status"
            value={draftFilters.status}
            onChange={handleFilterInput}
            className="mt-2 min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-950"
          >
            <option value="">All statuses</option>
            {!selectedStatusInOptions && <option value={selectedStatus}>{formatLabel(selectedStatus)}</option>}
            {statusFilterOptions.map((option) => (
              <option key={option.statusKey} value={option.statusKey}>{formatStatusOption(option)}</option>
            ))}
          </select>
          {isLoadingStatusOptions && <p className="mt-1 text-xs font-semibold text-gray-500">Loading status options...</p>}
          {statusOptionsError && <p className="mt-1 text-xs font-semibold text-yellow-700">{statusOptionsError}</p>}
        </label>

        <label className="text-sm font-semibold text-gray-700">
          Category
          <select
            name="category"
            value={draftFilters.category}
            onChange={handleFilterInput}
            className="mt-2 min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-950"
          >
            <option value="">All categories</option>
            {!selectedCategoryInOptions && <option value={selectedCategory}>{formatLegacyCategory(selectedCategory)}</option>}
            {categories.map((category) => (
              <option key={category.id ?? category.categoryKey} value={category.categoryKey}>
                {formatCategoryOption(category)}
              </option>
            ))}
          </select>
          {isLoadingCategories && <p className="mt-1 text-xs font-semibold text-gray-500">Loading categories...</p>}
          {categoryError && <p className="mt-1 text-xs font-semibold text-red-600">{categoryError}</p>}
          {!isLoadingCategories && !categoryError && categories.length === 0 && (
            <p className="mt-1 text-xs font-semibold text-yellow-700">No active categories available.</p>
          )}
        </label>

        <div className="sm:col-span-2">
          <p className="text-sm font-semibold text-gray-700">Date Range</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDateRange("today")}
              className="min-h-9 rounded-full border border-blue-100 px-3 py-1.5 text-xs font-bold text-blue-950 hover:bg-blue-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateRange("last7")}
              className="min-h-9 rounded-full border border-blue-100 px-3 py-1.5 text-xs font-bold text-blue-950 hover:bg-blue-50"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setDateRange("month")}
              className="min-h-9 rounded-full border border-blue-100 px-3 py-1.5 text-xs font-bold text-blue-950 hover:bg-blue-50"
            >
              This Month
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">
              From Date
              <input
                name="createdFrom"
                type="date"
                value={draftFilters.createdFrom}
                onChange={handleFilterInput}
                className="mt-2 min-h-12 w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-blue-950"
              />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              To Date
              <input
                name="createdTo"
                type="date"
                value={draftFilters.createdTo}
                onChange={handleFilterInput}
                className="mt-2 min-h-12 w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-blue-950"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="filter-actions sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-10 mt-4 grid grid-cols-2 gap-2 border-t border-blue-100 bg-white py-3 sm:static sm:flex sm:flex-wrap sm:border-t-0 sm:py-0">
        <button
          type="button"
          onClick={clearFilters}
          className="min-h-11 rounded-xl border border-blue-950 px-4 py-2.5 text-sm font-bold text-blue-950 hover:bg-blue-50"
        >
          Clear Filters
        </button>
        <button
          type="button"
          onClick={applyFilters}
          className="min-h-11 rounded-xl bg-blue-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-900"
        >
          Apply
        </button>
      </div>
    </div>
  );
});

export default TicketFilterPanel;
