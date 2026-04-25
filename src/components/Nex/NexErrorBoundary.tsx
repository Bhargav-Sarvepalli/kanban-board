import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { crashed: boolean }

export default class NexErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: Error) {
    console.warn('Nex crashed silently:', error.message)
  }

  render() {
    if (this.state.crashed) return null // Nex disappears, app lives
    return this.props.children
  }
}