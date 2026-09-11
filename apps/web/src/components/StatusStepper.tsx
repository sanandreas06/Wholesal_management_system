'use client';

interface Step { key: string; label: string }

export default function StatusStepper({ steps, currentKey, cancelledLabel }: {
  steps: Step[]; currentKey: string; cancelledLabel?: string;
}) {
  if (cancelledLabel) {
    return <div className="stepper-cancelled">{cancelledLabel}</div>;
  }

  const currentIndex = steps.findIndex(s => s.key === currentKey);

  return (
    <div className="stepper">
      {steps.map((step, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
        return (
          <div className="stepper-step" key={step.key}>
            <div className="stepper-node-row">
              <div className={`stepper-node ${state}`}>{state === "done" ? "✓" : i + 1}</div>
              {i < steps.length - 1 && <div className={`stepper-line ${i < currentIndex ? "done" : ""}`} />}
            </div>
            <p className={`stepper-label ${state}`}>{step.label}</p>
          </div>
        );
      })}
    </div>
  );
}
