import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { BodyMapLogo } from '@/components/BodyMapLogo'

describe('BodyMapLogo Component', () => {
  it('renders horizontal logo with wordmark by default', () => {
    const { container, getByText } = render(<BodyMapLogo />)
    expect(container.querySelector('svg')).toBeDefined()
    expect(getByText('BODY')).toBeDefined()
    expect(getByText('MAP')).toBeDefined()
  })

  it('renders icon-only variant without text', () => {
    const { container, queryByText } = render(<BodyMapLogo variant="icon-only" />)
    expect(container.querySelector('svg')).toBeDefined()
    expect(queryByText('BODY')).toBeNull()
    expect(queryByText('MAP')).toBeNull()
  })

  it('renders stacked variant with text', () => {
    const { container, getByText } = render(<BodyMapLogo variant="stacked" />)
    expect(container.querySelector('svg')).toBeDefined()
    expect(getByText('BODY')).toBeDefined()
    expect(getByText('MAP')).toBeDefined()
  })

  it('applies custom iconSize', () => {
    const { container } = render(<BodyMapLogo iconSize={48} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('48')
    expect(svg?.getAttribute('height')).toBe('48')
  })
})
