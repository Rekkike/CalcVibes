import { Component } from "react";
import type { ReactNode } from "react";

interface State {
  error: Error | null;
}

export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error !== null) {
      return (
        <div data-testid="root-error-boundary" className="warning error-card">
          <h2>An unexpected error occurred</h2>
          <p>{this.state.error.message}</p>
          <button data-action="dismiss-error" onClick={() => this.setState({ error: null })}>Dismiss and return</button>
        </div>
      );
    }
    return this.props.children;
  }
}
