import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: unknown): State {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return { hasError: true, message };
  }

  componentDidCatch(err: unknown, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", err, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ background: "var(--roam-base, #0e1a0d)" }}
      >
        <div className="text-5xl">🧭</div>
        <div>
          <h1 className="font-serif text-3xl mb-2" style={{ color: "var(--roam-cream)" }}>
            Looks like we took a wrong turn
          </h1>
          <p className="text-sm max-w-xs mx-auto" style={{ color: "rgba(var(--roam-cream-rgb), 0.45)" }}>
            {this.state.message}
          </p>
        </div>
        <button
          onClick={() => { this.setState({ hasError: false, message: "" }); window.location.href = "/"; }}
          className="px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ background: "var(--roam-electric)", color: "#0e1a0d" }}
        >
          Back to home
        </button>
      </div>
    );
  }
}
