import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const hasResume = localStorage.getItem("resumeBuilt");

  if (!hasResume) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
