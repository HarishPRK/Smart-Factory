import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./components/Dashboard', () => ({
  default: () => <div data-testid="dashboard-mock">Dashboard</div>,
}))

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByTestId('dashboard-mock')).toBeTruthy()
  })
})
