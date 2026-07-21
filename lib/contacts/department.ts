/**
 * Infer a contact's department from their job title — drives the department
 * icon shown on the Top Contacts card. Order matters: IT keywords win over
 * generic ops words ("IT Operations Manager" is IT, not Operations).
 */

export type Department =
  | "it"
  | "engineering"
  | "finance"
  | "operations"
  | "marketing"
  | "procurement"
  | "general";

const RULES: Array<{ dept: Department; re: RegExp }> = [
  {
    dept: "it",
    re: /information technology|\bIT\b|\bC[IT]O\b|\bCISO\b|infrastructure|network|telecom|help ?desk|sys(tems)? ?admin|digital|technolog|security/i,
  },
  { dept: "procurement", re: /procure|purchas|sourcing/i },
  { dept: "engineering", re: /engineer|r&d|research and development/i },
  { dept: "finance", re: /financ|\bCFO\b|account|controller|treasur|audit/i },
  {
    dept: "operations",
    re: /operation|\bCOO\b|supply ?chain|logistic|facilit|plant|warehouse|manufactur|field service/i,
  },
  { dept: "marketing", re: /market|\bCMO\b|brand|communicat|growth|demand gen/i },
];

export function departmentForTitle(title: string | null): Department {
  if (!title) return "general";
  for (const rule of RULES) {
    if (rule.re.test(title)) return rule.dept;
  }
  return "general";
}

/** Display metadata; icon names resolve in the React layer. */
export const DEPARTMENT_META: Record<Department, { label: string; color: string; soft: string }> = {
  it: { label: "IT", color: "#1F7AC8", soft: "#E5F1FA" },
  engineering: { label: "Engineering", color: "#5B4FD8", soft: "#EDEBFB" },
  finance: { label: "Finance", color: "#0E9F76", soft: "#E2F5EE" },
  operations: { label: "Operations", color: "#C87A1F", soft: "#FBF0DA" },
  marketing: { label: "Marketing", color: "#C2417A", soft: "#FAE6F0" },
  procurement: { label: "Procurement", color: "#697386", soft: "#EDF0F4" },
  general: { label: "Contact", color: "#98A2B2", soft: "#EEF1F5" },
};
