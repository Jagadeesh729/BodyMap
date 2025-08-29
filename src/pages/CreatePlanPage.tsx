import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

const CreatePlanPage = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Personal Details
    age: "",
    gender: "",
    height: "",
    weight: "",
    fitnessLevel: "",
    
    // Step 2: Goals
    mainGoal: "",
    bodyFocus: [] as string[],
    timePerDay: "",
    
    // Step 3: Health & Equipment
    medicalIssues: "",
    equipment: [] as string[],
    photo: null as File | null,
    pushupCount: "",
    
    // Step 4: Diet Preferences
    dietaryPreference: "",
    allergies: "",
    specialRequests: "",
    
    // Step 5: Recovery & Lifestyle
    recoveryDays: "",
    sleepHours: "",
    stressLevel: ""
  });

  const totalSteps = 5;

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayToggle = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field as keyof typeof prev] as string[]).includes(value)
        ? (prev[field as keyof typeof prev] as string[]).filter(item => item !== value)
        : [...(prev[field as keyof typeof prev] as string[]), value]
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, photo: file }));
    }
  };

  const generateGeminiPrompt = () => {
    return `You are an expert fitness and nutrition coach.

Generate a personalized 7-day home workout and diet plan based on these details:

- Age: ${formData.age}
- Gender: ${formData.gender}
- Height: ${formData.height} cm
- Weight: ${formData.weight} kg
- Fitness Level: ${formData.fitnessLevel}
- Goal: ${formData.mainGoal}
- Focus Areas: ${formData.bodyFocus.join(', ')}
- Time per Day: ${formData.timePerDay} minutes
- Equipment: ${formData.equipment.join(', ')}
- Medical Issues: ${formData.medicalIssues}
- Dietary Preference: ${formData.dietaryPreference}
- Allergies: ${formData.allergies}
- Sleep: ${formData.sleepHours}
- Stress Level: ${formData.stressLevel}
- Recovery Days: ${formData.recoveryDays}

Instructions:
1. Divide into 7 days.
2. Automatically add recovery days per user's preference.
3. For workout days:
   - Warm-up, main exercises, cooldown.
   - Focus on chosen body parts but cover all.
   - Include duration, intensity.
4. For each day, provide:
   - Breakfast, Lunch, Dinner
   - 1-2 Snacks
   - Approximate calories
5. Format in Markdown.
6. End with motivational quote.

Example format:
Day 1: [Workout]
- Warm-up:
- Main:
- Cooldown:
- Target:
- Meals:
Day 2: Rest

Motivational Quote:
"Your body can stand almost anything. It's your mind you have to convince."`;
  };

  const generatePlanWithGemini = async () => {
    const prompt = generateGeminiPrompt();
    
    try {
      // This is a placeholder for Gemini AI integration
      // In a real app, you would make an API call to Gemini AI here
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer YOUR_GEMINI_API_KEY` // User needs to add their API key
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate plan');
      }

      const data = await response.json();
      const generatedPlan = data.candidates[0].content.parts[0].text;
      
      return generatedPlan;
    } catch (error) {
      console.error('Error generating plan:', error);
      // Fallback to mock data for demo purposes
      return `# Your Personalized 7-Day BodyMap Plan

## Day 1: Upper Body Focus
**Workout:**
- Warm-up: 5 minutes light cardio
- Main: Push-ups (3x10), Dumbbell rows (3x12), Shoulder press (3x10)
- Cooldown: 5 minutes stretching

**Meals:**
- Breakfast: Oatmeal with berries (350 cal)
- Lunch: Grilled chicken salad (450 cal)
- Dinner: Salmon with quinoa (500 cal)
- Snacks: Greek yogurt (150 cal)

## Day 2: Rest Day
**Active Recovery:**
- Light walking or yoga
- Focus on hydration and meal prep

**Meals:**
- Breakfast: Protein smoothie (300 cal)
- Lunch: Turkey wrap (400 cal)
- Dinner: Vegetable stir-fry (450 cal)
- Snacks: Almonds (200 cal)

## Day 3: Lower Body Focus
**Workout:**
- Warm-up: 5 minutes dynamic stretching
- Main: Squats (3x15), Lunges (3x12), Calf raises (3x15)
- Cooldown: 5 minutes stretching

**Meals:**
- Breakfast: Eggs with toast (400 cal)
- Lunch: Quinoa bowl (500 cal)
- Dinner: Lean beef with vegetables (550 cal)
- Snacks: Apple with peanut butter (200 cal)

## Day 4: Cardio & Core
**Workout:**
- Warm-up: 3 minutes jumping jacks
- Main: Burpees (3x8), Plank (3x30s), Mountain climbers (3x20)
- Cooldown: 5 minutes stretching

**Meals:**
- Breakfast: Greek yogurt parfait (350 cal)
- Lunch: Tuna salad (400 cal)
- Dinner: Chicken breast with sweet potato (500 cal)
- Snacks: Mixed berries (100 cal)

## Day 5: Full Body
**Workout:**
- Warm-up: 5 minutes light movement
- Main: Push-ups, squats, rows combined circuit (3 rounds)
- Cooldown: 10 minutes stretching

**Meals:**
- Breakfast: Protein pancakes (400 cal)
- Lunch: Veggie burger (450 cal)
- Dinner: Fish tacos (500 cal)
- Snacks: Protein bar (250 cal)

## Day 6: Rest Day
**Active Recovery:**
- Gentle yoga or walking
- Meal preparation

**Meals:**
- Breakfast: Smoothie bowl (350 cal)
- Lunch: Chicken soup (350 cal)
- Dinner: Pasta with vegetables (500 cal)
- Snacks: Trail mix (200 cal)

## Day 7: Strength Focus
**Workout:**
- Warm-up: 5 minutes dynamic warm-up
- Main: Dumbbell circuit targeting all major muscle groups
- Cooldown: 10 minutes stretching

**Meals:**
- Breakfast: Avocado toast (400 cal)
- Lunch: Buddha bowl (500 cal)
- Dinner: Grilled chicken with rice (550 cal)
- Snacks: Cottage cheese (150 cal)

## Motivational Quote
"Your body can stand almost anything. It's your mind you have to convince."

---
*Generated by BodyMap AI - Your Personal Fitness Coach*`;
    }
  };

  const downloadPlan = (planContent: string) => {
    const blob = new Blob([planContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bodymap-fitness-plan.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsGenerating(true);
    
    try {
      toast({
        title: "Generating Your Plan",
        description: "Please wait while we create your personalized fitness plan...",
      });

      const generatedPlan = await generatePlanWithGemini();
      
      // Download the plan automatically
      downloadPlan(generatedPlan);
      
      // Store form data in localStorage for future reference
      localStorage.setItem('bodyMapPlan', JSON.stringify(formData));
      localStorage.setItem('generatedPlan', generatedPlan);
      
      toast({
        title: "Plan Generated Successfully!",
        description: "Your personalized fitness plan has been downloaded automatically.",
      });
      
      // Navigate to weekly plan page
      navigate('/weekly-plan');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate plan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex justify-center mb-8">
      {[...Array(totalSteps)].map((_, index) => (
        <div key={index} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              index + 1 <= currentStep
                ? 'bg-neon-green text-bodymap-dark'
                : 'bg-gray-700 text-secondary-text'
            }`}
          >
            {index + 1}
          </div>
          {index < totalSteps - 1 && (
            <div
              className={`w-16 h-1 ${
                index + 1 < currentStep ? 'bg-neon-green' : 'bg-gray-700'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-6">Personal Details</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="age" className="text-secondary-text">Age</Label>
          <Input
            id="age"
            type="number"
            value={formData.age}
            onChange={(e) => handleInputChange('age', e.target.value)}
            className="input-dark"
            placeholder="Enter your age"
          />
        </div>
        
        <div>
          <Label htmlFor="gender" className="text-secondary-text">Gender</Label>
          <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
            <SelectTrigger className="input-dark">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent className="bg-card-dark border-gray-700">
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="height" className="text-secondary-text">Height (cm)</Label>
          <Input
            id="height"
            type="number"
            value={formData.height}
            onChange={(e) => handleInputChange('height', e.target.value)}
            className="input-dark"
            placeholder="Enter height in cm"
          />
        </div>
        
        <div>
          <Label htmlFor="weight" className="text-secondary-text">Weight (kg)</Label>
          <Input
            id="weight"
            type="number"
            value={formData.weight}
            onChange={(e) => handleInputChange('weight', e.target.value)}
            className="input-dark"
            placeholder="Enter weight in kg"
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="fitnessLevel" className="text-secondary-text">Fitness Level</Label>
        <Select value={formData.fitnessLevel} onValueChange={(value) => handleInputChange('fitnessLevel', value)}>
          <SelectTrigger className="input-dark">
            <SelectValue placeholder="Select your fitness level" />
          </SelectTrigger>
          <SelectContent className="bg-card-dark border-gray-700">
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-6">Your Goals</h2>
      
      <div>
        <Label htmlFor="mainGoal" className="text-secondary-text">Main Goal</Label>
        <Select value={formData.mainGoal} onValueChange={(value) => handleInputChange('mainGoal', value)}>
          <SelectTrigger className="input-dark">
            <SelectValue placeholder="Select your main goal" />
          </SelectTrigger>
          <SelectContent className="bg-card-dark border-gray-700">
            <SelectItem value="slim">Slim Down</SelectItem>
            <SelectItem value="bulk">Bulk Up</SelectItem>
            <SelectItem value="muscle">Build Muscle</SelectItem>
            <SelectItem value="strength">Gain Strength</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label className="text-secondary-text mb-4 block">Body Focus Areas</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Belly', 'Arms', 'Legs', 'Butt', 'Chest', 'Back', 'Shoulders', 'Full Body'].map((area) => (
            <div key={area} className="flex items-center space-x-2">
              <Checkbox
                id={area}
                checked={formData.bodyFocus.includes(area)}
                onCheckedChange={() => handleArrayToggle('bodyFocus', area)}
                className="border-gray-600 data-[state=checked]:bg-neon-green data-[state=checked]:border-neon-green"
              />
              <Label htmlFor={area} className="text-secondary-text text-sm">
                {area}
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <Label htmlFor="timePerDay" className="text-secondary-text">Time Available Per Day</Label>
        <Select value={formData.timePerDay} onValueChange={(value) => handleInputChange('timePerDay', value)}>
          <SelectTrigger className="input-dark">
            <SelectValue placeholder="Select workout duration" />
          </SelectTrigger>
          <SelectContent className="bg-card-dark border-gray-700">
            <SelectItem value="15">15 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="45">45 minutes</SelectItem>
            <SelectItem value="60">1 hour</SelectItem>
            <SelectItem value="90">1.5 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-6">Health & Equipment</h2>
      
      <div>
        <Label htmlFor="medicalIssues" className="text-secondary-text">Medical Issues or Injuries</Label>
        <Textarea
          id="medicalIssues"
          value={formData.medicalIssues}
          onChange={(e) => handleInputChange('medicalIssues', e.target.value)}
          className="input-dark"
          placeholder="List any medical conditions, injuries, or limitations..."
          rows={3}
        />
      </div>
      
      <div>
        <Label className="text-secondary-text mb-4 block">Available Equipment</Label>
        <div className="grid grid-cols-2 gap-4">
          {['Dumbbells', 'Resistance Bands', 'Yoga Mat', 'Pull-up Bar', 'Kettlebell', 'None'].map((equipment) => (
            <div key={equipment} className="flex items-center space-x-2">
              <Checkbox
                id={equipment}
                checked={formData.equipment.includes(equipment)}
                onCheckedChange={() => handleArrayToggle('equipment', equipment)}
                className="border-gray-600 data-[state=checked]:bg-neon-green data-[state=checked]:border-neon-green"
              />
              <Label htmlFor={equipment} className="text-secondary-text">
                {equipment}
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <Label htmlFor="photo" className="text-secondary-text">Optional Photo Upload</Label>
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
          <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <input
            type="file"
            id="photo"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label htmlFor="photo" className="cursor-pointer">
            <span className="text-secondary-text">Click to upload a photo</span>
            {formData.photo && (
              <p className="text-neon-green mt-2">✓ {formData.photo.name}</p>
            )}
          </label>
        </div>
      </div>
      
      <div>
        <Label htmlFor="pushupCount" className="text-secondary-text">Strength Test: How many push-ups can you do?</Label>
        <Input
          id="pushupCount"
          type="number"
          value={formData.pushupCount}
          onChange={(e) => handleInputChange('pushupCount', e.target.value)}
          className="input-dark"
          placeholder="Enter number of push-ups"
        />
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-6">Diet Preferences</h2>
      
      <div>
        <Label htmlFor="dietaryPreference" className="text-secondary-text">Dietary Preference</Label>
        <Select value={formData.dietaryPreference} onValueChange={(value) => handleInputChange('dietaryPreference', value)}>
          <SelectTrigger className="input-dark">
            <SelectValue placeholder="Select dietary preference" />
          </SelectTrigger>
          <SelectContent className="bg-card-dark border-gray-700">
            <SelectItem value="omnivore">Omnivore</SelectItem>
            <SelectItem value="vegetarian">Vegetarian</SelectItem>
            <SelectItem value="vegan">Vegan</SelectItem>
            <SelectItem value="keto">Keto</SelectItem>
            <SelectItem value="paleo">Paleo</SelectItem>
            <SelectItem value="mediterranean">Mediterranean</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="allergies" className="text-secondary-text">Food Allergies & Intolerances</Label>
        <Textarea
          id="allergies"
          value={formData.allergies}
          onChange={(e) => handleInputChange('allergies', e.target.value)}
          className="input-dark"
          placeholder="List any food allergies or intolerances..."
          rows={3}
        />
      </div>
      
      <div>
        <Label htmlFor="specialRequests" className="text-secondary-text">Special Dietary Requests</Label>
        <Textarea
          id="specialRequests"
          value={formData.specialRequests}
          onChange={(e) => handleInputChange('specialRequests', e.target.value)}
          className="input-dark"
          placeholder="Any specific foods you love/hate, meal preferences, etc..."
          rows={3}
        />
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-6">Recovery & Lifestyle</h2>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <Label htmlFor="recoveryDays" className="text-secondary-text">Recovery Days Per Week</Label>
          <Select value={formData.recoveryDays} onValueChange={(value) => handleInputChange('recoveryDays', value)}>
            <SelectTrigger className="input-dark">
              <SelectValue placeholder="Select days" />
            </SelectTrigger>
            <SelectContent className="bg-card-dark border-gray-700">
              <SelectItem value="1">1 day</SelectItem>
              <SelectItem value="2">2 days</SelectItem>
              <SelectItem value="3">3 days</SelectItem>
              <SelectItem value="4">4 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="sleepHours" className="text-secondary-text">Sleep Hours Per Night</Label>
          <Select value={formData.sleepHours} onValueChange={(value) => handleInputChange('sleepHours', value)}>
            <SelectTrigger className="input-dark">
              <SelectValue placeholder="Select hours" />
            </SelectTrigger>
            <SelectContent className="bg-card-dark border-gray-700">
              <SelectItem value="4-5">4-5 hours</SelectItem>
              <SelectItem value="6-7">6-7 hours</SelectItem>
              <SelectItem value="8-9">8-9 hours</SelectItem>
              <SelectItem value="10+">10+ hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="stressLevel" className="text-secondary-text">Stress Level</Label>
          <Select value={formData.stressLevel} onValueChange={(value) => handleInputChange('stressLevel', value)}>
            <SelectTrigger className="input-dark">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent className="bg-card-dark border-gray-700">
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-4">
            Tell Us About You
          </h1>
          <p className="text-xl text-secondary-text font-open-sans">
            Answer a few questions to generate your weekly plan
          </p>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Form Content */}
        <div className="card-dark">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-800">
            <Button
              onClick={prevStep}
              disabled={currentStep === 1 || isGenerating}
              variant="outline"
              className="border-gray-600 text-secondary-text hover:bg-gray-800"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            {currentStep < totalSteps ? (
              <Button onClick={nextStep} className="btn-secondary" disabled={isGenerating}>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="btn-primary" disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Your Plan...
                  </>
                ) : (
                  "Generate My Plan"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Loading Overlay */}
        {isGenerating && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="card-dark text-center max-w-md mx-4">
              <Loader2 className="w-12 h-12 animate-spin text-neon-green mx-auto mb-4" />
              <h3 className="text-xl font-poppins font-semibold text-primary-text mb-2">
                Generating Your Plan
              </h3>
              <p className="text-secondary-text font-open-sans">
                Please wait while we create your personalized fitness and diet plan...
              </p>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-bright-coral/20 border border-bright-coral/50 rounded-lg p-4 mt-8 flex items-start space-x-3">
          <AlertTriangle className="w-6 h-6 text-bright-coral flex-shrink-0 mt-0.5" />
          <p className="text-secondary-text font-open-sans">
            <strong className="text-bright-coral">Important:</strong> Always consult with a healthcare professional before starting any new fitness program, especially if you have medical conditions or injuries.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreatePlanPage;
