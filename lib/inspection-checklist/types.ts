export type ChecklistPriorityLevel = "high" | "medium" | "low";

export type InspectionChecklistItem = {
  id: string;
  category: string;
  text: string;
  checked: boolean;
  priority: ChecklistPriorityLevel;
  hint?: string;
};

export type InspectionChecklistPayload = {
  rowId: string;
  items: InspectionChecklistItem[];
  generatedAt: string;
};
