import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
const EditPlanPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    mainGoal: "",
    bodyFocus: [] as string[],
    timePerDay: "",
    recoveryDays: "",
    sleepHours: "",
    stressLevel: ""
  });
  useEffect(() => {
    // Load existing plan data from localStorage
    const savedPlan = localStorage.getItem('bodyMapPlan');
    if (savedPlan) {
      const planData = JSON.parse(savedPlan);
      setFormData({
        mainGoal: planData.mainGoal || "",
        bodyFocus: planData.bodyFocus || [],
        timePerDay: planData.timePerDay || "",
        recoveryDays: planData.recoveryDays || "",
        sleepHours: planData.sleepHours || "",
        stressLevel: planData.stressLevel || ""
      });
    }
  }, []);
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleArrayToggle = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field as keyof typeof prev].includes(value) ? (prev[field as keyof typeof prev] as string[]).filter(item => item !== value) : [...(prev[field as keyof typeof prev] as string[]), value]
    }));
  };
  const handleSave = () => {
    // Update the saved plan with new data
    const savedPlan = localStorage.getItem('bodyMapPlan');
    if (savedPlan) {
      const planData = JSON.parse(savedPlan);
      const updatedPlan = {
        ...planData,
        ...formData
      };
      localStorage.setItem('bodyMapPlan', JSON.stringify(updatedPlan));
    }
    toast({
      title: "Plan Updated!",
      description: "Your fitness plan has been successfully updated."
    });
    navigate('/dashboard');
  };
  const handleRegeneratePlan = () => {
    toast({
      title: "Regenerating Plan...",
      description: "Your plan is being regenerated with updated preferences."
    });
    // In a real app, this would trigger a new AI generation
    setTimeout(() => {
      toast({
        title: "Plan Regenerated!",
        description: "Your new personalized plan is ready."
      });
      navigate('/weekly-plan');
    }, 2000);
  };
  return <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-4">
            Adjust Your Plan
          </h1>
          <p className="text-xl text-secondary-text font-open-sans">
            Modify your goals and preferences to better fit your needs
          </p>
        </div>

        {/* Edit Form */}
        <div className="card-dark">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              <div>
                <Label htmlFor="mainGoal" className="text-secondary-text">Main Goal</Label>
                <Select value={formData.mainGoal} onValueChange={value => handleInputChange('mainGoal', value)}>
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
                <Label htmlFor="timePerDay" className="text-secondary-text">Time Available Per Day</Label>
                <Select value={formData.timePerDay} onValueChange={value => handleInputChange('timePerDay', value)}>
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

              <div>
                <Label htmlFor="recoveryDays" className="text-secondary-text">Recovery Days Per Week</Label>
                <Select value={formData.recoveryDays} onValueChange={value => handleInputChange('recoveryDays', value)}>
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
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <div>
                <Label className="text-secondary-text mb-4 block">Body Focus Areas</Label>
                <div className="grid grid-cols-2 gap-4">
                  {['Belly', 'Arms', 'Legs', 'Butt', 'Chest', 'Back', 'Shoulders', 'Full Body'].map(area => <div key={area} className="flex items-center space-x-2">
                      <Checkbox id={area} checked={formData.bodyFocus.includes(area)} onCheckedChange={() => handleArrayToggle('bodyFocus', area)} className="border-gray-600 data-[state=checked]:bg-neon-green data-[state=checked]:border-neon-green" />
                      <Label htmlFor={area} className="text-secondary-text text-sm">
                        {area}
                      </Label>
                    </div>)}
                </div>
              </div>

              <div>
                <Label htmlFor="sleepHours" className="text-secondary-text">Sleep Hours Per Night</Label>
                <Select value={formData.sleepHours} onValueChange={value => handleInputChange('sleepHours', value)}>
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
                <Select value={formData.stressLevel} onValueChange={value => handleInputChange('stressLevel', value)}>
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

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t border-gray-800">
            <Button onClick={handleSave} className="btn-secondary">
              <Save className="w-4 h-4 mr-2" />
              Update Plan
            </Button>
            
            <Button onClick={handleRegeneratePlan} className="btn-coral">
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate with AI
            </Button>
          </div>
        </div>

        {/* AI Generation Info */}
        
      </div>
    </div>;
};
export default EditPlanPage;