import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomeLayout from "./components/HomeLayout";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Study from "./pages/Study";
import MyBatches from "./pages/MyBatches";
import BatchDetail from "./pages/BatchDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeLayout />}>
          <Route index element={<Home />} />
        </Route>
        <Route path="/auth" element={<Auth />} />
        <Route element={<DashboardLayout />}>
          <Route path="/study" element={<Study />} />
          <Route path="/my-batches" element={<MyBatches />} />
          <Route path="/batch/:id" element={<BatchDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
