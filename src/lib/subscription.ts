// Stripe product/price mapping
export const PLANS = {
  free: {
    name: "Gratuito",
    price: 0,
    product_id: null,
    price_id: null,
    limits: {
      max_rooms: 1,
      max_students_per_room: 30,
      ai_generations_per_month: 3,
      ai_corrections_per_month: 5,
      file_upload: false,
      advanced_analytics: false,
      peer_review: false,
      question_bank: false,
    },
  },
  professor: {
    name: "Professor",
    price: 29.90,
    product_id: "prod_U1yOTsueyuc6SQ",
    price_id: "price_1T3uRwEJXwH9kRz7OPi0FOdK",
    limits: {
      max_rooms: 5,
      max_students_per_room: 60,
      ai_generations_per_month: 30,
      ai_corrections_per_month: 100,
      file_upload: true,
      advanced_analytics: true,
      peer_review: true,
      question_bank: true,
    },
  },
  institutional: {
    name: "Institucional",
    price: 149.90,
    product_id: "prod_U1yOWsVEIi6joe",
    price_id: "price_1T3uS9EJXwH9kRz76cFUaOEc",
    limits: {
      max_rooms: -1, // unlimited
      max_students_per_room: -1,
      ai_generations_per_month: -1,
      ai_corrections_per_month: -1,
      file_upload: true,
      advanced_analytics: true,
      peer_review: true,
      question_bank: true,
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanByProductId(productId: string | null): PlanKey {
  if (!productId) return "free";
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
  }
  return "free";
}

export function getPlanLimits(planKey: PlanKey) {
  return PLANS[planKey].limits;
}
