import { Routes, Route, Navigate } from "react-router-dom";
import { BibleReader } from "./routes/BibleReader";
import { ResetPassword } from "./routes/ResetPassword";

export default function App() {
  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/:translation/:book/:chapter" element={<BibleReader />} />
      <Route path="*" element={<Navigate to="/nasb/43/1" replace />} />
    </Routes>
  );
}
