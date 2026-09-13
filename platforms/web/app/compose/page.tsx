import { ComposeShell } from '../../src/compose/components/compose-shell';
import { ToastProvider } from '../../src/compose/components/Toast';
import { ErrorBoundary } from '../../src/compose/components/ErrorBoundary';

export default function ComposePage() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ComposeShell />
      </ToastProvider>
    </ErrorBoundary>
  );
}
