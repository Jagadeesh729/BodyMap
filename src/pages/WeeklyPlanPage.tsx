
import { Link } from "react-router-dom";
import { Download, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const WeeklyPlanPage = () => {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const toggleDay = (dayIndex: number) => {
    setExpandedDay(expandedDay === dayIndex ? null : dayIndex);
  };

  // Mock weekly plan data
  const weeklyPlan = [
    {
      day: "Monday",
      type: "Upper Body Strength",
      focus: ["Chest", "Arms", "Shoulders"],
      duration: "45 minutes",
      isRest: false,
      workout: {
        warmup: ["5 min light cardio", "Arm circles", "Dynamic stretching"],
        main: [
          "Push-ups: 3 sets x 12 reps",
          "Dumbbell chest press: 3 sets x 10 reps",
          "Shoulder raises: 3 sets x 15 reps",
          "Tricep dips: 3 sets x 10 reps",
          "Bicep curls: 3 sets x 12 reps"
        ],
        cooldown: ["5 min stretching", "Deep breathing"]
      },
      meals: {
        breakfast: "Oatmeal with berries and nuts (350 cal)",
        lunch: "Grilled chicken salad (450 cal)",
        dinner: "Salmon with quinoa and vegetables (500 cal)",
        snacks: ["Greek yogurt (120 cal)", "Apple with almond butter (180 cal)"]
      },
      totalCalories: 1600
    },
    {
      day: "Tuesday",
      type: "Lower Body Focus",
      focus: ["Legs", "Glutes"],
      duration: "40 minutes",
      isRest: false,
      workout: {
        warmup: ["5 min marching in place", "Leg swings", "Hip circles"],
        main: [
          "Squats: 3 sets x 15 reps",
          "Lunges: 3 sets x 12 per leg",
          "Glute bridges: 3 sets x 15 reps",
          "Calf raises: 3 sets x 20 reps",
          "Wall sit: 3 sets x 30 seconds"
        ],
        cooldown: ["Leg stretches", "Foam rolling"]
      },
      meals: {
        breakfast: "Protein smoothie with banana (320 cal)",
        lunch: "Turkey wrap with vegetables (400 cal)",
        dinner: "Lean beef stir-fry (480 cal)",
        snacks: ["Mixed nuts (150 cal)", "Protein bar (180 cal)"]
      },
      totalCalories: 1530
    },
    {
      day: "Wednesday",
      type: "Rest Day",
      focus: [],
      duration: "Active recovery",
      isRest: true,
      workout: {
        warmup: [],
        main: ["Light walking", "Gentle yoga", "Meditation"],
        cooldown: []
      },
      meals: {
        breakfast: "Avocado toast with eggs (400 cal)",
        lunch: "Vegetable soup with whole grain bread (350 cal)",
        dinner: "Grilled fish with sweet potato (450 cal)",
        snacks: ["Cottage cheese with berries (130 cal)", "Herbal tea"]
      },
      totalCalories: 1330
    },
    {
      day: "Thursday",
      type: "Core & Abs",
      focus: ["Core", "Abs"],
      duration: "35 minutes",
      isRest: false,
      workout: {
        warmup: ["5 min light movement", "Torso twists", "Cat-cow stretches"],
        main: [
          "Plank: 3 sets x 45 seconds",
          "Russian twists: 3 sets x 20 reps",
          "Bicycle crunches: 3 sets x 15 per side",
          "Mountain climbers: 3 sets x 20 reps",
          "Dead bug: 3 sets x 10 per side"
        ],
        cooldown: ["Core stretches", "Child's pose"]
      },
      meals: {
        breakfast: "Greek yogurt parfait (300 cal)",
        lunch: "Quinoa bowl with vegetables (420 cal)",
        dinner: "Chicken breast with broccoli (460 cal)",
        snacks: ["Hummus with carrots (140 cal)", "Dark chocolate (80 cal)"]
      },
      totalCalories: 1400
    },
    {
      day: "Friday",
      type: "Full Body HIIT",
      focus: ["Full Body", "Cardio"],
      duration: "30 minutes",
      isRest: false,
      workout: {
        warmup: ["5 min dynamic warm-up", "Joint mobility"],
        main: [
          "Burpees: 4 sets x 8 reps",
          "Jump squats: 4 sets x 12 reps",
          "Push-up to T: 4 sets x 8 reps",
          "High knees: 4 sets x 30 seconds",
          "Plank jacks: 4 sets x 15 reps"
        ],
        cooldown: ["Full body stretch", "Cool down walk"]
      },
      meals: {
        breakfast: "Protein pancakes with berries (380 cal)",
        lunch: "Sushi bowl with edamame (440 cal)",
        dinner: "Turkey meatballs with zucchini noodles (420 cal)",
        snacks: ["Protein shake (160 cal)", "Rice cakes with peanut butter (120 cal)"]
      },
      totalCalories: 1520
    },
    {
      day: "Saturday",
      type: "Active Recovery",
      focus: ["Flexibility", "Mobility"],
      duration: "45 minutes",
      isRest: false,
      workout: {
        warmup: ["Gentle movement", "Joint rotations"],
        main: [
          "30 min yoga flow",
          "Foam rolling session",
          "Stretching routine",
          "Breathing exercises"
        ],
        cooldown: ["Meditation", "Relaxation"]
      },
      meals: {
        breakfast: "Smoothie bowl with granola (360 cal)",
        lunch: "Mediterranean salad (390 cal)",
        dinner: "Baked cod with roasted vegetables (430 cal)",
        snacks: ["Trail mix (140 cal)", "Green tea with honey"]
      },
      totalCalories: 1320
    },
    {
      day: "Sunday",
      type: "Rest Day",
      focus: [],
      duration: "Complete rest",
      isRest: true,
      workout: {
        warmup: [],
        main: ["Gentle walk if desired", "Meal prep", "Planning next week"],
        cooldown: []
      },
      meals: {
        breakfast: "Weekend brunch: Eggs Benedict (450 cal)",
        lunch: "Homemade pizza with salad (500 cal)",
        dinner: "Comfort meal: Grilled chicken with mashed cauliflower (420 cal)",
        snacks: ["Weekend treat: Small dessert (200 cal)"]
      },
      totalCalories: 1570
    }
  ];

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-4">
            Your Personalized Weekly Plan
          </h1>
          <p className="text-xl text-secondary-text font-open-sans">
            Your AI-generated fitness and nutrition schedule
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Link to="/download-plan" className="btn-primary">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Link>
          <Link to="/edit-plan" className="btn-coral">
            <Edit className="w-4 h-4 mr-2" />
            Edit Plan
          </Link>
        </div>

        {/* Weekly Schedule */}
        <div className="space-y-4">
          {weeklyPlan.map((day, index) => (
            <div key={index} className="card-dark">
              {/* Day Header */}
              <div 
                className="flex justify-between items-center cursor-pointer"
                onClick={() => toggleDay(index)}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-4 h-4 rounded-full ${
                    day.isRest ? 'bg-bright-coral' : 'bg-neon-green'
                  }`}></div>
                  <div>
                    <h3 className="text-xl font-poppins font-semibold text-primary-text">
                      {day.day}
                    </h3>
                    <p className="text-secondary-text font-open-sans">
                      {day.type} • {day.duration}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  {!day.isRest && day.focus.length > 0 && (
                    <div className="hidden sm:flex space-x-2">
                      {day.focus.map((bodyPart, idx) => (
                        <span 
                          key={idx}
                          className="px-3 py-1 bg-electric-purple/20 text-electric-purple rounded-full text-sm font-medium"
                        >
                          {bodyPart}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {expandedDay === index ? (
                    <ChevronUp className="w-5 h-5 text-secondary-text" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-secondary-text" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedDay === index && (
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <div className="grid lg:grid-cols-2 gap-8">
                    {/* Workout Details */}
                    <div>
                      <h4 className="text-lg font-poppins font-semibold text-primary-text mb-4">
                        {day.isRest ? "Recovery Activities" : "Workout Details"}
                      </h4>
                      
                      {!day.isRest && day.workout.warmup.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-neon-green font-semibold mb-2">Warm-up</h5>
                          <ul className="space-y-1">
                            {day.workout.warmup.map((exercise, idx) => (
                              <li key={idx} className="text-secondary-text">• {exercise}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="mb-4">
                        <h5 className="text-electric-purple font-semibold mb-2">
                          {day.isRest ? "Activities" : "Main Workout"}
                        </h5>
                        <ul className="space-y-1">
                          {day.workout.main.map((exercise, idx) => (
                            <li key={idx} className="text-secondary-text">• {exercise}</li>
                          ))}
                        </ul>
                      </div>
                      
                      {!day.isRest && day.workout.cooldown.length > 0 && (
                        <div>
                          <h5 className="text-bright-coral font-semibold mb-2">Cool-down</h5>
                          <ul className="space-y-1">
                            {day.workout.cooldown.map((exercise, idx) => (
                              <li key={idx} className="text-secondary-text">• {exercise}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Nutrition Plan */}
                    <div>
                      <h4 className="text-lg font-poppins font-semibold text-primary-text mb-4">
                        Daily Nutrition Plan
                      </h4>
                      
                      <div className="space-y-3">
                        <div className="p-3 bg-bodymap-dark rounded-lg">
                          <h5 className="text-neon-green font-semibold mb-1">Breakfast</h5>
                          <p className="text-secondary-text text-sm">{day.meals.breakfast}</p>
                        </div>
                        
                        <div className="p-3 bg-bodymap-dark rounded-lg">
                          <h5 className="text-electric-purple font-semibold mb-1">Lunch</h5>
                          <p className="text-secondary-text text-sm">{day.meals.lunch}</p>
                        </div>
                        
                        <div className="p-3 bg-bodymap-dark rounded-lg">
                          <h5 className="text-bright-coral font-semibold mb-1">Dinner</h5>
                          <p className="text-secondary-text text-sm">{day.meals.dinner}</p>
                        </div>
                        
                        <div className="p-3 bg-bodymap-dark rounded-lg">
                          <h5 className="text-gray-400 font-semibold mb-1">Snacks</h5>
                          <ul className="text-secondary-text text-sm">
                            {day.meals.snacks.map((snack, idx) => (
                              <li key={idx}>• {snack}</li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="text-center pt-2 border-t border-gray-700">
                          <span className="text-primary-text font-semibold">
                            Total: {day.totalCalories} calories
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Motivational Quote */}
        <div className="mt-12 text-center">
          <div className="card-dark max-w-2xl mx-auto bg-gradient-to-r from-neon-green/10 to-electric-purple/10">
            <h3 className="text-lg font-poppins font-semibold text-neon-green mb-2">Weekly Motivation</h3>
            <p className="text-secondary-text font-open-sans text-lg italic">
              "Success is the sum of small efforts repeated day in and day out."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyPlanPage;
