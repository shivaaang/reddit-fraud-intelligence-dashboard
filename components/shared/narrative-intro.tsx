interface NarrativeIntroProps {
  text: string;
}

export function NarrativeIntro({ text }: NarrativeIntroProps) {
  return (
    <div className="mb-8">
      <p className="text-[15px] text-fog-700 leading-relaxed">{text}</p>
    </div>
  );
}
