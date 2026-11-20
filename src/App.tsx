import { ShieldOff } from 'lucide-react'
import BrandLogo from './components/BrandLogo'
import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import AppLayout from './components/AppLayout'
import ErrorBoundary from './components/ErrorBoundary'
import { Button, Spinner } from './components/ui'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { isFirebaseConfigured } from './lib/firebase'
import SetupPage from './pages/SetupPage'
import { backend } from './services'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'))
const NewProductPage = lazy(() => import('./pages/NewProductPage'))
const UsagePage = lazy(() => import('./pages/UsagePage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <BrandLogo size="lg" className="animate-pulse" />
      <Spinner />
    </div>
  )
}

/** Exige sesión iniciada y cuenta activa. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!user.active)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldOff className="size-12 text-rose-500" />
        <h1 className="text-xl font-bold">Cuenta desactivada</h1>
        <p className="max-w-sm text-sm text-muted">Un administrador desactivó tu acceso. Contacta con él si crees que es un error.</p>
        <Button variant="secondary" onClick={() => backend.auth.signOut()}>Cerrar sesión</Button>
      </div>
    )
  return <>{children}</>
}

function RequireRole({ admin, write, children }: { admin?: boolean; write?: boolean; children: ReactNode }) {
  const { isAdmin, canWrite } = useAuth()
  if ((admin && !isAdmin) || (write && !canWrite)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  if (!isFirebaseConfigured) return <SetupPage />
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<FullScreenLoader />}>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route
                element={
                  <RequireAuth>
                    <DataProvider>
                      <AppLayout />
                    </DataProvider>
                  </RequireAuth>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="inventario" element={<ProductsPage />} />
                <Route path="inventario/:id" element={<ProductDetailPage />} />
                <Route path="registrar" element={<RequireRole write><NewProductPage /></RequireRole>} />
                <Route path="uso" element={<RequireRole write><UsagePage /></RequireRole>} />
                <Route path="historial" element={<HistoryPage />} />
                <Route path="usuarios" element={<RequireRole admin><UsersPage /></RequireRole>} />
                <Route path="perfil" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster richColors position="top-right" closeButton toastOptions={{ className: 'font-sans' }} />
      </AuthProvider>
    </ErrorBoundary>
  )
}
