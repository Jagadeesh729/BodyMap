
import { Link } from "react-router-dom";
import { Target, Home, TrendingUp, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";

const HomePage = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const testimonials = [
    {
      name: "Sarah Johnson",
      text: "BodyMap transformed my fitness journey! Lost 15 pounds in 2 months with their personalized plan.",
      image: "/placeholder.svg"
    },
    {
      name: "Mike Chen",
      text: "Finally found a program that works with my busy schedule. The AI really gets it!",
      image: "/placeholder.svg"
    },
    {
      name: "Emma Davis",
      text: "The home workouts are amazing. No gym needed and I'm seeing incredible results!",
      image: "/placeholder.svg"
    }
  ];

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  // Scroll to contact section if URL contains #contact
  useEffect(() => {
    if (window.location.hash === '#contact') {
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-electric-purple/10 to-neon-green/10"></div>
        <div className="relative max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-poppins font-bold text-primary-text mb-6">
            Your Personalized Fitness &<br />
            <span className="text-neon-green">Diet Plan</span> Starts Here
          </h1>
          <p className="text-xl sm:text-2xl text-secondary-text mb-8 max-w-3xl mx-auto font-open-sans">
            Customized to your goals, equipment, and lifestyle. No trainer needed.
          </p>
          <Link to="/create-plan" className="btn-primary text-lg">
            Create Your Plan
          </Link>
        </div>
        
        {/* Abstract gym illustration placeholder */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-neon-green/5 to-electric-purple/5 rounded-full blur-3xl -z-10"></div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-poppins font-bold text-center text-primary-text mb-16">
            Why Choose BodyMap?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card-dark text-center">
              <div className="w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target className="w-8 h-8 text-neon-green" />
              </div>
              <h3 className="text-xl font-poppins font-semibold text-primary-text mb-4">
                Fully Personalized
              </h3>
              <p className="text-secondary-text font-open-sans leading-relaxed">
                Tailored workouts and meals based on your unique goals, fitness level, and equipment availability.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card-dark text-center">
              <div className="w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Home className="w-8 h-8 text-neon-green" />
              </div>
              <h3 className="text-xl font-poppins font-semibold text-primary-text mb-4">
                Home Friendly
              </h3>
              <p className="text-secondary-text font-open-sans leading-relaxed">
                No gym required! Our plans work with minimal equipment and can be done anywhere.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card-dark text-center">
              <div className="w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="w-8 h-8 text-neon-green" />
              </div>
              <h3 className="text-xl font-poppins font-semibold text-primary-text mb-4">
                AI-Powered Plans
              </h3>
              <p className="text-secondary-text font-open-sans leading-relaxed">
                Advanced AI creates personalized workout and nutrition plans tailored to your specific needs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-card-dark/50 to-transparent">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-poppins font-bold text-center text-primary-text mb-16">
            What Our Users Say
          </h2>
          
          <div className="relative">
            <div className="card-dark text-center max-w-2xl mx-auto">
              <div className="flex justify-center mb-6">
                <img 
                  src={testimonials[currentTestimonial].image} 
                  alt={testimonials[currentTestimonial].name}
                  className="w-16 h-16 rounded-full border-2 border-neon-green"
                />
              </div>
              <p className="text-secondary-text font-open-sans text-lg mb-6 leading-relaxed">
                "{testimonials[currentTestimonial].text}"
              </p>
              <h4 className="text-neon-green font-poppins font-semibold">
                {testimonials[currentTestimonial].name}
              </h4>
              <div className="flex justify-center mt-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-neon-green text-neon-green" />
                ))}
              </div>
            </div>

            {/* Navigation buttons */}
            <button 
              onClick={prevTestimonial}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 text-electric-purple hover:text-neon-green transition-colors"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button 
              onClick={nextTestimonial}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 text-electric-purple hover:text-neon-green transition-colors"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>

          {/* Dots indicator */}
          <div className="flex justify-center mt-8 space-x-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentTestimonial(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentTestimonial ? 'bg-neon-green' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-6">
            Ready to Transform Your Body?
          </h2>
          <p className="text-xl text-secondary-text mb-8 font-open-sans">
            Join thousands who've already started their fitness journey with BodyMap
          </p>
          <Link to="/create-plan" className="btn-primary text-lg">
            Get Started Now
          </Link>
        </div>
      </section>

      {/* Get In Touch Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-card-dark/30 to-transparent">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-poppins font-bold text-center text-primary-text mb-16">
            Get In Touch
          </h2>
          
          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-poppins font-semibold text-neon-green mb-4">
                  Ready to Start Your Journey?
                </h3>
                <p className="text-secondary-text font-open-sans leading-relaxed">
                  Have questions about our AI-powered fitness plans? Want to know more about how BodyMap can help you achieve your goals? We're here to help!
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-electric-purple/20 rounded-full flex items-center justify-center">
                    <span className="text-electric-purple font-bold">✉</span>
                  </div>
                  <span className="text-secondary-text font-open-sans">support@bodymap.ai</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-neon-green/20 rounded-full flex items-center justify-center">
                    <span className="text-neon-green font-bold">💬</span>
                  </div>
                  <span className="text-secondary-text font-open-sans">Live chat available 24/7</span>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="card-dark">
              <form className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-secondary-text font-open-sans mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    className="input-dark w-full"
                    placeholder="Enter your name"
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-secondary-text font-open-sans mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="input-dark w-full"
                    placeholder="Enter your email"
                  />
                </div>
                
                <div>
                  <label htmlFor="message" className="block text-secondary-text font-open-sans mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    className="input-dark w-full"
                    placeholder="Tell us how we can help you..."
                  ></textarea>
                </div>
                
                <button type="submit" className="btn-primary w-full">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card-dark py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-electric-purple font-poppins font-bold text-xl mb-4">BodyMap</h3>
              <p className="text-secondary-text font-open-sans">
                Your personal AI fitness and diet planner for a healthier you.
              </p>
            </div>
            <div>
              <h4 className="text-primary-text font-poppins font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-secondary-text hover:text-electric-purple transition-colors">About</Link></li>
                <li><a href="#contact" className="text-secondary-text hover:text-electric-purple transition-colors">Contact</a></li>
                <li><a href="#" className="text-secondary-text hover:text-electric-purple transition-colors">Privacy</a></li>
                <li><a href="#" className="text-secondary-text hover:text-electric-purple transition-colors">Terms</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-primary-text font-poppins font-semibold mb-4">Features</h4>
              <ul className="space-y-2">
                <li><span className="text-secondary-text">AI-Powered Plans</span></li>
                <li><span className="text-secondary-text">Home Workouts</span></li>
                <li><span className="text-secondary-text">Diet Planning</span></li>
                <li><span className="text-secondary-text">Progress Tracking</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-primary-text font-poppins font-semibold mb-4">Follow Us</h4>
              <div className="flex space-x-4">
                <a href="#" className="text-electric-purple hover:text-neon-green transition-colors">Instagram</a>
                <a href="#" className="text-electric-purple hover:text-neon-green transition-colors">Twitter</a>
                <a href="#" className="text-electric-purple hover:text-neon-green transition-colors">YouTube</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-secondary-text font-open-sans">
              © 2024 BodyMap. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
