import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './contexts/AuthContext';
import { AppRouter } from './AppRouter';
import { useScheduleChecker } from './hooks/useScheduleChecker';

function AppContent() {
  useScheduleChecker();
  return <AppRouter />;
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
