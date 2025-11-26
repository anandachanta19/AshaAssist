
/**
 * Reusable Loading component using Tailwind classes so it matches the app UI.
 * Props:
 * - text: optional label shown next to/under the spinner
 * - size: 'xs' | 'sm' | 'md' | 'lg' (controls spinner size)
 * - inline: boolean, render as inline element (for buttons/messages)
 * - color: Tailwind color (blue/green/white)
 */
const sizeMap = {
  xs: 'w-3 h-3 border-2',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-4',
  lg: 'w-10 h-10 border-4',
};

export default function Loading({ text = '', size = 'md', inline = false, color = 'blue' }) {
  const spinnerSize = sizeMap[size] || sizeMap.md;
  const colorClass = color === 'green' ? 'border-green-400 border-t-green-600' : (color === 'white' ? 'border-white border-t-white/80' : 'border-blue-400 border-t-blue-600');

  const spinner = (
    <span className={`${spinnerSize} ${colorClass} rounded-full animate-spin inline-block`} aria-hidden="true"></span>
  );

  if (inline) {
    return (
      <span className="inline-flex items-center gap-2">
        {spinner}
        {text ? <span className="text-sm text-gray-200">{text}</span> : null}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {spinner}
      {text ? <div className="mt-3 text-sm text-gray-300">{text}</div> : null}
    </div>
  );
}
