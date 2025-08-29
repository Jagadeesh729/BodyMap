
import { Link } from "react-router-dom";
import { TrendingUp, Calendar, Download, Edit, User, Target } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DashboardPage = () => {
  // Mock data - in a real app, this would come from your backend
  const weightData = [
    { week: 'Week 1', weight: 75 },
    { week: 'Week 2', weight: 74.5 },
    { week: 'Week 3', weight: 74 },
    { week: 'Week 4', weight: 73.5 },
    { week: 'Week 5', weight: 73 },
    { week: 'Week 6', weight: 72.8 },
  ];

  const userData = {
    name: "Umar",
    currentStreak: 12,
    totalWorkouts: 24,
    weightLoss: 2.2,
    startWeight: 75,
    currentWeight: 72.8,
    targetWeight: 70
  };

  const measurements = [
    { part: "Chest", current: 98, change: -2 },
    { part: "Waist", current: 85, change: -5 },
    { part: "Arms", current: 32, change: +1 },
    { part: "Thighs", current: 58, change: -3 },
  ];

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-2">
            Hello, {userData.name}! 👋
          </h1>
          <p className="text-xl text-secondary-text font-open-sans">
            Here's your progress overview
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="card-dark text-center">
            <div className="w-12 h-12 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-6 h-6 text-neon-green" />
            </div>
            <h3 className="text-2xl font-poppins font-bold text-primary-text">{userData.currentStreak}</h3>
            <p className="text-secondary-text font-open-sans">Day Streak</p>
          </div>

          <div className="card-dark text-center">
            <div className="w-12 h-12 bg-electric-purple/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-6 h-6 text-electric-purple" />
            </div>
            <h3 className="text-2xl font-poppins font-bold text-primary-text">{userData.totalWorkouts}</h3>
            <p className="text-secondary-text font-open-sans">Workouts Completed</p>
          </div>

          <div className="card-dark text-center">
            <div className="w-12 h-12 bg-bright-coral/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-6 h-6 text-bright-coral" />
            </div>
            <h3 className="text-2xl font-poppins font-bold text-primary-text">{userData.weightLoss}kg</h3>
            <p className="text-secondary-text font-open-sans">Weight Lost</p>
          </div>

          <div className="card-dark text-center">
            <div className="w-12 h-12 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-6 h-6 text-neon-green" />
            </div>
            <h3 className="text-2xl font-poppins font-bold text-primary-text">{userData.currentWeight}kg</h3>
            <p className="text-secondary-text font-open-sans">Current Weight</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Weight Chart */}
          <div className="card-dark">
            <h2 className="text-xl font-poppins font-semibold text-primary-text mb-6">Weight Progress</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="week" stroke="#E0E0E0" />
                  <YAxis stroke="#E0E0E0" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1E1E1E', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#E0E0E0'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="#00FF88" 
                    strokeWidth={3}
                    dot={{ fill: '#00FF88', strokeWidth: 2, r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center">
              <p className="text-secondary-text font-open-sans">
                Target: <span className="text-bright-coral font-semibold">{userData.targetWeight}kg</span>
              </p>
            </div>
          </div>

          {/* Body Measurements */}
          <div className="card-dark">
            <h2 className="text-xl font-poppins font-semibold text-primary-text mb-6">Body Measurements</h2>
            <div className="space-y-4">
              {measurements.map((measurement, index) => (
                <div key={index} className="flex justify-between items-center p-4 bg-bodymap-dark rounded-lg">
                  <span className="text-secondary-text font-open-sans">{measurement.part}</span>
                  <div className="text-right">
                    <span className="text-primary-text font-semibold">{measurement.current}cm</span>
                    <span className={`ml-2 text-sm font-semibold ${
                      measurement.change > 0 ? 'text-bright-coral' : 'text-neon-green'
                    }`}>
                      {measurement.change > 0 ? '+' : ''}{measurement.change}cm
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid md:grid-cols-3 gap-6">
          <Link to="/weekly-plan" className="block">
            <div className="card-dark hover:bg-gray-800 transition-colors cursor-pointer group">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-electric-purple/20 rounded-full flex items-center justify-center group-hover:bg-electric-purple/30 transition-colors">
                  <Calendar className="w-6 h-6 text-electric-purple" />
                </div>
                <div>
                  <h3 className="text-lg font-poppins font-semibold text-primary-text">View My Weekly Plan</h3>
                  <p className="text-secondary-text font-open-sans">See your personalized workout schedule</p>
                </div>
              </div>
            </div>
          </Link>

          <Link to="/edit-plan" className="block">
            <div className="card-dark hover:bg-gray-800 transition-colors cursor-pointer group">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-bright-coral/20 rounded-full flex items-center justify-center group-hover:bg-bright-coral/30 transition-colors">
                  <Edit className="w-6 h-6 text-bright-coral" />
                </div>
                <div>
                  <h3 className="text-lg font-poppins font-semibold text-primary-text">Edit Plan</h3>
                  <p className="text-secondary-text font-open-sans">Adjust your goals and preferences</p>
                </div>
              </div>
            </div>
          </Link>

          <Link to="/download-plan" className="block">
            <div className="card-dark hover:bg-gray-800 transition-colors cursor-pointer group">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-neon-green/20 rounded-full flex items-center justify-center group-hover:bg-neon-green/30 transition-colors">
                  <Download className="w-6 h-6 text-neon-green" />
                </div>
                <div>
                  <h3 className="text-lg font-poppins font-semibold text-primary-text">Download PDF</h3>
                  <p className="text-secondary-text font-open-sans">Get a printable version of your plan</p>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Motivational Quote */}
        <div className="mt-12 text-center">
          <div className="card-dark max-w-2xl mx-auto bg-gradient-to-r from-neon-green/10 to-electric-purple/10">
            <h3 className="text-lg font-poppins font-semibold text-neon-green mb-2">Today's Motivation</h3>
            <p className="text-secondary-text font-open-sans text-lg italic">
              "Your body can stand almost anything. It's your mind you have to convince."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
