declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				displayName: string;
				onboardingDone: boolean;
			} | null;
			sessionId: string | null;
		}
	}
}

export {};
