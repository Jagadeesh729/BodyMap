
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import CreatePlanPage from "./pages/CreatePlanPage";
import WeeklyPlanPage from "./pages/WeeklyPlanPage";
import EditPlanPage from "./pages/EditPlanPage";
import DownloadPlanPage from "./pages/DownloadPlanPage";
import AboutContactPage from "./pages/AboutContactPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen bg-bodymap-dark">
          <Navbar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create-plan" element={<CreatePlanPage />} />
            <Route path="/weekly-plan" element={<WeeklyPlanPage />} />
            <Route path="/edit-plan" element={<EditPlanPage />} />
            <Route path="/download-plan" element={<DownloadPlanPage />} />
            <Route path="/about" element={<AboutContactPage />} />
            <Route path="/contact" element={<AboutContactPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
