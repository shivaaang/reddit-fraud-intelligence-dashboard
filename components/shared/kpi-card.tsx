"use client";

interface KPICardProps {
  label: string;
  value: string;
  subtitle?: string;
  onClick?: () => void;
}

export function KPICard({ label, value, subtitle, onClick }: KPICardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-fog-200 shadow-sm p-6 flex flex-col gap-1 ${
        onClick
          ? "cursor-pointer hover:border-ube-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          : ""
      }`}
    >
      <p className="text-sm font-medium text-fog-500 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-3xl font-bold text-fog-800">{value}</p>
      {subtitle && (
        <p className="text-sm text-fog-500">{subtitle}</p>
      )}
    </div>
  );
}
