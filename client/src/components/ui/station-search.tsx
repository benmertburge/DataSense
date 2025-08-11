import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';

interface Station {
  id: string;
  name: string;
  type: string;
}

interface StationSearchProps {
  label: string;
  placeholder: string;
  value: { id: string; name: string } | null;
  onChange: (station: { id: string; name: string } | null) => void;
  required?: boolean;
  className?: string;
  indicatorColor?: string;
}

export function StationSearch({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  required = false, 
  className = "",
  indicatorColor = "bg-blue-500"
}: StationSearchProps) {
  const [query, setQuery] = useState(value?.name || '');
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: stations = [] } = useQuery({
    queryKey: ['/api/sites/search', query],
    enabled: query.length >= 2,
    staleTime: 5000, // Cache for 5 seconds
  }) as { data: Station[] };

  const selectStation = (station: Station) => {
    onChange({ id: station.id, name: station.name });
    setQuery(station.name);
    setShowDropdown(false);
  };

  const handleInputChange = (inputValue: string) => {
    setQuery(inputValue);
    setShowDropdown(inputValue.length >= 2);
    // Clear form value when typing to require dropdown selection
    if (inputValue !== value?.name) {
      onChange(null);
    }
  };

  return (
    <div className={className}>
      <Label className="text-gray-900 dark:text-white">{label}</Label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          <div className={`w-2 h-2 ${indicatorColor} rounded-full`}></div>
        </div>
        <Input
          placeholder={placeholder}
          className="pl-8 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (query.length >= 2) {
              setShowDropdown(true);
            }
          }}
          onBlur={() => {
            // Delay hiding to allow click on dropdown
            setTimeout(() => setShowDropdown(false), 200);
          }}
          required={required}
        />
        <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        
        {showDropdown && stations.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {stations.map((station: Station) => (
              <button
                key={station.id}
                type="button"
                className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 text-gray-900 dark:text-white"
                onClick={() => selectStation(station)}
              >
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
                  <div>
                    <div className="font-medium">{station.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{station.type}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}