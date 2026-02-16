interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  annotation?: string;
}

export function SectionHeader({ title, subtitle, annotation }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-fog-900">{title}</h2>
      {subtitle && (
        <p className="text-sm text-fog-500 mt-1.5">{subtitle}</p>
      )}
      {annotation && (
        <p className="text-sm text-fog-600 italic mt-3 leading-relaxed">
          {annotation}
        </p>
      )}
    </div>
  );
}
