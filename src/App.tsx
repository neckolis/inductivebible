import { Routes, Route, Navigate } from "react-router-dom";
import { BibleReader } from "./routes/BibleReader";
import { ResetPassword } from "./routes/ResetPassword";
import { usePreferenceStore } from "./store/preferenceStore";

function DefaultRedirect() {
  const translation = usePreferenceStore((s) => s.preferences.defaultTranslation) ?? "NASB";
  return <Navigate to={`/${translation}/43/1`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/:translation/:book/:chapter" element={<BibleReader />} />
      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}
