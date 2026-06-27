import { Search } from 'lucide-react';

/**
 * Reusable search input component. Provides consistent search styling
 * across all list/table views.
 */
export default function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="search-box">
      <Search className="search-icon" size={18} />
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
