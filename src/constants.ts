export interface UserProgram {
  id: string;
  first_name: string;
  age: number;
  fitness_level: "beginner" | "intermediate" | "advanced";
  fitness_goal: string;
  workout_days: number;
  equipment_access: string;
  profilePic: string;
  workout_plan: {
    title: string;
    description: string;
  };
  diet_plan: {
    title: string;
  };
}

export const USER_PROGRAMS: UserProgram[] = [
  {
    id: "001",
    first_name: "Alex",
    age: 28,
    fitness_level: "intermediate",
    fitness_goal: "Muscle Building",
    workout_days: 4,
    equipment_access: "Full gym access",
    profilePic: "/ai1.png",
    workout_plan: {
      title: "Strength Focus Program",
      description: "A comprehensive 4-day split focusing on progressive overload and muscle hypertrophy. Includes compound movements and isolation exercises for balanced development."
    },
    diet_plan: {
      title: "High Protein Diet"
    }
  },
  {
    id: "002", 
    first_name: "Sarah",
    age: 24,
    fitness_level: "beginner",
    fitness_goal: "Weight Loss",
    workout_days: 3,
    equipment_access: "Home equipment only",
    profilePic: "/ai2.png",
    workout_plan: {
      title: "Fat Loss Circuit",
      description: "Beginner-friendly circuit training designed for fat loss and cardiovascular improvement. Low-impact exercises perfect for starting your fitness journey."
    },
    diet_plan: {
      title: "Calorie Deficit Plan"
    }
  },
  {
    id: "003",
    first_name: "Mike",
    age: 32,
    fitness_level: "advanced",
    fitness_goal: "Athletic Performance",
    workout_days: 5,
    equipment_access: "Professional gym",
    profilePic: "/ai1.png",
    workout_plan: {
      title: "Elite Performance Training",
      description: "Advanced training protocol combining strength, power, and conditioning. Designed for athletes looking to maximize performance and competitive edge."
    },
    diet_plan: {
      title: "Performance Nutrition"
    }
  }
];
