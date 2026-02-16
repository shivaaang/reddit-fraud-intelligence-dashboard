interface TakeawayCardProps {
  title: string;
  points: string[];
}

export function TakeawayCard({ title, points }: TakeawayCardProps) {
  return (
    <div className="rounded-xl bg-ube-100 border border-ube-300 px-8 py-6">
      <h3 className="text-base font-bold text-fog-900 mb-4">{title}</h3>
      <ul className="flex flex-col gap-3">
        {points.map((point, idx) => (
          <li key={idx} className="flex gap-3 text-sm text-fog-700 leading-relaxed">
            <span className="text-ube-600 font-bold mt-px flex-shrink-0">&bull;</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
