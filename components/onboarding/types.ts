// components/onboarding/types.ts
// Shared shape for the onboarding wizard's in-memory state. Nothing here is
// persisted to the database yet (see code comments in OnboardingFlow) — it's
// passed step to step purely in React state so the flow works end to end
// visually before the backend fields exist.
export interface OnboardingData {
  interests: string[];
  goals: string[];
  identity: string | null;
  skills: string[];
  username: string;
}

export const INITIAL_ONBOARDING_DATA: OnboardingData = {
  interests: [],
  goals: [],
  identity: null,
  skills: [],
  username: "",
};

export interface StepProps {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  next: () => void;
  back: () => void;
}
