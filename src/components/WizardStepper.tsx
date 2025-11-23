interface WizardStepperProps {
  currentStep: number;
  steps: string[];
  onStepClick?: (step: number) => void;
}

export function WizardStepper({ currentStep, steps, onStepClick }: WizardStepperProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-8 py-6">
      <div className="flex items-center justify-center gap-8">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;

          return (
            <div key={index} className="flex items-center gap-3">
              <div
                onClick={() => onStepClick?.(stepNum)}
                className={`cursor-pointer w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  isCompleted
                    ? 'bg-green-600 text-white'
                    : isActive
                      ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                      : 'bg-gray-300 text-gray-600'
                }`}
              >
                {stepNum}
              </div>
              <div className={`text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                {step}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-1 mx-4 ${isCompleted ? 'bg-green-600' : 'bg-gray-300'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
