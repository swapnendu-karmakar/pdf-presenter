import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('ErrorBoundary caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 text-center text-slate-600">
          <p className="text-xs text-slate-500 mb-2.5">Notice: Component refresh needed</p>
          <button
            onClick={this.handleRetry}
            className="cursor-pointer rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-xs hover:bg-indigo-100 transition active:scale-95"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
