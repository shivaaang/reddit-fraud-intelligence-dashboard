interface SectionTransitionProps {
  text: string;
}

export function SectionTransition({ text }: SectionTransitionProps) {
  return (
    <div className="flex items-center gap-6">
      <div
        className="h-px flex-1"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #d3d5ff 50%, transparent 100%)",
        }}
      />
      <p className="text-xs font-medium text-fog-500 tracking-wide text-center max-w-md">
        {text}
      </p>
      <div
        className="h-px flex-1"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #d3d5ff 50%, transparent 100%)",
        }}
      />
    </div>
  );
}
