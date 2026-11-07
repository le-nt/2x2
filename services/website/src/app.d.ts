import { CurrentUser } from "@/types/types";
import type { Session } from "@prisma/client";

declare global {
	namespace App {
		interface Locals {
            user: CurrentUser | null
			admin: Session | null;
			// features: Record<string, boolean>;
        }
	}
}

export {};
