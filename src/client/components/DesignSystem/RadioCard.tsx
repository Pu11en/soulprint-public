import React from 'react';

interface RadioCardProps {
  value: string;
  selectedValue: string;
  onChange: (value: string) => void;
  icon: string;
  title: string;
  name: string;
}

export default function RadioCard({
  value,
  selectedValue,
  onChange,
  icon,
  title,
  name,
}: RadioCardProps) {
  const isSelected = value === selectedValue;

  return (
    <label className="group relative cursor-pointer block">
      <input
        type="radio"
        name={name}
        value={value}
        checked={isSelected}
        onChange={() => onChange(value)}
        className="peer sr-only"
      />
      <div
        className={`relative p-5 border-2 rounded-xl transition-all duration-300 shadow-sm
        ${
          isSelected
            ? 'bg-brand-black dark:bg-white border-brand-black dark:border-white'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-brand-black hover:dark:border-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors
              ${
                isSelected
                  ? 'bg-gray-800 dark:bg-gray-200'
                  : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-primary/10'
              }`}
            >
              <span
                className={`material-icons text-xl 
                ${isSelected ? 'text-primary' : 'text-brand-black dark:text-white'}`}
              >
                {icon}
              </span>
            </div>
            <div>
              <h3
                className={`font-bold text-lg 
                ${
                  isSelected
                    ? 'text-white dark:text-brand-black'
                    : 'text-brand-black dark:text-white'
                }`}
              >
                {title}
              </h3>
            </div>
          </div>
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
            ${isSelected ? 'border-primary bg-primary' : 'border-gray-300 dark:border-gray-600'}`}
          >
            <span
              className={`material-icons text-white text-[10px] font-bold transition-opacity
              ${isSelected ? 'opacity-100' : 'opacity-0'}
              `}
            >
              check
            </span>
          </div>
        </div>
      </div>
    </label>
  );
}
