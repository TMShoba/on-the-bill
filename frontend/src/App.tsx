import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./Pages/Home";
import ArtistDetails from "./Pages/ArtistDetails";
import Login from "./Pages/Login";
import Register from "./Pages/Register";
import DashboardRedirect from "./Pages/DashboardRedirect";
import Artists from "./Pages/Artists";
import Settings from "./Pages/Settings";
import Support from "./Pages/Support";
import Messages from "./Pages/Messages";
import Terms from "./Pages/legal/Terms";
import Privacy from "./Pages/legal/Privacy";
import Cancellation from "./Pages/legal/Cancellation";
import { AuthProvider } from "./context/AuthContext";
import MobileBottomNav from "./components/MobileBottomNav";
import FloatingMessagesButton from "./components/FloatingMessagesButton";
import AppBootLoader from "./components/loading/AppBootLoader";

function App() {
  return (
    <AuthProvider>
      <AppBootLoader>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/artists/:id" element={<ArtistDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<DashboardRedirect />} />
          <Route path="/dashboard/settings" element={<Settings />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/support" element={<Support />} />
          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/legal/cancellation" element={<Cancellation />} />
        </Routes>
        <MobileBottomNav />
        <FloatingMessagesButton />
      </BrowserRouter>
      </AppBootLoader>
    </AuthProvider>
  );
}

export default App;
