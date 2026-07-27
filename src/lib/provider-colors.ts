export const providerColors: Record<string, string> = {
  Netflix: "bg-red-600",
  Prime: "bg-blue-500",
  "Amazon Prime": "bg-blue-500",
  "Disney+": "bg-blue-700",
  Max: "bg-purple-600",
  Hulu: "bg-green-500",
  "Apple+": "bg-gray-500",
  "Apple TV+": "bg-gray-500",
  Peacock: "bg-yellow-500",
  "Paramount+": "bg-blue-400",
};

export function getProviderColor(name: string): string {
  return providerColors[name] ?? "bg-slate-600";
}
