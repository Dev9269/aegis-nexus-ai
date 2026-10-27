import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { BrandMark } from "../components/layout/BrandMark";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AEGIS UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="panel w-full max-w-lg p-7 text-center">
          <div className="mb-5 flex justify-center">
            <BrandMark />
          </div>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-critical/30 bg-critical/10 text-critical">
            <TriangleAlert size={20} />
          </div>
          <h1 className="font-display text-lg font-semibold text-ink">The interface hit an unexpected error</h1>
          <p className="mt-2 text-xs leading-5 text-muted">
            No security state was changed. Reload the console to restore a clean view. If the problem persists, check
            the browser console and the API health endpoint.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg border border-line/60 bg-raised/40 p-3 text-left font-mono text-[10px] text-faint">
            {this.state.error.message}
          </pre>
          <button type="button" className="btn-primary mt-5" onClick={() => window.location.reload()}>
            <RefreshCw size={14} /> Reload AEGIS
          </button>
        </div>
      </div>
    );
  }
}
