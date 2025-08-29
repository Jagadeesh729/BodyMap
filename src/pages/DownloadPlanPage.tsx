
import { Download, FileText, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const DownloadPlanPage = () => {
  const handleDownloadPDF = () => {
    // In a real app, this would generate and download a PDF
    toast({
      title: "Download Started",
      description: "Your personalized fitness plan PDF is being prepared...",
    });
    
    // Simulate download process
    setTimeout(() => {
      toast({
        title: "Download Complete!",
        description: "Your BodyMap fitness plan has been downloaded successfully.",
      });
    }, 2000);
  };

  const handleEmailPlan = () => {
    toast({
      title: "Email Sent!",
      description: "Your fitness plan has been sent to your email address.",
    });
  };

  const handleMobilePlan = () => {
    toast({
      title: "Mobile Link Sent!",
      description: "A mobile-friendly link has been sent to your phone.",
    });
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-4">
            Download Your Weekly Plan
          </h1>
          <p className="text-xl text-secondary-text font-open-sans">
            Get your personalized fitness and nutrition plan in multiple formats
          </p>
        </div>

        {/* Download Options */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* PDF Download */}
          <div className="card-dark text-center">
            <div className="w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-8 h-8 text-neon-green" />
            </div>
            <h3 className="text-xl font-poppins font-semibold text-primary-text mb-4">
              PDF Download
            </h3>
            <p className="text-secondary-text font-open-sans mb-6 leading-relaxed">
              Download a beautifully formatted PDF with your complete 7-day workout and meal plan.
            </p>
            <Button onClick={handleDownloadPDF} className="btn-primary w-full">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>

          {/* Email Option */}
          <div className="card-dark text-center">
            <div className="w-16 h-16 bg-electric-purple/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-electric-purple" />
            </div>
            <h3 className="text-xl font-poppins font-semibold text-primary-text mb-4">
              Email Plan
            </h3>
            <p className="text-secondary-text font-open-sans mb-6 leading-relaxed">
              Receive your plan directly in your inbox for easy access anywhere.
            </p>
            <Button onClick={handleEmailPlan} className="btn-secondary w-full">
              <Mail className="w-4 h-4 mr-2" />
              Email to Me
            </Button>
          </div>

          {/* Mobile Version */}
          <div className="card-dark text-center">
            <div className="w-16 h-16 bg-bright-coral/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Smartphone className="w-8 h-8 text-bright-coral" />
            </div>
            <h3 className="text-xl font-poppins font-semibold text-primary-text mb-4">
              Mobile Version
            </h3>
            <p className="text-secondary-text font-open-sans mb-6 leading-relaxed">
              Get a mobile-optimized link to access your plan on the go.
            </p>
            <Button onClick={handleMobilePlan} className="btn-coral w-full">
              <Smartphone className="w-4 h-4 mr-2" />
              Send to Phone
            </Button>
          </div>
        </div>

        {/* Plan Preview */}
        <div className="card-dark">
          <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-6">
            Plan Preview
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* What's Included */}
            <div>
              <h3 className="text-lg font-poppins font-semibold text-neon-green mb-4">
                What's Included in Your PDF:
              </h3>
              <ul className="space-y-2 text-secondary-text font-open-sans">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-neon-green rounded-full mr-3"></span>
                  Complete 7-day workout schedule
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-neon-green rounded-full mr-3"></span>
                  Detailed exercise instructions
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-neon-green rounded-full mr-3"></span>
                  Daily meal plans with calories
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-neon-green rounded-full mr-3"></span>
                  Progress tracking sheets
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-neon-green rounded-full mr-3"></span>
                  Motivational tips and quotes
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-neon-green rounded-full mr-3"></span>
                  Equipment alternatives
                </li>
              </ul>
            </div>

            {/* Format Details */}
            <div>
              <h3 className="text-lg font-poppins font-semibold text-electric-purple mb-4">
                Format Details:
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-bodymap-dark rounded-lg">
                  <h4 className="text-primary-text font-semibold mb-2">PDF Features</h4>
                  <ul className="text-sm text-secondary-text space-y-1">
                    <li>• High-quality, printable format</li>
                    <li>• Mobile-friendly layout</li>
                    <li>• Checkboxes for tracking</li>
                    <li>• Professional design</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-bodymap-dark rounded-lg">
                  <h4 className="text-primary-text font-semibold mb-2">File Size</h4>
                  <p className="text-sm text-secondary-text">
                    ~2.5 MB - optimized for quick download and sharing
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Options */}
        <div className="mt-8 card-dark bg-gradient-to-r from-neon-green/5 to-electric-purple/5">
          <h3 className="text-lg font-poppins font-semibold text-primary-text mb-4">
            Need Something Else?
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-neon-green font-semibold mb-2">Custom Modifications</h4>
              <p className="text-secondary-text font-open-sans text-sm">
                Want to adjust your plan? Head back to the Edit Plan page to make changes 
                and regenerate your personalized schedule.
              </p>
            </div>
            <div>
              <h4 className="text-electric-purple font-semibold mb-2">Share with Friends</h4>
              <p className="text-secondary-text font-open-sans text-sm">
                Love your plan? Share the BodyMap experience with friends and family 
                so they can create their own personalized fitness journey.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadPlanPage;
