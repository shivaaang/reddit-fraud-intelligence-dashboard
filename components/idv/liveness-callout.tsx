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
        background: "linear-gradient(135deg, #010334 0%, #010668 100%)",
      }}
    >
      <div className="flex items-start justify-between gap-8">
        <div className="flex flex-col gap-3 flex-1">
          <h3 className="text-lg font-bold">
            Liveness Detection: Where Fraud Prevention Meets User Experience
          </h3>
          <p className="text-sm text-white/80 leading-relaxed">
            Liveness checks verify a person is physically present, not a photo,
            video, or deepfake. But our data shows real friction in selfie and
            liveness flows. The opportunity: verification systems that are both
            harder to spoof and easier for legitimate users.
          </p>
          <p className="text-xs text-white/60 leading-relaxed mt-1">
            Document verification + selfie matching + liveness detection form the
            modern identity verification stack. Getting this right means reducing
            false rejections while maintaining defense against presentation
            attacks.
          </p>
        </div>

        <div className="flex flex-col items-end flex-shrink-0 gap-4">
          <div className="text-right">
            <span className="text-4xl font-bold">
              {formatNumber(livenessCount)}
            </span>
            <span className="block text-sm text-white/60">
              biometric mentions
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
