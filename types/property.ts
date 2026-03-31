import type { InferSelectModel } from "drizzle-orm";

import type { properties } from "@/lib/db/schema";

export type Property = InferSelectModel<typeof properties>;

export type PropertyStatus = Property["status"];
