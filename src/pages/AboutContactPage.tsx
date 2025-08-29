
import { Mail, MessageCircle, Heart, Target, Users, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const AboutContactPage = () => {
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    message: ""
  });

  const handleInputChange = (field: string, value: string) => {
    setContactForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message Sent!",
      description: "Thank you for contacting us. We'll get back to you soon!",
    });
    setContactForm({ name: "", email: "", message: "" });
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* About Section */}
        <section className="mb-20">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-poppins font-bold text-primary-text mb-6">
              About <span className="text-neon-green">BodyMap</span>
            </h1>
            <p className="text-xl text-secondary-text font-open-sans max-w-3xl mx-auto leading-relaxed">
              We're revolutionizing fitness with AI-powered personalization, making healthy living 
              accessible to everyone, everywhere.
            </p>
          </div>

          {/* Mission Statement */}
          <div className="card-dark mb-12 bg-gradient-to-r from-neon-green/10 to-electric-purple/10">
            <div className="text-center">
              <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-4">Our Mission</h2>
              <p className="text-secondary-text font-open-sans text-lg leading-relaxed">
                To democratize fitness by providing personalized, AI-driven workout and nutrition plans 
                that adapt to your unique lifestyle, goals, and constraints. No gym membership required, 
                no expensive trainers needed – just science-backed fitness that works for you.
              </p>
            </div>
          </div>

          {/* Core Values */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="card-dark text-center">
              <div className="w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="w-8 h-8 text-neon-green" />
              </div>
              <h3 className="text-xl font-poppins font-semibold text-primary-text mb-4">Health First</h3>
              <p className="text-secondary-text font-open-sans leading-relaxed">
                Every recommendation is backed by exercise science and nutrition research, 
                prioritizing your long-term health and sustainable results.
              </p>
            </div>

            <div className="card-dark text-center">
              <div className="w-16 h-16 bg-electric-purple/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target className="w-8 h-8 text-electric-purple" />
              </div>
              <h3 className="text-xl font-poppins font-semibold text-primary-text mb-4">Personalization</h3>
              <p className="text-secondary-text font-open-sans leading-relaxed">
                No two bodies are the same. Our AI considers your unique circumstances, 
                preferences, and limitations to create truly personalized plans.
              </p>
            </div>

            <div className="card-dark text-center">
              <div className="w-16 h-16 bg-bright-coral/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-bright-coral" />
              </div>
              <h3 className="text-xl font-poppins font-semibold text-primary-text mb-4">Accessibility</h3>
              <p className="text-secondary-text font-open-sans leading-relaxed">
                Fitness should be available to everyone, regardless of location, budget, or experience level. 
                We break down barriers to healthy living.
              </p>
            </div>
          </div>

          {/* Technology */}
          <div className="card-dark">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-6">
                  Powered by Advanced AI
                </h2>
                <p className="text-secondary-text font-open-sans mb-4 leading-relaxed">
                  BodyMap uses cutting-edge artificial intelligence to analyze your profile, goals, 
                  and constraints to generate personalized fitness and nutrition plans.
                </p>
                <ul className="space-y-2 text-secondary-text font-open-sans">
                  <li className="flex items-center">
                    <Zap className="w-4 h-4 text-neon-green mr-3" />
                    Machine learning algorithms for continuous improvement
                  </li>
                  <li className="flex items-center">
                    <Zap className="w-4 h-4 text-neon-green mr-3" />
                    Real-time adaptation based on your progress
                  </li>
                  <li className="flex items-center">
                    <Zap className="w-4 h-4 text-neon-green mr-3" />
                    Evidence-based exercise and nutrition recommendations
                  </li>
                  <li className="flex items-center">
                    <Zap className="w-4 h-4 text-neon-green mr-3" />
                    Integration with the latest fitness research
                  </li>
                </ul>
              </div>
              <div className="text-center">
                <div className="w-64 h-64 bg-gradient-to-br from-neon-green/20 to-electric-purple/20 rounded-full flex items-center justify-center mx-auto">
                  <div className="w-48 h-48 bg-gradient-to-br from-neon-green/30 to-bright-coral/30 rounded-full flex items-center justify-center">
                    <Zap className="w-24 h-24 text-neon-green" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-4">
              Get In Touch
            </h2>
            <p className="text-xl text-secondary-text font-open-sans">
              Have questions, feedback, or suggestions? We'd love to hear from you!
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="card-dark">
              <h3 className="text-xl font-poppins font-semibold text-primary-text mb-6">
                Send us a Message
              </h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name" className="text-secondary-text">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="input-dark"
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-secondary-text">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="input-dark"
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="message" className="text-secondary-text">Message</Label>
                  <Textarea
                    id="message"
                    value={contactForm.message}
                    onChange={(e) => handleInputChange('message', e.target.value)}
                    className="input-dark"
                    placeholder="Tell us what's on your mind..."
                    rows={5}
                    required
                  />
                </div>

                <Button type="submit" className="btn-primary w-full">
                  <Mail className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="space-y-8">
              <div className="card-dark">
                <h3 className="text-xl font-poppins font-semibold text-primary-text mb-6">
                  Other Ways to Reach Us
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-neon-green/20 rounded-full flex items-center justify-center">
                      <Mail className="w-6 h-6 text-neon-green" />
                    </div>
                    <div>
                      <h4 className="text-primary-text font-semibold">Email Support</h4>
                      <p className="text-secondary-text">support@bodymap.ai</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-electric-purple/20 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-electric-purple" />
                    </div>
                    <div>
                      <h4 className="text-primary-text font-semibold">Live Chat</h4>
                      <p className="text-secondary-text">Available 9 AM - 6 PM EST</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-dark">
                <h3 className="text-xl font-poppins font-semibold text-primary-text mb-6">
                  Follow Our Journey
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <a href="#" className="p-4 bg-bodymap-dark rounded-lg text-center hover:bg-gray-800 transition-colors">
                    <div className="text-electric-purple font-semibold">Instagram</div>
                    <div className="text-secondary-text text-sm">@bodymap_ai</div>
                  </a>
                  <a href="#" className="p-4 bg-bodymap-dark rounded-lg text-center hover:bg-gray-800 transition-colors">
                    <div className="text-electric-purple font-semibold">Twitter</div>
                    <div className="text-secondary-text text-sm">@bodymapai</div>
                  </a>
                  <a href="#" className="p-4 bg-bodymap-dark rounded-lg text-center hover:bg-gray-800 transition-colors">
                    <div className="text-electric-purple font-semibold">YouTube</div>
                    <div className="text-secondary-text text-sm">BodyMap AI</div>
                  </a>
                  <a href="#" className="p-4 bg-bodymap-dark rounded-lg text-center hover:bg-gray-800 transition-colors">
                    <div className="text-electric-purple font-semibold">TikTok</div>
                    <div className="text-secondary-text text-sm">@bodymap</div>
                  </a>
                </div>
              </div>

              <div className="card-dark bg-gradient-to-r from-neon-green/10 to-electric-purple/10">
                <h3 className="text-lg font-poppins font-semibold text-neon-green mb-3">
                  Join Our Community
                </h3>
                <p className="text-secondary-text font-open-sans mb-4">
                  Be part of thousands who are transforming their fitness journey with BodyMap.
                </p>
                <div className="flex space-x-4 text-sm">
                  <span className="bg-neon-green/20 text-neon-green px-3 py-1 rounded-full">10K+ Users</span>
                  <span className="bg-electric-purple/20 text-electric-purple px-3 py-1 rounded-full">50K+ Workouts</span>
                  <span className="bg-bright-coral/20 text-bright-coral px-3 py-1 rounded-full">98% Satisfaction</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutContactPage;
