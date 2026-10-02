import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// Apply the saved theme before React renders (prevents a flash). Default: light.
const savedTheme = window.localStorage.getItem("finsight_theme");
const initialTheme = savedTheme === "dark" ? "dark" : "light";
document.documentElement.classList.add(initialTheme);
document.documentElement.style.colorScheme = initialTheme;

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
