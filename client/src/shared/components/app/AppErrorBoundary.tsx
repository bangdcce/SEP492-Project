import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App root crashed", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
          <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
              Application Error
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Something went wrong while rendering this page.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The error was isolated so the app did not hard-crash. Reload the page
              to retry the latest route.
            </p>
            <button
              className="mt-6 inline-flex items-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={this.handleReload}
              type="button"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
