// src/types/policy.ts
export interface Policy {
  uid: string;
  title: string;
  policy_type: string;
  details: string;
  effective_date?: string;
}