export type Category = {
  id: string;
  label: string;
  icon: string; // lucide name
  color: string;
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "video", label: "Vidéo & Streaming", icon: "PlaySquare", color: "#EF4444" },
  { id: "music", label: "Musique", icon: "Music", color: "#8B5CF6" },
  { id: "banking", label: "Banque & Finance", icon: "Landmark", color: "#10B981" },
  { id: "software", label: "Logiciels", icon: "Monitor", color: "#3B82F6" },
  { id: "gaming", label: "Jeux vidéo", icon: "Gamepad2", color: "#F59E0B" },
  { id: "fitness", label: "Sport & Fitness", icon: "Dumbbell", color: "#EC4899" },
  { id: "cloud", label: "Stockage Cloud", icon: "Cloud", color: "#0EA5E9" },
  { id: "news", label: "Presse & News", icon: "Newspaper", color: "#6366F1" },
  { id: "education", label: "Éducation", icon: "GraduationCap", color: "#14B8A6" },
  { id: "telecom", label: "Téléphonie & Internet", icon: "Wifi", color: "#84CC16" },
  { id: "shopping", label: "Shopping & Livraison", icon: "ShoppingBag", color: "#F97316" },
  { id: "insurance", label: "Assurance", icon: "ShieldCheck", color: "#06B6D4" },
  { id: "services", label: "Services divers", icon: "Briefcase", color: "#64748B" },
  { id: "other", label: "Autre", icon: "MoreHorizontal", color: "#9CA3AF" },
];

export function findCategory(id: string, customCats: Category[] = []): Category {
  return (
    [...DEFAULT_CATEGORIES, ...customCats].find((c) => c.id === id) ||
    DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1]
  );
}
