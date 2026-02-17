"use client";

import { formatNumber, toTitleCase } from "@/lib/utils";

interface BiometricItem {
  type: string;
  count: number;
}

interface LivenessCalloutProps {
  livenessCount: number;
  biometricBreakdown?: BiometricItem[];
}

export function LivenessCallout({
  livenessCount,
  biometricBreakdown,
}: LivenessCalloutProps) {
  return (
    <div
      className="rounded-xl p-8 text-white shadow-lg"
      style={{
        background: "linear-gradient(135deg, #1a1b4b 0%, #010668 60%, #2a2d8a 100%)",
      }}
    >
      <div className="flex items-start justify-between gap-8">
        <div className="flex flex-col gap-3 flex-1">
          <h3 className="text-lg font-bold">
            Biometric Verification: Where Fraud Prevention Meets User Experience
          </h3>
          <p className="text-sm text-white/80 leading-relaxed">
            Selfie matching, liveness detection, and facial age estimation form
            the biometric layer of modern identity verification. Our data shows
            significant friction across all three methods. Users struggle with
            photo quality, lighting conditions, and false rejections from
            face-matching algorithms. The opportunity: biometric flows that are
            both harder to spoof and easier for real users to complete.
          </p>
          <p className="text-xs text-white/60 leading-relaxed mt-1">
            The document-plus-biometric verification stack is becoming the
            industry standard. Getting it right means minimizing friction for
            legitimate users while maintaining robust defense against
            presentation attacks and synthetic media.
          </p>
        </div>

        <div className="flex flex-col items-end flex-shrink-0 gap-4">
          <div className="text-right">
            <span className="text-4xl font-bold">
              {formatNumber(livenessCount)}
            </span>
            <span className="block text-sm text-white/60">
              biometric verification posts
            </span>
          </div>

          {biometricBreakdown && biometricBreakdown.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {biometricBreakdown.map((item) => (
                <div
                  key={item.type}
                  className="flex items-center gap-3 text-right"
                >
                  <span className="text-xs text-white/50">
                    {toTitleCase(item.type)}
                  </span>
                  <span className="text-sm font-semibold text-white/90">
                    {formatNumber(item.count)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
