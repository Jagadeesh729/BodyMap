import { describe, it, expect } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { ContactForm } from '@/components/ContactForm'

describe('ContactForm Component', () => {
  it('renders contact form fields and submit button', () => {
    const { container, getByRole } = render(<ContactForm />)
    expect(container.querySelector('#contact-name')).toBeDefined()
    expect(container.querySelector('#contact-email')).toBeDefined()
    expect(container.querySelector('#contact-message')).toBeDefined()
    expect(getByRole('button', { name: /send message/i })).toBeDefined()
  })

  it('updates input fields when typing', () => {
    const { container } = render(<ContactForm />)
    const nameInput = container.querySelector('#contact-name') as HTMLInputElement
    const emailInput = container.querySelector('#contact-email') as HTMLInputElement
    const messageInput = container.querySelector('#contact-message') as HTMLTextAreaElement

    fireEvent.change(nameInput, { target: { value: 'Alex Athlete' } })
    fireEvent.change(emailInput, { target: { value: 'alex@example.com' } })
    fireEvent.change(messageInput, { target: { value: 'Inquiry about workout duration' } })

    expect(nameInput.value).toBe('Alex Athlete')
    expect(emailInput.value).toBe('alex@example.com')
    expect(messageInput.value).toBe('Inquiry about workout duration')
  })

  it('submits successfully with valid data and displays success confirmation', async () => {
    const { container, getByRole, getByText } = render(<ContactForm />)
    const nameInput = container.querySelector('#contact-name') as HTMLInputElement
    const emailInput = container.querySelector('#contact-email') as HTMLInputElement
    const messageInput = container.querySelector('#contact-message') as HTMLTextAreaElement
    const submitBtn = getByRole('button', { name: /send message/i })

    fireEvent.change(nameInput, { target: { value: 'Alex Athlete' } })
    fireEvent.change(emailInput, { target: { value: 'alex@example.com' } })
    fireEvent.change(messageInput, { target: { value: 'This is a great fitness planning application!' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(getByText(/message received!/i)).toBeDefined()
    }, { timeout: 2000 })
  })
})
