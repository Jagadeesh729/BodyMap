import { useState } from 'react'
import { Send, CheckCircle2, Mail, User, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'

interface ContactFormProps {
  title?: string
  subtitle?: string
}

export const ContactForm = ({
  title = 'Get in Touch',
  subtitle = 'Have questions, feedback, or need help with your plan? Send us a message.'
}: ContactFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.message) {
      toast({
        title: 'Please fill all required fields',
        description: 'Name, email, and message are required.',
        variant: 'destructive'
      })
      return
    }

    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSubmitted(true)
      toast({
        title: 'Message Sent!',
        description: 'Thank you for reaching out. We will get back to you within 24 hours.'
      })
      setFormData({ name: '', email: '', subject: '', message: '' })
    }, 600)
  }

  if (isSubmitted) {
    return (
      <div className="card-dark text-center py-12">
        <CheckCircle2 className="w-16 h-16 text-neon-green mx-auto mb-4" />
        <h3 className="text-2xl font-poppins font-bold text-primary-text mb-2">Message Received!</h3>
        <p className="text-secondary-text font-open-sans max-w-md mx-auto mb-6">
          Thanks for contacting BodyMap. We have received your message and our support team will respond shortly.
        </p>
        <Button onClick={() => setIsSubmitted(false)} variant="outline" className="border-gray-700 text-secondary-text hover:bg-gray-800">
          Send Another Message
        </Button>
      </div>
    )
  }

  return (
    <div className="card-dark">
      {title && (
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-poppins font-bold text-primary-text mb-2">{title}</h2>
          {subtitle && <p className="text-secondary-text font-open-sans text-sm sm:text-base">{subtitle}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <Label htmlFor="contact-name" className="text-secondary-text mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-neon-green" /> Name <span className="text-bright-coral">*</span>
            </Label>
            <Input
              id="contact-name"
              type="text"
              placeholder="Your full name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="input-dark"
              required
            />
          </div>

          <div>
            <Label htmlFor="contact-email" className="text-secondary-text mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-electric-purple" /> Email <span className="text-bright-coral">*</span>
            </Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="input-dark"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="contact-subject" className="text-secondary-text mb-1.5 flex items-center gap-1.5">
            Subject
          </Label>
          <Input
            id="contact-subject"
            type="text"
            placeholder="e.g. Question about my custom plan"
            value={formData.subject}
            onChange={(e) => handleChange('subject', e.target.value)}
            className="input-dark"
          />
        </div>

        <div>
          <Label htmlFor="contact-message" className="text-secondary-text mb-1.5 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-bright-coral" /> Message <span className="text-bright-coral">*</span>
          </Label>
          <Textarea
            id="contact-message"
            placeholder="How can we help you achieve your fitness goals?"
            value={formData.message}
            onChange={(e) => handleChange('message', e.target.value)}
            className="input-dark min-h-[120px]"
            required
            rows={4}
          />
        </div>

        <Button type="submit" disabled={isSubmitting} className="btn-primary w-full sm:w-auto px-8">
          {isSubmitting ? 'Sending...' : 'Send Message'}
          <Send className="w-4 h-4 ml-2" />
        </Button>
      </form>
    </div>
  )
}
