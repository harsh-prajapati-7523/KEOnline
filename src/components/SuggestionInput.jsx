import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 275;

export default function SuggestionInput({
  endpoint,
  name,
  value,
  onChange,
  className = "",
  ...inputProps
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const query = value.trim();
    const token = localStorage.getItem("token");
    const requestId = ++requestIdRef.current;

    if (!query || !token) {
      setSuggestions([]);
      setIsOpen(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Suggestion request failed");

        const data = await response.json();
        if (requestId !== requestIdRef.current) return;

        const nextSuggestions = Array.isArray(data) ? data.slice(0, 5) : [];
        setSuggestions(nextSuggestions);
        setIsOpen(nextSuggestions.length > 0);
      } catch {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        setSuggestions([]);
        setIsOpen(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [endpoint, value]);

  const selectSuggestion = (suggestion) => {
    onChange({ target: { name, value: suggestion } });
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <input
        {...inputProps}
        name={name}
        value={value}
        onChange={onChange}
        onFocus={() => setIsOpen(suggestions.length > 0)}
        onBlur={() => setIsOpen(false)}
        className={className}
        autoComplete="off"
      />
      {isOpen && (
        <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
                className="w-full px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-blue-50"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
