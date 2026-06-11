import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

/**
 * SearchInput with integrated debouncing.
 * 
 * @param {string} value - Current search query value
 * @param {function} onSearch - Callback fired with the debounced value
 * @param {string} placeholder - Input placeholder text
 * @param {number} delay - Debounce delay in milliseconds
 */
export function SearchInput({ value = '', onSearch, placeholder = 'Search...', delay = 400 }) {
  const [searchTerm, setSearchTerm] = useState(value);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(searchTerm);
    }, delay);

    return () => clearTimeout(handler);
  }, [searchTerm, onSearch, delay]);

  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-base-content/40 pointer-events-none" />
      <input
        type="text"
        className="input input-bordered pl-11 rounded-xl w-full bg-base-100/40 focus:bg-base-100 border-base-content/10 text-sm h-11"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>
  );
}
export default SearchInput;
