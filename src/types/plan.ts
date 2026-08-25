export interface DayPlan {
  day: string
  type: string
  duration: string
  focus: string[]
  isRest: boolean
  workout: {
    warmup: string[]
    main: string[]
    cooldown: string[]
  }
  meals: {
    breakfast: string
    lunch: string
    dinner: string
    snacks: string[]
  }
  totalCalories: number
}

export const DEFAULT_WEEKLY_PLAN: DayPlan[] = [
  {
    day: 'Day 1 - Monday',
    type: 'Upper Body Strength',
    duration: '45 mins',
    focus: ['Chest', 'Arms', 'Shoulders'],
    isRest: false,
    workout: {
      warmup: ['Arm circles (30s)', 'Jumping jacks (1 min)', 'Shoulder rolls (30s)'],
      main: [
        'Push-ups: 3 sets x 12 reps',
        'Dumbbell chest press: 3 sets x 10 reps',
        'Overhead shoulder press: 3 sets x 10 reps',
        'Bicep curls: 3 sets x 12 reps',
        'Tricep dips: 3 sets x 12 reps'
      ],
      cooldown: ['Chest opener stretch (1 min)', 'Arm across chest stretch (1 min)', 'Childs pose (1 min)']
    },
    meals: {
      breakfast: 'Oatmeal with fresh berries, chia seeds & protein powder (350 cal)',
      lunch: 'Grilled chicken breast with mixed greens, quinoa & olive oil (450 cal)',
      dinner: 'Baked salmon with roasted asparagus & sweet potato (500 cal)',
      snacks: ['Greek yogurt with honey (150 cal)', 'Apple with almond butter (150 cal)']
    },
    totalCalories: 1600
  },
  {
    day: 'Day 2 - Tuesday',
    type: 'Lower Body Focus',
    duration: '45 mins',
    focus: ['Legs', 'Glutes', 'Calves'],
    isRest: false,
    workout: {
      warmup: ['High knees (1 min)', 'Leg swings (1 min)', 'Bodyweight squats (15 reps)'],
      main: [
        'Goblet squats: 4 sets x 12 reps',
        'Walking lunges: 3 sets x 10 reps per leg',
        'Glute bridges: 3 sets x 15 reps',
        'Calf raises: 4 sets x 20 reps',
        'Wall sit: 3 sets x 45 seconds'
      ],
      cooldown: ['Hamstring stretch (1 min)', 'Quad stretch (1 min)', 'Pigeon pose (1 min)']
    },
    meals: {
      breakfast: 'Scrambled eggs (3) with whole wheat toast & spinach (380 cal)',
      lunch: 'Turkey wrap with avocado, lettuce & tomato (420 cal)',
      dinner: 'Lean beef stir-fry with broccoli & brown rice (480 cal)',
      snacks: ['Mixed handful of almonds & walnuts (180 cal)', 'Protein shake (140 cal)']
    },
    totalCalories: 1600
  },
  {
    day: 'Day 3 - Wednesday',
    type: 'Active Recovery',
    duration: '30 mins',
    focus: ['Mobility', 'Flexibility'],
    isRest: true,
    workout: {
      warmup: ['Gentle neck & shoulder rolls (2 mins)'],
      main: [
        'Light walking or cycling (20 mins)',
        'Full body yoga flow (10 mins)',
        'Foam rolling major muscle groups'
      ],
      cooldown: ['Deep diaphragmatic breathing (3 mins)']
    },
    meals: {
      breakfast: 'Berry smoothie bowl with granola & flaxseed (320 cal)',
      lunch: 'Mediterranean chickpea salad with feta & cucumber (400 cal)',
      dinner: 'Grilled white fish with roasted zucchini & quinoa (430 cal)',
      snacks: ['Cottage cheese with pineapple (150 cal)', 'Green tea with lemon']
    },
    totalCalories: 1300
  },
  {
    day: 'Day 4 - Thursday',
    type: 'Core & High-Intensity Cardio',
    duration: '40 mins',
    focus: ['Abs', 'Cardio', 'Endurance'],
    isRest: false,
    workout: {
      warmup: ['Jump rope simulation (2 mins)', 'Torso twists (1 min)', 'Cat-cow stretch (1 min)'],
      main: [
        'Plank hold: 3 sets x 60 seconds',
        'Bicycle crunches: 3 sets x 20 reps',
        'Mountain climbers: 4 sets x 30 seconds',
        'Russian twists: 3 sets x 20 reps',
        'Burpees: 3 sets x 10 reps'
      ],
      cooldown: ['Cobra stretch (1 min)', 'Seated forward fold (1 min)', 'Spinal twist (1 min)']
    },
    meals: {
      breakfast: 'Protein pancakes with blueberries & maple drizzle (390 cal)',
      lunch: 'Tuna salad bowl with avocado, greens & olive oil (430 cal)',
      dinner: 'Grilled chicken breast with roasted Brussels sprouts & rice (470 cal)',
      snacks: ['Carrot sticks with hummus (140 cal)', 'Dark chocolate square (70 cal)']
    },
    totalCalories: 1500
  },
  {
    day: 'Day 5 - Friday',
    type: 'Full Body Strength Circuit',
    duration: '50 mins',
    focus: ['Full Body', 'Compound Lifts'],
    isRest: false,
    workout: {
      warmup: ['Jumping jacks (2 mins)', 'Arm & leg swings (2 mins)', 'Inchworms (5 reps)'],
      main: [
        'Dumbbell thrusters: 3 sets x 10 reps',
        'Push-up to renegade row: 3 sets x 8 reps per side',
        'Romanian deadlifts: 3 sets x 12 reps',
        'Dumbbell lunges: 3 sets x 10 per leg',
        'Plank jacks: 3 sets x 20 reps'
      ],
      cooldown: ['Full body stretching routine (5 mins)']
    },
    meals: {
      breakfast: 'Avocado toast on sourdough with 2 poached eggs (420 cal)',
      lunch: 'Quinoa power bowl with tofu or chicken, edamame & tahini (460 cal)',
      dinner: 'Turkey meatballs with zucchini noodles & marinara (440 cal)',
      snacks: ['Protein bar (200 cal)', 'Fresh orange (80 cal)']
    },
    totalCalories: 1600
  },
  {
    day: 'Day 6 - Saturday',
    type: 'Active Recovery & Mobility',
    duration: '30 mins',
    focus: ['Recovery', 'Joint Health'],
    isRest: true,
    workout: {
      warmup: ['Gentle cat-cow stretches (2 mins)'],
      main: [
        'Outdoor hike or brisk neighborhood walk (30 mins)',
        'Targeted hip mobility exercises',
        'Deep hamstring and shoulder stretches'
      ],
      cooldown: ['Mindful meditation & relaxation (5 mins)']
    },
    meals: {
      breakfast: 'Greek yogurt parfait with mixed berries & chia seeds (340 cal)',
      lunch: 'Hearty vegetable lentil soup with whole grain roll (410 cal)',
      dinner: 'Baked cod with sweet potato wedges & green beans (430 cal)',
      snacks: ['Trail mix (160 cal)', 'Herbal peppermint tea']
    },
    totalCalories: 1340
  },
  {
    day: 'Day 7 - Sunday',
    type: 'Complete Rest & Nutrition Prep',
    duration: 'Rest',
    focus: ['Mental Recovery', 'Meal Prep'],
    isRest: true,
    workout: {
      warmup: [],
      main: [
        'Complete physical rest',
        'Hydration focus (3+ liters of water)',
        'Weekly meal prep and goal setting for next week'
      ],
      cooldown: []
    },
    meals: {
      breakfast: 'Weekend scramble: eggs, mushrooms, spinach & feta (420 cal)',
      lunch: 'Grilled chicken caesar wrap with side salad (460 cal)',
      dinner: 'Comfort bowl: grilled chicken with mashed sweet potato (440 cal)',
      snacks: ['Fresh seasonal fruit bowl (150 cal)']
    },
    totalCalories: 1470
  }
]